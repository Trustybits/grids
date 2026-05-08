import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import * as admin from "../firebase/admin";
import { RESERVED_SLUGS } from "./reservedSlugs";
import { isValidSlugFormat } from "./slugValidation";

/**
 * Cloud Function to claim or update a user's slug.
 * Enforces uniqueness and format validation.
 */
export const claimSlug = onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to claim a slug.");
  }

  const userId = context.auth.uid;
  const requestedSlug = (data as { slug?: string } | undefined)?.slug;

  if (!requestedSlug || typeof requestedSlug !== "string") {
    throw new HttpsError("invalid-argument", "Slug is required.");
  }

  // Normalize to lowercase
  const slug = requestedSlug.toLowerCase().trim();

  // Validate slug format
  if (!isValidSlugFormat(slug)) {
    throw new HttpsError(
      "invalid-argument",
      "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen."
    );
  }

  // Check if slug is reserved
  if (RESERVED_SLUGS.includes(slug)) {
    throw new HttpsError("invalid-argument", "This slug is reserved and cannot be used.");
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
            throw new HttpsError("already-exists", "This slug is already taken.");
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
      const defaultGridId = userDoc.exists ? userDoc.data()?.defaultGridId || null : null;

      // Create or update the slug document with history tracking
      const now = new Date();
      transaction.set(slugRef, {
        userId,
        defaultGridId, // Store for public access
        createdAt: admin.firestore.FieldValue.serverTimestamp(), // Can use FieldValue at top level
        history: admin.firestore.FieldValue.arrayUnion({
          userId,
          claimedAt: now, // Cannot use FieldValue.serverTimestamp() inside arrays
        }),
      }, { merge: true });

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

/**
 * Cloud Function to update the default grid for a user's slug.
 * This syncs the defaultGridId to the slugs collection for public access.
 */
export const updateDefaultGrid = onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to update your default grid.");
  }

  const userId = context.auth.uid;
  const gridId = (data as { gridId?: string | null } | undefined)?.gridId || null;

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
    throw new HttpsError("internal", "Failed to update default grid. Please try again.");
  }
});

/**
 * Cloud Function to check if a slug is available.
 * Returns availability status without claiming it.
 */
export const checkSlugAvailability = onCall(async (data, context) => {
  // Authentication not strictly required for checking, but we'll require it
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to check slug availability.");
  }

  const requestedSlug = (data as { slug?: string } | undefined)?.slug;

  if (!requestedSlug || typeof requestedSlug !== "string") {
    throw new HttpsError("invalid-argument", "Slug is required.");
  }

  const slug = requestedSlug.toLowerCase().trim();

  // Validate slug format
  if (!isValidSlugFormat(slug)) {
    return {
      available: false,
      reason: "invalid-format",
      message: "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only.",
    };
  }

  // Check if slug is reserved
  if (RESERVED_SLUGS.includes(slug)) {
    return {
      available: false,
      reason: "reserved",
      message: "This slug is reserved.",
    };
  }

  const db = admin.firestore();

  try {
    const slugRef = db.collection("slugs").doc(slug);
    const slugDoc = await slugRef.get();
    
    if (slugDoc.exists) {
      const existingUserId = slugDoc.data()?.userId;
      
      // If userId is null, the slug was released and is available
      if (existingUserId === null || existingUserId === undefined) {
        return {
          available: true,
          reason: "available",
          message: "This slug is available!",
        };
      }
      
      // Check if it's the current user's slug
      if (existingUserId === context.auth.uid) {
        return {
          available: true,
          reason: "own-slug",
          message: "This is your current slug.",
        };
      }
      
      // Slug is taken by another user
      return {
        available: false,
        reason: "taken",
        message: "This slug is already taken.",
      };
    }

    return {
      available: true,
      reason: "available",
      message: "This slug is available!",
    };
  } catch (error) {
    logger.error("Failed to check slug availability", {
      error: String(error),
      slug,
    });
    throw new HttpsError("internal", "Failed to check slug availability.");
  }
});
