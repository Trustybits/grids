import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import type { XPostRepliesResponse } from "@grids/contracts/types";
import { noopIfMaintenance } from "../maintenance.js";
import {
  requireAuth,
  requireStringFields,
} from "../shared/utils_callable.js";
import { POST_ID_PATTERN, SCREEN_NAME_PATTERN } from "./utils_xPost.js";
import { loadXPostSnapshots } from "./utils_xFetch.js";
import { getXDiscoverySource } from "./utils_xDiscovery.js";

const MAX_REPLIES = 10;

/**
 * Cloud Function to fetch replies to an X post for the X post tile.
 * Discovery failures resolve as an empty list rather than throwing: replies
 * are an optional extra, and the post itself has already loaded.
 */
export const getXPostReplies = functions
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context): Promise<XPostRepliesResponse | null> => {
  if (noopIfMaintenance("getXPostReplies")) return null;

  requireAuth(context, "You must be signed in to fetch X replies.");
  const { postId, screenName } = requireStringFields(
    data,
    ["postId", "screenName"],
    "Missing postId or screenName.",
  );
  if (!POST_ID_PATTERN.test(postId)) {
    throw new HttpsError("invalid-argument", `Invalid postId: ${postId}`);
  }
  if (!SCREEN_NAME_PATTERN.test(screenName)) {
    throw new HttpsError("invalid-argument", `Invalid screenName: ${screenName}`);
  }

  const fetchedAt = Date.now();
  const source = getXDiscoverySource();
  if (!source) return { replies: [], fetchedAt };

  let replyIds: string[];
  try {
    replyIds = await source.findReplyIds(postId, screenName, MAX_REPLIES);
  } catch (error: unknown) {
    logger.warn("X reply discovery failed", { error: String(error), postId });
    return { replies: [], fetchedAt };
  }

  return { replies: await loadXPostSnapshots(replyIds), fetchedAt };
});
