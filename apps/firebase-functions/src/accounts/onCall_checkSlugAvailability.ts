import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
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
 * Cloud Function to check if a slug is available.
 * Returns availability status without claiming it.
 */
export const checkSlugAvailability = functions
  .runWith({ minInstances: 1 })
  .https.onCall(async (data, context) => {
  if (noopIfMaintenance("checkSlugAvailability")) return null;

  const userId = requireAuth(
    context,
    "You must be signed in to check slug availability.",
  );
  const { slug: requestedSlug } = requireStringFields(
    data,
    ["slug"],
    "Slug is required.",
  );

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
      if (existingUserId === userId) {
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
