import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";

/**
 * Cloud Function to update the default grid for a user's slug.
 * This syncs the defaultGridId to the slugs collection for public access.
 */
export const updateDefaultGrid = functions
  .runWith({ minInstances: 1 })
  .https.onCall(async (data, context) => {
  if (noopIfMaintenance("updateDefaultGrid")) return null;

  const userId = requireAuth(
    context,
    "You must be signed in to update your default grid.",
  );
  const gridId = getCallableData<{ gridId?: string | null }>(data).gridId || null;

  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const userSlug = userDoc.data()?.slug;

      // Update user's default grid
      transaction.update(userRef, { defaultGridId: gridId });

      // If user has a slug, update the slugs collection too for public access
      if (userSlug) {
        const slugRef = db.collection("slugs").doc(userSlug);
        transaction.update(slugRef, { defaultGridId: gridId });
      }
    });

    logger.info("Default grid updated successfully", { userId, gridId });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to update default grid", {
      error: String(error),
      userId,
      gridId,
    });
    throw new HttpsError(
      "internal",
      "Failed to update default grid. Please try again.",
    );
  }
});
