import { type TileContent } from './TileContent';

export type Breakpoint = 'lg' | 'md' | 'sm';

export interface TilePosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Tile {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  borderEnabled?: boolean;
  caption: string;
  content: TileContent;
}

// ─── Composition interfaces ────────────────────────────────────────
// Each interface represents a capability group. Content components
// implement only the interfaces that match their behavior.

export interface TileChildBase {
  onShortClick?: (event: MouseEvent) => void;
  onExitClick?: () => void;
  onResize?: () => void;
  isEditing?: boolean;
}

export interface CroppableTileChild {
  toggleEditMode?: () => void;
  isEditing?: boolean;
}

export interface MapTileChild {
  toggleEditMode?: () => void;
  isEditing?: boolean;
  useMyLocation?: () => void;
  handleSearch?: () => void;
  searchInput?: string;
  togglePlanes?: () => void;
  showPlanes?: boolean;
  recenterOnMarker?: () => void;
  toggleDefaultStyle?: () => void;
  isDefaultStyle?: boolean;
  toggleClouds?: () => void;
  showClouds?: boolean;
}

export interface LinkableTileChild {
  clearLink?: () => void;
  openUrlInput?: () => void;
}

export interface LinkTileChild {
  openCustomImagePicker?: () => void;
  removeImage?: () => void;
  applyImageUrlFromToolbar?: (url: string) => void;
  content?: { customImageUrl?: string };
}

export interface TextEditableTileChild {
  isBoldActive?: boolean;
  toggleBold?: () => void;
  isItalicActive?: boolean;
  toggleItalic?: () => void;
  getCurrentFont?: () => string;
  handleFontChange?: (font: string) => void;
  getCurrentFontSize?: () => string;
  handleFontSizeChange?: (size: string) => void;
  handleTextAlignChange?: (align: string) => void;
}

export interface ColorThemableTileChild {
  handleBackgroundColorChange?: (color: string) => void;
}

// ─── Composite type ────────────────────────────────────────────────
// Used by Tile.vue and TileToolbar — the full superset of all
// capabilities. All members remain optional so callers use ?. access.

export type TileChildComponent =
  TileChildBase &
  Partial<CroppableTileChild> &
  Partial<MapTileChild> &
  Partial<LinkableTileChild> &
  Partial<LinkTileChild> &
  Partial<TextEditableTileChild> &
  Partial<ColorThemableTileChild>;
