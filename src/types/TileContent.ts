export enum ContentType {
  TEXT = "text",
  CHAT = "chat",
  IMAGE = "image",
  VIDEO = "video",
  LINK = "link",
  EMBED = "embed",
  MAP = "map",
  CAMPFIRE = "campfire",
  CLICKER = "clicker",
  RPG = "rpg",
  SUGGESTION = "suggestion", // internal-only tile type
  PROFILE = "profile",
  YOUTUBE = "youtube",
  ROADMAP_FEED = "roadmap_feed",
  MUSIC = "music",
}

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
  zoom: number;
  offsetX: number;
  offsetY: number;
  backgroundColor?: string;
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
  backgroundColor?: string;
}

export interface EmbedContent extends TileContent {
  type: ContentType.EMBED;
  src: string;
}

export interface VideoContent extends TileContent {
  type: ContentType.VIDEO;
  src: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  backgroundColor?: string;
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

export interface RPGContent extends TileContent {
  type: ContentType.RPG;
  playerX: number;
  playerY: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerAttack: number;
  enemies: Array<{
    id: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    attack: number;
    type: "goblin" | "troll" | "dragon";
  }>;
  items: Array<{
    id: string;
    x: number;
    y: number;
    type: "health" | "strength" | "shield";
    collected: boolean;
  }>;
  walls: Array<[number, number]>;
  score: number;
  wave: number;
  gameState: "playing" | "won" | "lost";
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

export interface ClickerContent extends TileContent {
  type: ContentType.CLICKER;
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
  | ChatContent
  | ImageContent
  | LinkContent
  | EmbedContent
  | VideoContent
  | MapContent
  | RPGContent
  | ProfileBioContent
  | SuggestionContent
  | CampfireContent
  | ClickerContent
  | YouTubeContent
  | RoadmapFeedContent
  | MusicContent;
