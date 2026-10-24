import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import type {
  XProfileFeedResponse,
  XProfileSnapshot,
} from "@grids/contracts/types";
import { noopIfMaintenance } from "../maintenance.js";
import {
  requireAuth,
  requireStringFields,
} from "../shared/utils_callable.js";
import { SCREEN_NAME_PATTERN } from "./utils_xPost.js";
import { loadXPostSnapshots } from "./utils_xFetch.js";
import { getXDiscoverySource } from "./utils_xDiscovery.js";

const MAX_POSTS = 10;

/**
 * Cloud Function to fetch an X profile header and its recent posts for the
 * X profile tile. Accounts that don't exist or can't be read resolve as
 * `unavailable` rather than throwing, so the tile can say so.
 */
export const getXProfileFeed = functions
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context): Promise<XProfileFeedResponse | null> => {
  if (noopIfMaintenance("getXProfileFeed")) return null;

  requireAuth(context, "You must be signed in to fetch X profiles.");
  const { screenName } = requireStringFields(data, ["screenName"], "Missing screenName.");
  if (!SCREEN_NAME_PATTERN.test(screenName)) {
    throw new HttpsError("invalid-argument", `Invalid screenName: ${screenName}`);
  }

  const source = getXDiscoverySource();
  if (!source) {
    throw new HttpsError("failed-precondition", "X profile feeds are turned off.");
  }

  const fetchedAt = Date.now();
  let discovery;
  try {
    discovery = await source.findProfile(screenName, MAX_POSTS);
  } catch (error: unknown) {
    logger.error("X profile discovery failed", { error: String(error), screenName });
    throw new HttpsError("unavailable", "Could not read the X profile.");
  }
  if (!discovery) return { unavailable: true, fetchedAt };

  const posts = await loadXPostSnapshots(discovery.postIds);
  const ownPost = posts.find(
    (post) => post.author.screenName.toLowerCase() === screenName.toLowerCase(),
  );
  const found = discovery.profile;
  const handle = found?.screenName ?? ownPost?.author.screenName;
  if (!handle) return { unavailable: true, fetchedAt };

  const profile: XProfileSnapshot = {
    ...found,
    screenName: handle,
    name: found?.name ?? ownPost?.author.name ?? handle,
    profileUrl: `https://x.com/${handle}`,
    avatarUrl: found?.avatarUrl ?? ownPost?.author.avatarUrl ?? "",
    isVerified: found?.isVerified ?? ownPost?.author.isVerified ?? false,
  };

  const pinnedPostId = posts.some((post) => post.postId === discovery.pinnedPostId)
    ? discovery.pinnedPostId
    : undefined;
  return pinnedPostId
    ? { profile, posts, pinnedPostId, fetchedAt }
    : { profile, posts, fetchedAt };
});
