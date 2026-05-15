import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import * as admin from "../admin";
import { RESERVED_SLUGS } from "./utils_reservedSlugs";
import { isValidSlugFormat } from "./utils_slugValidation";

/**
 * Cloud Function to check if a slug is available.
 * Returns availability status without claiming it.
 */
export const checkSlugAvailability = onCall(async (data, context) => {
  // Authentication not strictly required for checking, but we'll require it
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to check slug availability.",
    );
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
      message:
        "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only.",
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
