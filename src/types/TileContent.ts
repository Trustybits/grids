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
  textLink?: string;
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
}

export type MapStyleMode =
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
    type: 'goblin' | 'troll' | 'dragon';
  }>;
  items: Array<{
    id: string;
    x: number;
    y: number;
    type: 'health' | 'strength' | 'shield';
    collected: boolean;
  }>;
  walls: Array<[number, number]>;
  score: number;
  wave: number;
  gameState: 'playing' | 'won' | 'lost';
}

export type AvatarShape = "circle" | "square" | "hex";

export interface ProfileBioContent extends TileContent {
  type: ContentType.PROFILE;
  name: string;
  title: string;
  bio: string;
  avatarSrc: string;
  avatarShape: AvatarShape;
  avatarRadius: number;
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
