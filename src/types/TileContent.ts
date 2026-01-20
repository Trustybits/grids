export enum ContentType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  LINK = "link",
  EMBED = "embed",
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
