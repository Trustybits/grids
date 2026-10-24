import * as logger from "firebase-functions/logger";
import type { XPostSnapshot } from "@grids/contracts/types";
import {
  syndicationUrl,
  toXPostSnapshot,
  type SyndicationPost,
} from "./utils_xPost.js";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept,
        "accept-language": "en-US,en;q=0.9",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchSyndicationPost(postId: string): Promise<Response> {
  return fetchWithTimeout(syndicationUrl(postId), "application/json");
}

/** Fetches a logged-out x.com page, e.g. `/ann_nnng` or `/ann_nnng/status/1`. */
export function fetchXPage(path: string): Promise<Response> {
  return fetchWithTimeout(`https://x.com${path}`, "text/html");
}

async function loadOne(postId: string): Promise<XPostSnapshot | null> {
  try {
    const response = await fetchSyndicationPost(postId);
    if (!response.ok) return null;
    const body = (await response.json()) as SyndicationPost;
    const post = toXPostSnapshot(body);
    if (!post) return null;
    const quoted = toXPostSnapshot(body.quoted_tweet);
    return quoted ? { ...post, quoted } : post;
  } catch (error: unknown) {
    logger.warn("Failed to load X post", { error: String(error), postId });
    return null;
  }
}

/**
 * Rebuilds each post from X's embed syndication feed, in the order given.
 * Posts that are deleted, protected, or fail to load are left out.
 */
export async function loadXPostSnapshots(postIds: string[]): Promise<XPostSnapshot[]> {
  const posts = await Promise.all(postIds.map(loadOne));
  return posts.filter((post): post is XPostSnapshot => post !== null);
}
