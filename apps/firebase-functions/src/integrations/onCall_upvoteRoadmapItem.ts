import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { notionClientId, notionClientSecret } from "./secrets.js";

type NotionRichText = { plain_text?: string };
type NotionOption = { name?: string };
type NotionProperty = {
  type: string;
  title?: NotionRichText[];
  select?: { name?: string; options?: NotionOption[] };
  status?: { name?: string; options?: NotionOption[] };
  multi_select?: { options?: NotionOption[] };
  number?: number;
};

/**
 * Records a Grids user's upvote on a roadmap item and patches the upvote
 * count back to the corresponding Notion page.
 *
 * Upvotes are stored in Firestore at:
 *   layouts/{layoutId}/tiles/{tileId}/upvotes/{userId}
 *
 * One document per user per tile item — the notionPageId field identifies
 * which item within the tile the user voted on. This naturally deduplicates
 * votes (set with merge:false will fail if the doc already exists, so we
 * use a transaction to check and toggle).
 */
export const upvoteRoadmapItem = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to upvote.",
      );
    }

    const { layoutId, tileId, notionPageId } = data as {
      layoutId?: string;
      tileId?: string;
      notionPageId?: string;
    };

    if (!layoutId || !tileId || !notionPageId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing layoutId, tileId, or notionPageId.",
      );
    }

    const db = admin.firestore();
    const userId = context.auth.uid;

    // One doc per user per item, keyed by "{userId}_{notionPageId}".
    // This allows a user to upvote multiple items independently.
    // The userId prefix lets the client query all of a user's votes with a
    // where("userId", "==", uid) filter without needing a collection-group index.
    const docId = `${userId}_${notionPageId}`;
    const upvoteRef = db
      .collection("layouts")
      .doc(layoutId)
      .collection("tiles")
      .doc(tileId)
      .collection("upvotes")
      .doc(docId);

    // Retrieve the Notion access token for this tile
    const tokenDoc = await db
      .collection("layouts")
      .doc(layoutId)
      .collection("notionTokens")
      .doc(tileId)
      .get();

    if (!tokenDoc.exists) {
      throw new HttpsError(
        "not-found",
        "Notion integration not connected for this tile.",
      );
    }

    const accessToken = tokenDoc.data()?.accessToken as string;

    // Use a transaction to toggle the upvote atomically
    const { isNowUpvoted, newCount } = await db.runTransaction(
      async (transaction) => {
        const upvoteDoc = await transaction.get(upvoteRef);

        if (upvoteDoc.exists) {
          // Toggle off — remove this item's upvote (other items unaffected)
          transaction.delete(upvoteRef);
          return { isNowUpvoted: false, newCount: -1 };
        } else {
          // Toggle on — record the upvote for this specific item
          transaction.set(upvoteRef, {
            userId,
            notionPageId,
            votedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return { isNowUpvoted: true, newCount: 1 };
        }
      },
    );

    // Retrieve the tile content to find the upvote property name
    const layoutDoc = await db.collection("layouts").doc(layoutId).get();
    type UpvoteTileShape = {
      i: string;
      content?: { upvotePropertyName?: string };
    };
    const tiles: UpvoteTileShape[] = layoutDoc.data()?.tiles || [];
    const tile = tiles.find((t: UpvoteTileShape) => t.i === tileId);
    const upvotePropertyName: string = tile?.content?.upvotePropertyName || "";

    // Patch the upvote count on the Notion page if a property name is configured.
    // We fetch the current value first so we can increment/decrement correctly.
    if (upvotePropertyName) {
      try {
        // Fetch the current page to get the existing upvote count
        const pageRes = await fetch(
          `https://api.notion.com/v1/pages/${notionPageId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Notion-Version": "2022-06-28",
            },
          },
        );

        if (pageRes.ok) {
          const pageData = (await pageRes.json()) as {
            properties: Record<string, NotionProperty>;
          };
          const currentCount: number =
            pageData.properties[upvotePropertyName]?.number ?? 0;

          const updatedCount = Math.max(0, currentCount + newCount);

          // Patch the Notion page with the new upvote count
          await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "Notion-Version": "2022-06-28",
            },
            body: JSON.stringify({
              properties: {
                [upvotePropertyName]: { number: updatedCount },
              },
            }),
          });

          logger.info("Notion upvote count patched", {
            notionPageId,
            upvotePropertyName,
            updatedCount,
            isNowUpvoted,
          });
        }
      } catch (err) {
        // Non-fatal — the Firestore vote is already recorded; Notion sync is best-effort
        logger.error("Failed to patch Notion upvote count", {
          error: String(err),
          notionPageId,
        });
      }
    }

    return { isNowUpvoted };
  });
