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
  handleVerticalAlignChange?: (align: string) => void;
}

export interface ColorThemableTileChild {
  handleBackgroundColorChange?: (color: string) => void;
  // Present only on tiles that support a color overlay separate from the fill
  // (image, video, link, document). Its presence drives the toolbar's
  // Fill/Overlay toggle.
  handleOverlayColorChange?: (color: string) => void;
  // Resolved current colors for the picker's Fill/Overlay targets, consistent
  // with what the tile renders (including legacy data).
  pickerFillColor?: string;
  pickerOverlayColor?: string;
  // Which color treatment is active on the tile, and a setter for the toggle.
  colorMode?: "fill" | "overlay";
  setColorMode?: (mode: "fill" | "overlay") => void;
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
