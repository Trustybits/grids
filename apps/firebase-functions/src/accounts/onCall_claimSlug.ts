import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import {
  requireAuth,
  requireStringFields,
} from "../shared/utils_callable.js";
import { RESERVED_SLUGS } from "./utils_reservedSlugs.js";
import { isValidSlugFormat } from "./utils_slugValidation.js";

/**
 * Cloud Function to claim or update a user's slug.
 * Enforces uniqueness and format validation.
 */
export const claimSlug = onCall(async (data, context) => {
  if (noopIfMaintenance("claimSlug")) return null;

  const userId = requireAuth(context, "You must be signed in to claim a slug.");
  const { slug: requestedSlug } = requireStringFields(
    data,
    ["slug"],
    "Slug is required.",
  );

  // Normalize to lowercase
  const slug = requestedSlug.toLowerCase().trim();

  // Validate slug format
  if (!isValidSlugFormat(slug)) {
    throw new HttpsError(
      "invalid-argument",
      "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
    );
  }

  // Check if slug is reserved
  if (RESERVED_SLUGS.includes(slug)) {
    throw new HttpsError(
      "invalid-argument",
      "This slug is reserved and cannot be used.",
    );
  }

  const db = admin.firestore();

  try {
    // Use a transaction to ensure atomicity and prevent race conditions
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);
      const slugRef = db.collection("slugs").doc(slug);
      const slugDoc = await transaction.get(slugRef);

      // Check if slug is already taken
      if (slugDoc.exists) {
        const existingUserId = slugDoc.data()?.userId;

        // If userId is null or undefined, the slug was released and is available
        if (existingUserId !== null && existingUserId !== undefined) {
          // If the slug belongs to a different user, it's taken
          if (existingUserId !== userId) {
            throw new HttpsError(
              "already-exists",
              "This slug is already taken.",
            );
          }
          // If it's the same user, they're updating to the same slug (no-op)
          return { success: true, message: "Slug is already yours." };
        }
        // If userId is null, fall through to claim the released slug
      }

      // If user had a previous slug, update its history to mark it as released
      if (userDoc.exists && userDoc.data()?.slug) {
        const oldSlug = userDoc.data()?.slug as string;
        if (oldSlug !== slug) {
          const oldSlugRef = db.collection("slugs").doc(oldSlug);
          const oldSlugDoc = await transaction.get(oldSlugRef);

          if (oldSlugDoc.exists) {
            const oldSlugData = oldSlugDoc.data();
            // Add current ownership to history before releasing
            // Use the existing createdAt timestamp if available, otherwise use current time
            const claimedAt = oldSlugData?.createdAt || new Date();

            transaction.update(oldSlugRef, {
              userId: null, // Mark as available
              history: admin.firestore.FieldValue.arrayUnion({
                userId,
                claimedAt,
                releasedAt: new Date(), // Cannot use FieldValue.serverTimestamp() inside arrays
              }),
            });
          }
        }
      }

      // Get user's default grid to store in slug document for public access
      const defaultGridId = userDoc.exists
        ? userDoc.data()?.defaultGridId || null
        : null;

      // Create or update the slug document with history tracking
      const now = new Date();
      transaction.set(
        slugRef,
        {
          userId,
          defaultGridId, // Store for public access
          createdAt: admin.firestore.FieldValue.serverTimestamp(), // Can use FieldValue at top level
          history: admin.firestore.FieldValue.arrayUnion({
            userId,
            claimedAt: now, // Cannot use FieldValue.serverTimestamp() inside arrays
          }),
        },
        { merge: true },
      );

      // Update or create the user document with the new slug
      if (userDoc.exists) {
        transaction.update(userRef, { slug });
      } else {
        transaction.set(userRef, { slug }, { merge: true });
      }

      logger.info("Slug claimed successfully", { userId, slug });
      return { success: true, message: "Slug claimed successfully." };
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to claim slug", {
      error: String(error),
      userId,
      slug,
    });
    throw new HttpsError("internal", "Failed to claim slug. Please try again.");
  }
});
