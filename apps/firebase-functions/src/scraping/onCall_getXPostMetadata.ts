import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import {
  xPostRefreshAfterMs,
  type XPostMetadataResponse,
} from "@grids/contracts/types";
import { noopIfMaintenance } from "../maintenance.js";
import { requireStringFields } from "../shared/utils_callable.js";
import {
  POST_ID_PATTERN,
  toXPostSnapshot,
  type SyndicationPost,
} from "./utils_xPost.js";
import { fetchSyndicationPost } from "./utils_xFetch.js";
import { readThroughXCache } from "./utils_xCache.js";

async function loadXPost(postId: string): Promise<XPostMetadataResponse> {
  const fetchedAt = Date.now();
  let response: Response;
  try {
    response = await fetchSyndicationPost(postId);
  } catch (error: unknown) {
    logger.error("Failed to reach X for post", { error: String(error), postId });
    throw new HttpsError("unavailable", "Could not reach X.");
  }

  if (response.status === 404) {
    return { unavailable: true, fetchedAt };
  }
  if (!response.ok) {
    logger.error("X returned an error for post", { status: response.status, postId });
    throw new HttpsError("unavailable", "X did not return the post.");
  }

  let body: SyndicationPost;
  try {
    body = (await response.json()) as SyndicationPost;
  } catch (error: unknown) {
    logger.error("X returned unreadable post data", { error: String(error), postId });
    throw new HttpsError("internal", "Failed to read X post data.");
  }

  const post = toXPostSnapshot(body);
  if (!post) {
    return { unavailable: true, fetchedAt };
  }

  const quotedPost = toXPostSnapshot(body.quoted_tweet);
  return quotedPost ? { post, quotedPost, fetchedAt } : { post, fetchedAt };
}

/**
 * Cloud Function to fetch an X post (and the post it quotes) for the X post
 * tile. Deleted, withheld, and protected posts resolve as `unavailable`
 * rather than throwing, so the tile can say so. Grid visitors who aren't
 * signed in can refresh posts that are already cached.
 */
export const getXPostMetadata = functions
  .runWith({ minInstances: 1 })
  .https.onCall(async (data, context): Promise<XPostMetadataResponse | null> => {
  if (noopIfMaintenance("getXPostMetadata")) return null;

  const { postId } = requireStringFields(data, ["postId"], "Missing postId.");
  if (!POST_ID_PATTERN.test(postId)) {
    throw new HttpsError("invalid-argument", `Invalid postId: ${postId}`);
  }

  const result = await readThroughXCache<XPostMetadataResponse>({
    key: `post_${postId}`,
    refreshAfterMs: () => xPostRefreshAfterMs(postId, Date.now()),
    canSeed: !!context.auth?.uid,
    load: () => loadXPost(postId),
  });
  if (!result) {
    throw new HttpsError("unauthenticated", "You must be signed in to fetch X posts.");
  }
  return result;
});
