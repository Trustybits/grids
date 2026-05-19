import { computed, inject, type ComputedRef } from "vue";

/**
 * Layout tier for structural layout decisions.
 * - 'mini'    : 1×1 — icon-only or absolute minimal
 * - 'compact' : small tiles (1×2, 2×1, 2×2)
 * - 'medium'  : mid-range (2×3, 3×2, 3×3)
 * - 'large'   : 3×4+, 4×3+, 4×4+
 */
export type LayoutTier = "mini" | "compact" | "medium" | "large";

/**
 * Orientation hint derived from tile aspect ratio.
 */
export type TileOrientation = "square" | "landscape" | "portrait";

/**
 * Granular visibility/layout flags returned by useTileLayout.
 * Content components read these to decide what to render.
 */
export interface TileLayoutConfig {
  w: number;
  h: number;
  tier: LayoutTier;
  orientation: TileOrientation;

  // Structural
  /** Whether to use a side-by-side (row) layout vs stacked (column) */
  useRowLayout: boolean;

  // Element visibility
  showThumbnail: boolean;
  showTitle: boolean;
  showChannel: boolean;
  showChannelAvatar: boolean;
  showStats: boolean;
  showDescription: boolean;
  showDuration: boolean;
  showPlayButton: boolean;

  // Title line clamp
  titleLineClamp: number;

  // Thumbnail sizing hint
  thumbnailQuality: "default" | "medium" | "high";
}

function resolveTier(w: number, h: number): LayoutTier {
  const area = w * h;
  if (area <= 1) return "mini";
  if (area <= 4) return "compact";
  if (area <= 9) return "medium";
  return "large";
}

function resolveOrientation(w: number, h: number): TileOrientation {
  if (w === h) return "square";
  return w > h ? "landscape" : "portrait";
}

function resolveLayout(w: number, h: number): TileLayoutConfig {
  const tier = resolveTier(w, h);
  const orientation = resolveOrientation(w, h);

  // ── Minimalist defaults ─────────────────────────────────
  // We lean toward showing less; each tier opts in as space allows.
  const config: TileLayoutConfig = {
    w,
    h,
    tier,
    orientation,
    useRowLayout: false,
    showThumbnail: true,
    showTitle: false,
    showChannel: false,
    showChannelAvatar: false,
    showStats: false,
    showDescription: false,
    showDuration: false,
    showPlayButton: false,
    titleLineClamp: 1,
    thumbnailQuality: "medium",
  };

  // ── Mini (1×1) ────────────────────────────────────────────
  if (tier === "mini") {
    config.thumbnailQuality = "default";
    return config;
  }

  // ── Compact (area ≤ 4: 1×2, 2×1, 1×3, 3×1, 1×4, 2×2) ──
  if (tier === "compact") {
    config.thumbnailQuality = "default";
    config.showTitle = h >= 2 || w >= 3;
    config.titleLineClamp = 1;

    // Wide/banner shapes: row layout with thumbnail on left
    if (w >= 3 && h === 1) {
      config.useRowLayout = true;
    }

    return config;
  }

  // ── Medium (area ≤ 9: 2×3, 3×2, 3×3, 2×4, 4×2, etc.) ───
  if (tier === "medium") {
    config.showTitle = true;
    config.showChannel = true;
    config.showDuration = true;
    config.thumbnailQuality = "medium";
    config.titleLineClamp = 2;

    // Wide medium: side-by-side layout
    if (w >= 3 && h <= 2) {
      config.useRowLayout = true;
      config.titleLineClamp = 1;
    }

    return config;
  }

  // ── Large (area > 9: 3×4, 4×3, 4×4, etc.) ───────────────
  config.showTitle = true;
  config.showChannel = true;
  config.showChannelAvatar = true;
  config.showDuration = true;
  config.showStats = h >= 4;
  config.showDescription = h >= 5;
  config.thumbnailQuality = "high";
  config.titleLineClamp = 2;

  return config;
}

/**
 * Composable that provides granular layout flags based on tile dimensions.
 * Reads gridTileW / gridTileH from the provide/inject context set by GridTile.
 *
 * Usage inside a tile content component:
 *   const layout = useTileLayout();
 *   // layout.value.showTitle, layout.value.tier, etc.
 */
export function useTileLayout() {
  const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
  const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);

  return computed<TileLayoutConfig>(() => {
    const w = gridTileW?.value ?? 2;
    const h = gridTileH?.value ?? 2;
    return resolveLayout(w, h);
  });
}
