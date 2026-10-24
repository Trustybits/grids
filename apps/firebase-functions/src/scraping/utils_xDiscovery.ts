import * as logger from "firebase-functions/logger";
import type { XProfileSnapshot } from "@grids/contracts/types";
import { buildTextSegments, largerAvatar } from "./utils_xPost.js";
import { fetchXPage } from "./utils_xFetch.js";

// ── Discovery sources ───────────────────────────────────────────────
//
// Discovery only answers "which posts?" — every post it names is rebuilt
// from the embed syndication feed, so stored tile data has one shape no
// matter where the IDs came from. The page source reads the data x.com
// embeds in pages served to logged-out visitors. A paid X API source
// (conversation_id search for replies, the user-posts endpoint for
// timelines) can implement the same interface when the page source is
// blocked; select it with X_DISCOVERY_SOURCE.

export interface XProfileDiscovery {
  postIds: string[];
  pinnedPostId?: string;
  // Header details the source found; the caller fills gaps from the posts.
  profile: Partial<XProfileSnapshot> | null;
}

export interface XDiscoverySource {
  findReplyIds(postId: string, screenName: string, limit: number): Promise<string[]>;
  /** Resolves null when the account doesn't exist or can't be read. */
  findProfile(screenName: string, limit: number): Promise<XProfileDiscovery | null>;
}

// ── Page data parsing ───────────────────────────────────────────────
//
// x.com streams its GraphQL results into the page as JavaScript string
// literals, so the JSON arrives with one extra level of escaping.

export function decodePageData(html: string): string {
  return html.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\s\S])/g, (_, escape: string) => {
    if (escape.length === 3 && escape[0] === "x") {
      return String.fromCharCode(parseInt(escape.slice(1), 16));
    }
    if (escape.length === 5 && escape[0] === "u") {
      return String.fromCharCode(parseInt(escape.slice(1), 16));
    }
    return escape;
  });
}

/** Parses the JSON object or array that starts at `start`, or null. */
export function readJsonValue(text: string, start: number): unknown {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;

  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function uniqueIds(data: string, pattern: RegExp, excludeId?: string): string[] {
  const ids: string[] = [];
  for (const match of data.matchAll(pattern)) {
    const id = match[1];
    if (id !== excludeId && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Reply thread entries on a post page, in the order X ranks them. */
export function extractReplyIds(data: string, postId: string): string[] {
  return uniqueIds(data, /"entry_id":"conversationthread-(\d+)"/g, postId);
}

/** Post entries on a profile page: the pinned post, then the latest posts. */
export function extractTimelineIds(data: string): string[] {
  return uniqueIds(data, /"entry_id":"(?:[a-z-]+\d+-)?tweet-(\d+)"/g);
}

export function extractPinnedPostId(data: string): string | undefined {
  const pin = data.indexOf('"TimelinePinEntry"');
  if (pin < 0) return undefined;
  const match = /"tweet_results":\{"id":"[^"]*","rest_id":"(\d+)"/.exec(data.slice(pin));
  return match?.[1];
}

interface PageUrlEntity {
  url: string;
  expanded_url?: string;
  display_url?: string;
  indices?: [number, number];
}

interface PageUser {
  avatar?: { image_url?: string };
  banner?: { image_url?: string };
  core?: { name?: string; screen_name?: string };
  profile_bio?: {
    description?: string;
    entities?: { description?: { urls?: PageUrlEntity[] } };
  };
  relationship_counts?: { followers?: number; following?: number };
  verification?: { is_blue_verified?: boolean };
}

const USER_MARKER = '{"__typename":"User"';

/**
 * The profile owner's user object. Keys arrive sorted, so every user object
 * opens with its __typename; the owner's is the one with follower counts.
 */
export function extractProfile(
  data: string,
  screenName: string,
): Partial<XProfileSnapshot> | null {
  const wanted = screenName.toLowerCase();
  for (let start = data.indexOf(USER_MARKER); start >= 0; start = data.indexOf(USER_MARKER, start + 1)) {
    const user = readJsonValue(data, start) as PageUser | null;
    const handle = user?.core?.screen_name;
    if (!user || handle?.toLowerCase() !== wanted || !user.relationship_counts) continue;

    const profile: Partial<XProfileSnapshot> = {
      screenName: handle,
      name: user.core?.name || handle,
      profileUrl: `https://x.com/${handle}`,
      isVerified: !!user.verification?.is_blue_verified,
    };
    if (user.avatar?.image_url) profile.avatarUrl = largerAvatar(user.avatar.image_url);
    const banner = user.banner?.image_url;
    if (banner) profile.bannerUrl = /\/\d+$/.test(banner) ? `${banner}/1500x500` : banner;
    if (typeof user.relationship_counts.followers === "number") {
      profile.followersCount = user.relationship_counts.followers;
    }
    if (typeof user.relationship_counts.following === "number") {
      profile.followingCount = user.relationship_counts.following;
    }
    const bio = user.profile_bio?.description;
    if (bio) {
      profile.bioSegments = buildTextSegments({
        text: bio,
        entities: { urls: user.profile_bio?.entities?.description?.urls ?? [] },
      });
    }
    return profile;
  }
  return null;
}

// ── Page source ─────────────────────────────────────────────────────

async function readPage(path: string): Promise<string | null> {
  const response = await fetchXPage(path);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`x.com returned ${response.status} for ${path}`);
  }
  return decodePageData(await response.text());
}

export const pageDiscoverySource: XDiscoverySource = {
  async findReplyIds(postId, screenName, limit) {
    const data = await readPage(`/${screenName}/status/${postId}`);
    return data ? extractReplyIds(data, postId).slice(0, limit) : [];
  },

  async findProfile(screenName, limit) {
    const data = await readPage(`/${screenName}`);
    if (!data) return null;

    const profile = extractProfile(data, screenName);
    const postIds = extractTimelineIds(data).slice(0, limit);
    if (!profile && postIds.length === 0) return null;
    return { profile, postIds, pinnedPostId: extractPinnedPostId(data) };
  },
};

export function getXDiscoverySource(): XDiscoverySource | null {
  const name = process.env.X_DISCOVERY_SOURCE || "page";
  if (name === "page") return pageDiscoverySource;
  if (name !== "off") {
    logger.error("Unknown X_DISCOVERY_SOURCE; X discovery is off", { name });
  }
  return null;
}
