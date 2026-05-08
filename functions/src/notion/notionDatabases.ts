/* eslint-disable */

import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import * as admin from "../firebase/admin";
import { notionClientId, notionClientSecret } from "./secrets";

/**
 * Lists all Notion databases the user has shared with this integration.
 * Called after OAuth to let the owner pick a database without pasting an ID.
 */
export const listNotionDatabases = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { layoutId, tileId } = data as { layoutId?: string; tileId?: string };
    if (!layoutId || !tileId) {
      throw new HttpsError("invalid-argument", "Missing layoutId or tileId.");
    }

    const db = admin.firestore();
    const tokenDoc = await db
      .collection("layouts").doc(layoutId)
      .collection("notionTokens").doc(tileId)
      .get();

    if (!tokenDoc.exists) {
      throw new HttpsError("not-found", "Notion integration not connected for this tile.");
    }

    const accessToken = tokenDoc.data()?.accessToken as string;

    // Use Notion's search endpoint to find all databases the integration can access
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: { value: "database", property: "object" },
        page_size: 50,
      }),
    });

    if (!searchRes.ok) {
      const body = await searchRes.text();
      logger.error("Notion database list failed", { status: searchRes.status, body });
      throw new HttpsError("internal", "Failed to list Notion databases.");
    }

    const searchData = await searchRes.json() as { results: any[] };

    const databases = searchData.results.map((db: any) => ({
      id: db.id,
      // Notion database titles are rich text arrays
      title: (db.title as any[])?.map((t: any) => t.plain_text || "").join("") || "Untitled",
    }));

    return { databases };
  });
