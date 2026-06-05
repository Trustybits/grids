import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";

/**
 * Firebase function that triggers when a new grid is created and assigns it as
 * the user's default grid if they don't already have one.
 *
 * This is intentionally a standalone trigger, separate from the grid-creation
 * Discord notification (onTrigger_gridCreated.ts). The default-grid assignment
 * is a core data operation and must not be gated behind — or short-circuited
 * by — notification side-effects (dev-team skips, missing webhooks, webhook
 * failures). Keeping it independent guarantees it runs for every grid create,
 * including dev/test accounts.
 */
export const assignDefaultGridOnCreate = functions.firestore
  .document("grids/{gridId}")
  .onCreate(async (snapshot, context) => {
    if (noopIfMaintenance("assignDefaultGridOnCreate")) return null;

    const gridData = snapshot.data();
    const gridId = context.params.gridId;
    const userId = gridData.userId;
    if (!userId) {
      return null;
    }

    // Duplicated grids must never auto-become the default — only a user's first
    // (fresh) grid should. Clones carry a clonedFrom marker; skip them.
    if (gridData.clonedFrom) {
      return null;
    }

    try {
      const db = admin.firestore();
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists || !userDoc.data()?.defaultGridId) {
          transaction.set(userRef, { defaultGridId: gridId }, { merge: true });

          const userSlug = userDoc.exists ? userDoc.data()?.slug : null;
          if (userSlug) {
            const slugRef = db.collection("slugs").doc(userSlug);
            transaction.update(slugRef, { defaultGridId: gridId });
          }

          logger.info("Auto-assigned default grid for user", {
            userId,
            gridId,
          });
        }
      });
    } catch (error) {
      logger.error("Failed to auto-assign default grid", {
        error: String(error),
        userId,
        gridId,
      });
    }

    return null;
  });
