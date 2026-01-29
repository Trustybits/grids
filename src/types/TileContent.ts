export enum ContentType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  LINK = "link",
  EMBED = "embed",
  RPG = "rpg",
  SUGGESTION = "suggestion", // internal-only tile type
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

export type SuggestionAction = "text" | "media" | "link" | "embed";

export interface SuggestionContent extends TileContent {
  type: ContentType.SUGGESTION;
  action: SuggestionAction;
  icon?: string;
  label?: string;
}
