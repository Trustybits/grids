export enum ContentType {
  TEXT = "text",
  SMART_TEXT = "smart_text",
  CHAT = "chat",
  IMAGE = "image",
  VIDEO = "video",
  LINK = "link",
  EMBED = "embed",
  MAP = "map",
  CAMPFIRE = "campfire",
  SUGGESTION = "suggestion", // internal-only tile type
  PROFILE = "profile",
  YOUTUBE = "youtube",
  ROADMAP_FEED = "roadmap_feed",
  MUSIC = "music",
  DOCUMENT = "document",
  X_POST = "x_post",
  X_PROFILE = "x_profile",
}

/**
 * Whether a tile's `text` field is a Tiptap document. `smart_text` is the
 * legacy name for the same content: the two tile types are being merged into
 * `text`, and existing `smart_text` tiles are read as text rather than
 * migrated, so anything that inspects text content must handle both.
 */
export const isRichTextContentType = (type: unknown): boolean =>
  type === ContentType.TEXT || type === ContentType.SMART_TEXT;

export interface TileContent {
  type: ContentType;
}

export interface TextContent extends TileContent {
  type: ContentType.TEXT;
  text: string;
  font: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textType: string;
  color: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  tileLink?: string;
  backgroundColor?: string;
}

export interface SmartTextContent extends TileContent {
  type: ContentType.SMART_TEXT;
  text: string;
  font: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textType: string;
  color: string;
  textAlign?: "left" | "center" | "right";
  tileLink?: string;
  backgroundColor?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  createdAt: number;
  authorId?: string;
}

export interface ChatContent extends TileContent {
  type: ContentType.CHAT;
  messages: ChatMessage[];
}

export interface ImageContent extends TileContent {
  type: ContentType.IMAGE;
  src: string;
  srcHash?: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  backgroundColor?: string;
  /** Chromatic color blended over the media (mix-blend-mode: color), independent of the fill. */
  overlayColor?: string;
  /** Which color treatment is active on the tile. Overlay renders only when "overlay". */
  colorMode?: "fill" | "overlay";
  tileLink?: string;
}

export interface LinkContent extends TileContent {
  type: ContentType.LINK;
  link: string;
  domain?: string;
  faviconUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaImageUrl?: string;
  metaSiteName?: string;
  customTitle?: string;
  customDescription?: string;
  customSubtitle?: string;
  linkBackgroundEnabled?: boolean;
  customImageUrl?: string;
  customImageHash?: string;
  backgroundColor?: string;
  /** Chromatic color blended over the preview image (mix-blend-mode: color), independent of the fill. */
  overlayColor?: string;
  /** Which color treatment is active on the tile. Overlay renders only when "overlay". */
  colorMode?: "fill" | "overlay";
}

export interface EmbedContent extends TileContent {
  type: ContentType.EMBED;
  src: string;
}

export interface VideoContent extends TileContent {
  type: ContentType.VIDEO;
  src: string;
  srcHash?: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  backgroundColor?: string;
  /** Chromatic color blended over the media (mix-blend-mode: color), independent of the fill. */
  overlayColor?: string;
  /** Which color treatment is active on the tile. Overlay renders only when "overlay". */
  colorMode?: "fill" | "overlay";
  tileLink?: string;
}

export type MapStyleMode =
  | "default"
  | "auto"
  | "light"
  | "dark"
  | "dawn"
  | "day"
  | "dusk"
  | "night"
  | "satellite";

export interface MapContent extends TileContent {
  type: ContentType.MAP;
  provider: "mapbox";
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  bearing: number;
  pitch: number;
  style: MapStyleMode;
  show3d: boolean;
  showClouds: boolean;
  showPlanes: boolean;
  searchQuery?: string;
  marker?: {
    lat: number;
    lng: number;
  };
}

export type AvatarShape = "circle" | "square" | "polygon";

export interface ProfileBioContent extends TileContent {
  type: ContentType.PROFILE;
  name: string;
  title: string;
  bio: string;
  avatarShape: AvatarShape;
  avatarRadius: number;
  avatarSides?: number; // polygon side count (3–8), default 6
  profilePhotoUrl?: string; // URL of the uploaded profile photo
  profilePhotoHash?: string;
  backgroundColor?: string;
}

export type SuggestionAction = "text" | "media" | "link" | "embed" | "profile";

export interface SuggestionContent extends TileContent {
  type: ContentType.SUGGESTION;
  action: SuggestionAction;
  icon?: string;
  label?: string;
}

export interface CampfireContent extends TileContent {
  type: ContentType.CAMPFIRE;
  count: number;
  highScore: number;
}

// YouTube content types: video, playlist, channel, short
export type YouTubeType = "video" | "playlist" | "channel" | "short";

// Single thumbnail entry returned by the YouTube Data API
export interface YouTubeThumbnailEntry {
  url: string;
  width?: number;
  height?: number;
}

// Thumbnail sizes available from YouTube API
export interface YouTubeThumbnails {
  default?: YouTubeThumbnailEntry; // 120x90
  medium?: YouTubeThumbnailEntry; // 320x180
  high?: YouTubeThumbnailEntry; // 480x360
  standard?: YouTubeThumbnailEntry; // 640x480
  maxres?: YouTubeThumbnailEntry; // 1280x720
}

// Individual video data for playlists
export interface YouTubePlaylistItem {
  videoId: string;
  title: string;
  thumbnails: YouTubeThumbnails;
  channelTitle: string;
  duration?: string;
  position: number;
}

// Channel data
export interface YouTubeChannelData {
  channelId: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnails: YouTubeThumbnails;
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
}

export interface YouTubeContent extends TileContent {
  type: ContentType.YOUTUBE;
  youtubeUrl: string;
  youtubeType: YouTubeType;
  youtubeId: string;

  // Common metadata
  title?: string;
  description?: string;
  thumbnails?: YouTubeThumbnails;
  publishedAt?: string;

  // Video-specific metadata
  channelTitle?: string;
  channelId?: string;
  channelThumbnail?: string;
  duration?: string; // ISO 8601 duration format (PT1H2M10S)
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  categoryId?: string;

  // Playlist-specific metadata
  itemCount?: number;
  playlistItems?: YouTubePlaylistItem[];

  // Channel-specific metadata
  channelData?: YouTubeChannelData;
  recentVideos?: YouTubePlaylistItem[];
}

// ── Music (Spotify / Apple Music) ───────────────────────────────────

export type MusicPlatform = "spotify" | "apple";

export interface MusicContent extends TileContent {
  type: ContentType.MUSIC;
  platform: MusicPlatform;
  trackId: string;
  trackType?: "track" | "album";
  trackName: string;
  artistName: string;
  albumArt: string;
  previewUrl: string;
  trackUrl: string;
  artistUrl: string;
  backgroundColor: string;
  backgroundTinted: string;
  textSubdued: string;
}

// ── X (Twitter) posts ───────────────────────────────────────────────

export interface XPostAuthor {
  name: string;
  screenName: string;
  avatarUrl: string;
  isVerified: boolean;
}

// Post text pre-split on the server so renderers never inject HTML.
export interface XPostTextSegment {
  kind: "text" | "link" | "mention" | "hashtag";
  text: string;
  href?: string;
}

export interface XPostMedia {
  type: "photo" | "video" | "gif";
  // Photo URL, or the poster frame for video/gif. X serves the video files
  // themselves only to x.com, so playback goes through X's embed iframe.
  url: string;
  width?: number;
  height?: number;
}

// Point-in-time copy of a post, captured when the tile is created.
export interface XPostSnapshot {
  postId: string;
  postUrl: string;
  author: XPostAuthor;
  text: string;
  textSegments: XPostTextSegment[];
  // Long posts arrive cut at ~280 characters; the full text lives on x.com.
  isTruncated: boolean;
  createdAt: string;
  likeCount: number;
  replyCount: number;
  media: XPostMedia[];
  // Set on replies and feed posts; the main post keeps its quote in
  // XPostContent.quotedPost. Never nested more than one level.
  quoted?: XPostSnapshot;
}

export interface XPostContent extends TileContent {
  type: ContentType.X_POST;
  postId: string;
  postUrl: string;
  post?: XPostSnapshot;
  quotedPost?: XPostSnapshot;
  // Deleted, withheld, or protected posts.
  unavailable?: boolean;
  fetchedAt?: number;
  replies?: XPostSnapshot[];
  repliesFetchedAt?: number;
}

export type XPostMetadataResponse =
  | { post: XPostSnapshot; quotedPost?: XPostSnapshot; fetchedAt: number }
  | { unavailable: true; fetchedAt: number };

export interface XPostRepliesResponse {
  replies: XPostSnapshot[];
  fetchedAt: number;
}

export interface XProfileSnapshot {
  screenName: string;
  name: string;
  profileUrl: string;
  avatarUrl: string;
  isVerified: boolean;
  bannerUrl?: string;
  bioSegments?: XPostTextSegment[];
  followersCount?: number;
  followingCount?: number;
}

export interface XProfileContent extends TileContent {
  type: ContentType.X_PROFILE;
  screenName: string;
  profileUrl: string;
  profile?: XProfileSnapshot;
  // Pinned post (if any) first, then the latest posts X shows logged-out visitors.
  posts?: XPostSnapshot[];
  pinnedPostId?: string;
  // Suspended, deleted, or protected accounts.
  unavailable?: boolean;
  fetchedAt?: number;
}

export type XProfileFeedResponse =
  | {
      profile: XProfileSnapshot;
      posts: XPostSnapshot[];
      pinnedPostId?: string;
      fetchedAt: number;
    }
  | { unavailable: true; fetchedAt: number };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// X post IDs are snowflakes: milliseconds since this epoch, shifted left 22 bits.
const X_SNOWFLAKE_EPOCH_MS = 1288834974657;
const X_SNOWFLAKE_SHIFT = 2 ** 22;

export const X_PROFILE_REFRESH_AFTER_MS = DAY_MS;

/**
 * How long a post's stored data (and its replies) stays fresh. Counts and
 * replies move fastest in a post's first days, so young posts refresh sooner.
 */
export function xPostRefreshAfterMs(postId: string, now: number): number {
  const createdAt = Math.floor(Number(postId) / X_SNOWFLAKE_SHIFT) + X_SNOWFLAKE_EPOCH_MS;
  const age = Number.isFinite(createdAt) ? now - createdAt : Infinity;
  if (age < 2 * DAY_MS) return 6 * HOUR_MS;
  if (age < 7 * DAY_MS) return DAY_MS;
  return 7 * DAY_MS;
}

export interface DocumentItem {
  id: string;
  fileName: string;
  url: string;
  hash?: string;
  mimeType?: string;
  /** First-page raster preview for PDFs; generated server-side. */
  thumbnailUrl?: string;
}

export interface DocumentsContent extends TileContent {
  type: ContentType.DOCUMENT;
  items: DocumentItem[];
  backgroundColor?: string;
  /** Chromatic color blended over the document preview (mix-blend-mode: color), independent of the fill. */
  overlayColor?: string;
  /** Which color treatment is active on the tile. Overlay renders only when "overlay". */
  colorMode?: "fill" | "overlay";
  customTitle?: string;
  customDescription?: string;
}

// ── Roadmap Feed (Notion integration) ──────────────────────────────

// The three canonical status buckets items are mapped into for display.
// Notion select values are mapped to these by the owner during setup.
export type RoadmapStatus = "backlog" | "in_progress" | "done";

// Property types that can be used as query filters when fetching from Notion.
export type RoadmapFilterableType =
  | "checkbox"
  | "select"
  | "multi_select"
  | "status";

// A single owner-configured filter applied when querying the Notion database.
// These are sent to the Cloud Function and translated into Notion API filter conditions.
export interface RoadmapQueryFilter {
  propertyName: string;
  type: RoadmapFilterableType;
  // checkbox: true | false
  // select / status: a single option name string
  // multi_select: array of option name strings (OR logic — item must have ANY of these)
  value: boolean | string | string[];
}

// A single roadmap item as returned by the fetchNotionRoadmap Cloud Function.
// This is the shape stored in the tile's local cache (refreshed on mount).
export interface RoadmapItem {
  notionPageId: string;
  title: string;
  status: RoadmapStatus;
  description?: string; // plain-text excerpt from the page body, if available
  upvoteCount: number; // value of the upvote number property on the Notion page
}

export interface RoadmapFeedContent extends TileContent {
  type: ContentType.ROADMAP_FEED;
  // Notion database ID the owner has connected this tile to.
  // Empty string means the tile is not yet connected.
  notionDatabaseId: string;
  // Name of the Notion select/status property used to derive RoadmapStatus.
  statusPropertyName: string;
  // Name of the Notion number property where upvote counts are written back.
  upvotePropertyName: string;
  // Maps raw Notion select option names → RoadmapStatus buckets.
  // e.g. { "In Review": "in_progress", "Shipped": "done" }
  statusMapping: Record<string, RoadmapStatus>;
  // Owner-configured filters applied server-side when querying Notion.
  // Only items matching all filters are fetched and shown on the roadmap.
  queryFilters?: RoadmapQueryFilter[];
  // Cached items from the last successful Notion fetch, stored so the tile
  // can render immediately on load without waiting for a network round-trip.
  cachedItems?: RoadmapItem[];
  // Unix ms timestamp of the last successful sync from Notion.
  lastSyncedAt?: number;
}

// Union type of all possible TileContent types.
// This allows Partial<AnyTileContent> to include properties from all content types,
// which is necessary for patchTileContent to work with any content property.
export type AnyTileContent =
  | TextContent
  | SmartTextContent
  | ChatContent
  | ImageContent
  | LinkContent
  | EmbedContent
  | VideoContent
  | MapContent
  | ProfileBioContent
  | SuggestionContent
  | CampfireContent
  | YouTubeContent
  | RoadmapFeedContent
  | MusicContent
  | DocumentsContent
  | XPostContent
  | XProfileContent;
