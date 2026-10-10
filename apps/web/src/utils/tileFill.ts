/**
 * Tile fill / overlay rules as pure functions.
 *
 * The color picker (`useColorPicker`) and the phone toolbars both write a
 * tile's fill. Before, the rules lived inside the picker composable, which only
 * a mounted tile could run — so nothing could recolor a tile it hadn't
 * mounted, and a bulk edit across tiles had no way in. Here the read side
 * answers "what does the picker show as current" and the write side returns a
 * content patch; callers send the patch through the controller themselves.
 *
 * The legacy cases matter: older image/video tiles stored their blend tint in
 * `backgroundColor`, and link/document tiles tinted their preview with the
 * fill. Those interpretations are kept until the user first edits a color,
 * which then persists an explicit `overlayColor` and settles the ambiguity.
 */

import { ContentType } from "@grids/contracts/types";

export interface FillOptions {
  /**
   * The tile renders a `mix-blend-mode: color` overlay fed by `overlayColor`,
   * so the picker offers a separate Overlay target.
   */
  overlayCapable?: boolean;
  /**
   * Legacy media tiles (image/video) stored the blend tint in
   * `backgroundColor`: a chromatic value there reads as the overlay (and the
   * fill as default) until an explicit `overlayColor` is chosen.
   */
  legacyBackgroundAsOverlay?: boolean;
  /**
   * Legacy preview tiles (link/document) tinted their preview with the fill: a
   * chromatic `backgroundColor` also drives the overlay until an explicit
   * `overlayColor` is chosen, while the fill keeps its color.
   */
  legacyBackgroundAlsoOverlay?: boolean;
}

/** The content fields fill/overlay reads and writes. */
export interface FillContent {
  backgroundColor?: string;
  overlayColor?: string;
  colorMode?: "fill" | "overlay";
}

/**
 * Tile types whose fill the user can set, and how each stores it. One table,
 * read by the tiles' own pickers and by the phone toolbars, so both surfaces
 * offer the same set with the same rules.
 */
const FILL_OPTIONS_BY_TYPE: Partial<Record<ContentType, FillOptions>> = {
  [ContentType.TEXT]: {},
  [ContentType.SMART_TEXT]: {},
  [ContentType.PROFILE]: {},
  [ContentType.IMAGE]: {
    overlayCapable: true,
    legacyBackgroundAsOverlay: true,
  },
  [ContentType.VIDEO]: {
    overlayCapable: true,
    legacyBackgroundAsOverlay: true,
  },
  [ContentType.LINK]: {
    overlayCapable: true,
    legacyBackgroundAlsoOverlay: true,
  },
  [ContentType.DOCUMENT]: {
    overlayCapable: true,
    legacyBackgroundAlsoOverlay: true,
  },
};

/** Fill rules for a tile type, or `null` when the type has no fill. */
export function fillOptionsFor(type: ContentType | string): FillOptions | null {
  return FILL_OPTIONS_BY_TYPE[type as ContentType] ?? null;
}

const STRUCTURAL_COLORS = new Set([
  "var(--color-tile-background)",
  "var(--color-light-100)",
  "var(--color-dark-0)",
  "var(--color-content-background)",
]);

/** Default / light / dark / no-fill — values that mean "no tint". */
export const isStructuralColor = (color: string): boolean =>
  STRUCTURAL_COLORS.has(color);

/**
 * The remembered overlay tint, whether or not the overlay is the active
 * treatment. Resolves the legacy reading of a chromatic `backgroundColor`.
 */
export function resolveOverlayColor(
  content: FillContent,
  options: FillOptions,
): string | null {
  if (!options.overlayCapable) return null;

  const explicit = content.overlayColor;
  if (explicit !== undefined) {
    // Explicitly set (possibly "" to clear). Empty or structural = none.
    if (!explicit || isStructuralColor(explicit)) return null;
    return explicit;
  }

  const bg = content.backgroundColor;
  if (
    bg &&
    !isStructuralColor(bg) &&
    (options.legacyBackgroundAsOverlay || options.legacyBackgroundAlsoOverlay)
  ) {
    return bg;
  }
  return null;
}

/**
 * The active treatment. Data without an explicit mode (older grids) reads as
 * overlay when a tint exists, otherwise fill.
 */
export function resolveColorMode(
  content: FillContent,
  options: FillOptions,
): "fill" | "overlay" {
  const mode = content.colorMode;
  if (mode === "fill" || mode === "overlay") return mode;
  return resolveOverlayColor(content, options) ? "overlay" : "fill";
}

/** Whether a legacy media tile's chromatic background is really its tint. */
function backgroundIsLegacyTint(
  content: FillContent,
  options: FillOptions,
): boolean {
  const bg = content.backgroundColor;
  return (
    !!options.legacyBackgroundAsOverlay &&
    content.overlayColor === undefined &&
    !!bg &&
    !isStructuralColor(bg)
  );
}

/**
 * The fill the picker shows as current. Empty while a legacy chromatic
 * background is actually rendering as a tint, so Fill reads as "none".
 */
export function readPickerFill(
  content: FillContent,
  options: FillOptions,
): string {
  if (backgroundIsLegacyTint(content, options)) return "";
  return content.backgroundColor ?? "";
}

/** The overlay the picker shows as current — the remembered tint. */
export function readPickerOverlay(
  content: FillContent,
  options: FillOptions,
): string {
  return resolveOverlayColor(content, options) ?? "";
}

/** The raw stored fill, with a legacy tint read as "default" instead. */
export function storedFillColor(
  content: FillContent,
  options: FillOptions,
): string | undefined {
  return backgroundIsLegacyTint(content, options)
    ? undefined
    : content.backgroundColor;
}

/** Patch that sets the fill color (and makes fill the active treatment). */
export function fillPatch(
  content: FillContent,
  color: string,
  options: FillOptions,
): FillContent {
  const patch: FillContent = { backgroundColor: color };
  // Only overlay-capable tiles carry a mode.
  if (options.overlayCapable) patch.colorMode = "fill";

  // Legacy image/video: settle the ambiguity on first edit by persisting an
  // explicit overlayColor — promoting any pre-existing chromatic tint, or
  // marking "no overlay" ("") — so the fill is never re-read as a tint.
  if (
    options.legacyBackgroundAsOverlay &&
    content.overlayColor === undefined
  ) {
    const bg = content.backgroundColor;
    patch.overlayColor = bg && !isStructuralColor(bg) ? bg : "";
  }
  return patch;
}

/** Patch that sets the overlay tint (and makes overlay the active one). */
export function overlayPatch(
  content: FillContent,
  color: string,
  options: FillOptions,
): FillContent {
  // Structural picks (default / light / dark / no-fill) clear the overlay.
  const patch: FillContent = {
    overlayColor: isStructuralColor(color) ? "" : color,
    colorMode: "overlay",
  };

  // Legacy image/video: the chromatic backgroundColor was actually the tint.
  // Now the overlay is explicit, clear it so it isn't re-read as a fill.
  if (backgroundIsLegacyTint(content, options)) {
    patch.backgroundColor = "";
  }
  return patch;
}

/** Patch that switches the active treatment without losing either color. */
export function colorModePatch(mode: "fill" | "overlay"): FillContent {
  return { colorMode: mode };
}
