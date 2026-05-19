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

export interface TileChildComponent {
  onShortClick?: (event: MouseEvent) => void;
  onExitClick?: () => void;
  onResize?: () => void;
  toggleEditMode?: () => void;
  isEditing?: boolean;
  useMyLocation?: () => void;
  handleSearch?: () => void;
  applyImageUrlFromToolbar?: (url: string) => void;
  searchInput?: string;
  content?: { customImageUrl?: string };

  // Map tile
  togglePlanes?: () => void;
  showPlanes?: boolean;
  recenterOnMarker?: () => void;
  toggleDefaultStyle?: () => void;
  isDefaultStyle?: boolean;
  toggleClouds?: () => void;
  showClouds?: boolean;

  // Link / image tile
  clearLink?: () => void;
  openUrlInput?: () => void;
  openCustomImagePicker?: () => void;
  removeImage?: () => void;

  // Text tile
  isBoldActive?: boolean;
  toggleBold?: () => void;
  isItalicActive?: boolean;
  toggleItalic?: () => void;

  // Color picker
  handleBackgroundColorChange?: (color: string) => void;

  // Font selector
  getCurrentFont?: () => string;
  handleFontChange?: (font: string) => void;

  // Font size selector
  getCurrentFontSize?: () => string;
  handleFontSizeChange?: (size: string) => void;

  // Text align
  handleTextAlignChange?: (align: string) => void;
}
