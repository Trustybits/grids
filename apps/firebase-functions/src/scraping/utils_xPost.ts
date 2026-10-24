import type {
  XPostMedia,
  XPostSnapshot,
  XPostTextSegment,
} from "@grids/contracts/types";

// ── X post syndication data ─────────────────────────────────────────
//
// cdn.syndication.twimg.com/tweet-result is undocumented. It is the endpoint
// X's own embed iframe (platform.twitter.com/embed/Tweet.html) reads, and it
// needs no API key — only a token derived from the post ID.

interface SyndicationEntity {
  indices?: [number, number];
}

interface SyndicationUrlEntity extends SyndicationEntity {
  url: string;
  expanded_url?: string;
  display_url?: string;
}

interface SyndicationMentionEntity extends SyndicationEntity {
  screen_name: string;
}

interface SyndicationHashtagEntity extends SyndicationEntity {
  text: string;
}

interface SyndicationUser {
  name?: string;
  screen_name?: string;
  profile_image_url_https?: string;
  is_blue_verified?: boolean;
  verified?: boolean;
}

interface SyndicationMediaDetail {
  type?: string;
  media_url_https?: string;
  original_info?: { width?: number; height?: number };
}

export interface SyndicationPost {
  __typename?: string;
  id_str?: string;
  text?: string;
  display_text_range?: [number, number];
  entities?: {
    urls?: SyndicationUrlEntity[];
    user_mentions?: SyndicationMentionEntity[];
    hashtags?: SyndicationHashtagEntity[];
    media?: SyndicationUrlEntity[];
  };
  user?: SyndicationUser;
  created_at?: string;
  favorite_count?: number;
  conversation_count?: number;
  reply_count?: number;
  mediaDetails?: SyndicationMediaDetail[];
  note_tweet?: unknown;
  quoted_tweet?: SyndicationPost;
}

export const POST_ID_PATTERN = /^\d{1,25}$/;
export const SCREEN_NAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

export function syndicationToken(postId: string): string {
  return ((Number(postId) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, "");
}

export function syndicationUrl(postId: string): string {
  const params = new URLSearchParams({
    id: postId,
    lang: "en",
    token: syndicationToken(postId),
  });
  return `https://cdn.syndication.twimg.com/tweet-result?${params.toString()}`;
}

// ── Text segmentation ───────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity]);
}

interface EntitySpan {
  start: number;
  end: number;
  // null drops the span from the rendered text (media links).
  segment: XPostTextSegment | null;
}

function sameToken(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Entity indices count code points, and X computes them on text that may
 * differ from what it sends by HTML escaping. Trust the indices when the
 * slice matches the expected token; otherwise use the nearest occurrence.
 */
function locate(
  chars: string[],
  token: string,
  indices: [number, number] | undefined,
): { start: number; end: number } | null {
  const tokenLength = Array.from(token).length;
  if (indices) {
    const [start, end] = indices;
    if (sameToken(chars.slice(start, end).join(""), token)) {
      return { start, end };
    }
  }

  const hint = indices?.[0] ?? 0;
  let best: { start: number; end: number } | null = null;
  for (let start = 0; start + tokenLength <= chars.length; start++) {
    if (!sameToken(chars.slice(start, start + tokenLength).join(""), token)) continue;
    if (!best || Math.abs(start - hint) < Math.abs(best.start - hint)) {
      best = { start, end: start + tokenLength };
    }
  }
  return best;
}

function collectEntitySpans(post: SyndicationPost, chars: string[]): EntitySpan[] {
  const entities = post.entities ?? {};
  const spans: EntitySpan[] = [];

  const add = (
    token: string,
    indices: [number, number] | undefined,
    toSegment: (matched: string) => XPostTextSegment | null,
  ) => {
    const found = locate(chars, token, indices);
    if (!found) return;
    const matched = chars.slice(found.start, found.end).join("");
    spans.push({ ...found, segment: toSegment(matched) });
  };

  for (const url of entities.urls ?? []) {
    add(url.url, url.indices, () => ({
      kind: "link",
      text: url.display_url || url.expanded_url || url.url,
      href: url.expanded_url || url.url,
    }));
  }
  for (const media of entities.media ?? []) {
    add(media.url, media.indices, () => null);
  }
  for (const mention of entities.user_mentions ?? []) {
    add(`@${mention.screen_name}`, mention.indices, (matched) => ({
      kind: "mention",
      text: matched,
      href: `https://x.com/${mention.screen_name}`,
    }));
  }
  for (const hashtag of entities.hashtags ?? []) {
    add(`#${hashtag.text}`, hashtag.indices, (matched) => ({
      kind: "hashtag",
      text: matched,
      href: `https://x.com/hashtag/${encodeURIComponent(hashtag.text)}`,
    }));
  }

  return spans.sort((a, b) => a.start - b.start);
}

export function buildTextSegments(post: SyndicationPost): XPostTextSegment[] {
  const chars = Array.from(decodeHtmlEntities(post.text ?? ""));
  const [rangeStart, rangeEnd] = post.display_text_range ?? [0, chars.length];
  const end = Math.min(rangeEnd, chars.length);
  const segments: XPostTextSegment[] = [];

  const pushText = (from: number, to: number) => {
    if (to <= from) return;
    segments.push({ kind: "text", text: chars.slice(from, to).join("") });
  };

  let cursor = rangeStart;
  for (const span of collectEntitySpans(post, chars)) {
    if (span.start < cursor || span.end > end) continue;
    pushText(cursor, span.start);
    if (span.segment) segments.push(span.segment);
    cursor = span.end;
  }
  pushText(cursor, end);

  const first = segments[0];
  if (first?.kind === "text") first.text = first.text.trimStart();
  const last = segments[segments.length - 1];
  if (last?.kind === "text") last.text = last.text.trimEnd();
  return segments.filter((segment) => segment.text.length > 0);
}

// ── Snapshot mapping ────────────────────────────────────────────────

function toMedia(detail: SyndicationMediaDetail): XPostMedia[] {
  const url = detail.media_url_https;
  const type =
    detail.type === "photo"
      ? "photo"
      : detail.type === "video"
        ? "video"
        : detail.type === "animated_gif"
          ? "gif"
          : null;
  if (!url || !type) return [];

  const media: XPostMedia = { type, url };
  if (detail.original_info?.width) media.width = detail.original_info.width;
  if (detail.original_info?.height) media.height = detail.original_info.height;
  return [media];
}

// X serves the 48px "_normal" avatar variant by default.
export function largerAvatar(url: string): string {
  return url.replace(/_normal(\.\w+)$/, "_400x400$1");
}

export function toXPostSnapshot(post: SyndicationPost | undefined): XPostSnapshot | null {
  const screenName = post?.user?.screen_name;
  if (!post?.id_str || typeof post.text !== "string" || !screenName) return null;

  const textSegments = buildTextSegments(post);
  return {
    postId: post.id_str,
    postUrl: `https://x.com/${screenName}/status/${post.id_str}`,
    author: {
      name: post.user?.name || screenName,
      screenName,
      avatarUrl: largerAvatar(post.user?.profile_image_url_https ?? ""),
      isVerified: !!(post.user?.is_blue_verified || post.user?.verified),
    },
    text: textSegments.map((segment) => segment.text).join(""),
    textSegments,
    isTruncated: post.note_tweet != null,
    createdAt: post.created_at ?? "",
    likeCount: post.favorite_count ?? 0,
    replyCount: post.conversation_count ?? post.reply_count ?? 0,
    media: (post.mediaDetails ?? []).flatMap(toMedia),
  };
}
