import type { Component } from "vue";
import type { ContentType, Tile, TileContent } from "@grids/contracts/types";
import type { ToolbarButton, ToolbarContext } from "./TileToolbar";

export type TileCategory =
  | "media"
  | "text"
  | "social"
  | "embed"
  | "utility"
  | "game";

export type TileEditMode =
  | "richtext"
  | "crop"
  | "fields"
  | "interactive"
  | "composer"
  | "settings"
  | "none";

export interface TileDefinition<T extends TileContent = TileContent> {
  type: ContentType;

  // ─── Metadata ───
  label: string;
  icon?: Component;
  category?: TileCategory;
  featureFlag?: string;

  // ─── Component ───
  component: () => Promise<{ default: Component }>;
  headerComponent?: (() => Promise<{ default: Component }>) | null;

  // ─── Defaults & Validation ───
  defaultContent: (data?: Partial<T>) => T;
  validate: (content: T) => boolean;
  defaultSize?: { w: number; h: number };

  // ─── Capabilities (shell behavior flags) ───
  capabilities: {
    caption?: boolean;
    duplicate?: boolean;
    border?: boolean;
    tileLink?: boolean;
    resizable?: boolean;
  };

  // ─── Color Theming ───
  colorTheming?: {
    backgroundColor?: boolean;
    textColor?: boolean;
  };

  // ─── Edit Mode ───
  editMode?: TileEditMode;

  // ─── Actions (drives TileActions.vue) ───
  actions?: {
    copyContent?: (content: T) => string | null;
    downloadUrl?: (content: T) => string | null;
    externalUrl?: (content: T) => string | null;
  };

  // ─── Toolbar ───
  toolbar?: ToolbarButton[] | ((ctx: ToolbarContext) => ToolbarButton[]);

  // ─── Props & Injection ───
  extraProps?: (tile: Tile) => Record<string, unknown>;

  // ─── Constraints ───
  maxPerGrid?: number;

  // ─── URL Detection (paste/embed routing) ───
  matchUrl?: (url: string) => boolean;
  parseUrl?: (url: string) => Partial<T>;
}
