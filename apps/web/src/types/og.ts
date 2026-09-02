import type { BackgroundConfig } from "@/lib/animate/backgrounds";

export type TileAnimationType = "none" | "float" | "pulse" | "shimmer" | "tilt";

export interface OGTilePlacement {
  tileId: string;
  /** % of canvas width/height (0-100). */
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  animation?: TileAnimationType;
}

export interface OGVisibility {
  avatar: boolean;
  name: boolean;
  subtitle: boolean;
  handle: boolean;
}

export interface OGAnimationConfig {
  tileAnimation?: TileAnimationType;
  tileSpeed?: number;
  livePlay?: boolean;
}

export interface OGConfig {
  tiles: OGTilePlacement[];
  background: BackgroundConfig;
  visibility: OGVisibility;
  animation?: OGAnimationConfig;
  version: 1;
}

export const DEFAULT_OG_CONFIG: OGConfig = {
  tiles: [],
  background: {
    presetId: "linear-gradient",
    color: "#18181b",
    gradientType: "linear",
    stops: [
      { color: "#1e1b4b", offset: 0 },
      { color: "#4c1d95", offset: 100 },
    ],
    angle: 135,
    centerX: 50,
    centerY: 50,
    speed: 12,
    patternColor: "rgba(255,255,255,0.35)",
    patternBackground: "#18181b",
    patternSize: 28,
    patternStrokeWidth: 1,
    animated: false,
  },
  visibility: {
    avatar: true,
    name: true,
    subtitle: true,
    handle: true,
  },
  animation: {
    tileAnimation: "none",
    tileSpeed: 3,
    livePlay: true,
  },
  version: 1,
};

/** Canvas is the standard 1200x630 OG image aspect ratio. */
export const OG_CANVAS_WIDTH = 1200;
export const OG_CANVAS_HEIGHT = 630;

/** Center safe zone (in % of canvas width) reserved for avatar/name/handle. */
export const OG_SAFE_ZONE_START = 28;
export const OG_SAFE_ZONE_END = 72;
