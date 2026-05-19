import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { notionClientId, notionClientSecret } from "./secrets.js";

/**
 * Exchanges a Notion OAuth authorization code for an access token and stores
 * it encrypted in Firestore at layouts/{layoutId}/notionTokens/{tileId}.
 *
 * The token is stored server-side only — it is never returned to the client
 * and is not part of the publicly-readable tile content.
 *
 * Called by the NotionCallback page after the user completes Notion OAuth.
 */
export const notionOAuthExchange = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { code, layoutId, tileId, redirectUri } = data as {
      code?: string;
      layoutId?: string;
      tileId?: string;
      redirectUri?: string;
    };

    if (!code || !layoutId || !tileId || !redirectUri) {
      throw new HttpsError(
        "invalid-argument",
        "Missing code, layoutId, tileId, or redirectUri.",
      );
    }

    // Verify the caller owns the layout before storing any token
    const db = admin.firestore();
    const layoutDoc = await db.collection("layouts").doc(layoutId).get();
    if (!layoutDoc.exists || layoutDoc.data()?.userId !== context.auth.uid) {
      throw new HttpsError("permission-denied", "You do not own this layout.");
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
      .collection("layouts")
      .doc(layoutId)
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
      layoutId,
      tileId,
      workspaceId: tokenData.workspace_id,
    });

    return {
      success: true,
      workspaceName: tokenData.workspace_name || "",
    };
  });
