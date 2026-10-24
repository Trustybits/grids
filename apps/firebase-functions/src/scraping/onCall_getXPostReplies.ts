import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import {
  xPostRefreshAfterMs,
  type XPostRepliesResponse,
} from "@grids/contracts/types";
import { noopIfMaintenance } from "../maintenance.js";
import { requireStringFields } from "../shared/utils_callable.js";
import { POST_ID_PATTERN, SCREEN_NAME_PATTERN } from "./utils_xPost.js";
import { loadXPostSnapshots } from "./utils_xFetch.js";
import { getXDiscoverySource } from "./utils_xDiscovery.js";
import { readThroughXCache } from "./utils_xCache.js";

const MAX_REPLIES = 10;

/**
 * Cloud Function to fetch replies to an X post for the X post tile. Failures
 * throw rather than returning an empty list, so tiles keep the replies they
 * already show. Grid visitors who aren't signed in can refresh replies that
 * are already cached.
 */
export const getXPostReplies = functions
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context): Promise<XPostRepliesResponse | null> => {
  if (noopIfMaintenance("getXPostReplies")) return null;

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

  const source = getXDiscoverySource();
  if (!source) {
    throw new HttpsError("failed-precondition", "X replies are turned off.");
  }

  const result = await readThroughXCache<XPostRepliesResponse>({
    key: `replies_${postId}`,
    refreshAfterMs: () => xPostRefreshAfterMs(postId, Date.now()),
    canSeed: !!context.auth?.uid,
    load: async () => {
      const fetchedAt = Date.now();
      let replyIds: string[];
      try {
        replyIds = await source.findReplyIds(postId, screenName, MAX_REPLIES);
      } catch (error: unknown) {
        logger.warn("X reply discovery failed", { error: String(error), postId });
        throw new HttpsError("unavailable", "Could not read replies from X.");
      }
      return { replies: await loadXPostSnapshots(replyIds), fetchedAt };
    },
  });
  if (!result) {
    throw new HttpsError("unauthenticated", "You must be signed in to fetch X replies.");
  }
  return result;
});
