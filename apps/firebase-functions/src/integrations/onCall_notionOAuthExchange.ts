import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { notionClientId, notionClientSecret } from "./secrets.js";

/**
 * Exchanges a Notion OAuth authorization code for an access token and stores
 * it encrypted in Firestore at grids/{gridId}/notionTokens/{tileId}.
 *
 * The token is stored server-side only — it is never returned to the client
 * and is not part of the publicly-readable tile content.
 *
 * Called by the NotionCallback page after the user completes Notion OAuth.
 */
export const notionOAuthExchange = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (noopIfMaintenance("notionOAuthExchange")) return null;

    if (!context.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { code, gridId, tileId, redirectUri } = (data ?? {}) as {
      code?: string;
      gridId?: string;
      tileId?: string;
      redirectUri?: string;
    };

    if (!code || !gridId || !tileId || !redirectUri) {
      throw new HttpsError(
        "invalid-argument",
        "Missing code, gridId, tileId, or redirectUri.",
      );
    }

    // Verify the caller owns the grid before storing any token.
    const db = admin.firestore();
    const gridDoc = await db.collection("grids").doc(gridId).get();
    if (!gridDoc.exists || gridDoc.data()?.userId !== context.auth.uid) {
      throw new HttpsError("permission-denied", "You do not own this grid.");
    }

    const clientId = notionClientId.value();
    const clientSecret = notionClientSecret.value();

    if (!clientId || !clientSecret) {
      throw new HttpsError(
        "failed-precondition",
        "Notion OAuth not configured.",
      );
    }

    // Exchange the authorization code for an access token via Notion's token endpoint
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        // Must exactly match the URI used in the authorize request.
        // Passed from the client via the state parameter to guarantee consistency.
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error("Notion token exchange failed", {
        status: tokenRes.status,
        body,
      });
      throw new HttpsError(
        "internal",
        "Failed to exchange Notion authorization code.",
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      workspace_id: string;
      workspace_name?: string;
      bot_id: string;
    };

    // Store the token in a private subcollection — not readable by clients via Firestore rules
    await db
      .collection("grids")
      .doc(gridId)
      .collection("notionTokens")
      .doc(tileId)
      .set({
        accessToken: tokenData.access_token,
        workspaceId: tokenData.workspace_id,
        workspaceName: tokenData.workspace_name || "",
        botId: tokenData.bot_id,
        ownerId: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    logger.info("Notion OAuth token stored", {
      gridId,
      tileId,
      workspaceId: tokenData.workspace_id,
    });

    return {
      success: true,
      workspaceName: tokenData.workspace_name || "",
    };
  });
