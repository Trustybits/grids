import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import {
  requireAuth,
  requireStringFields,
} from "../shared/utils_callable.js";
import { notionClientId, notionClientSecret } from "./secrets.js";
import {
  getNotionAccessToken,
  notionBearerHeaders,
  type NotionProperty,
} from "./utils_notion.js";

/**
 * Records a Grids user's upvote on a roadmap item and patches the upvote
 * count back to the corresponding Notion page.
 *
 * Upvotes are stored in Firestore at:
 *   grids/{gridId}/tiles/{tileId}/upvotes/{userId}
 *
 * One document per user per tile item — the notionPageId field identifies
 * which item within the tile the user voted on. This naturally deduplicates
 * votes (set with merge:false will fail if the doc already exists, so we
 * use a transaction to check and toggle).
 */
export const upvoteRoadmapItem = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, context) => {
    if (noopIfMaintenance("upvoteRoadmapItem")) return null;

    const userId = requireAuth(context, "You must be signed in to upvote.");
    const { gridId, tileId, notionPageId } = requireStringFields(
      data,
      ["gridId", "tileId", "notionPageId"],
      "Missing gridId, tileId, or notionPageId.",
    );

    const db = admin.firestore();

    // One doc per user per item, keyed by "{userId}_{notionPageId}".
    // This allows a user to upvote multiple items independently.
    // The userId prefix lets the client query all of a user's votes with a
    // where("userId", "==", uid) filter without needing a collection-group index.
    const docId = `${userId}_${notionPageId}`;
    const upvoteRef = db
      .collection("grids")
      .doc(gridId)
      .collection("tiles")
      .doc(tileId)
      .collection("upvotes")
      .doc(docId);

    const accessToken = await getNotionAccessToken(db, gridId, tileId);

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
    const gridDoc = await db.collection("grids").doc(gridId).get();
    type UpvoteTileShape = {
      i: string;
      content?: { upvotePropertyName?: string };
    };
    const tiles: UpvoteTileShape[] = gridDoc.data()?.tiles || [];
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
            headers: notionBearerHeaders(accessToken),
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
            headers: notionBearerHeaders(accessToken, {
              contentType: "application/json",
            }),
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
