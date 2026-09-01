/**
 * Text-tile styling options offered by the UI.
 *
 * These lists were previously inlined in the desktop selectors, one copy each.
 * Mobile 2.0's `/EDIT` sheet offers the same choices, so they live here instead
 * — a font added for one surface has to appear on the other, and a shared list
 * is the only version of that which cannot drift.
 *
 * Values are what `TileChildComponent.handleFontChange` /
 * `handleFontSizeChange` receive, and are also the visible labels.
 */

export const FONT_FAMILIES = [
  "Inter",
  "Times New Roman",
  "Geist Mono",
  "Lobster",
] as const;

export type FontFamilyOption = (typeof FONT_FAMILIES)[number];

export const FONT_SIZES = ["Small", "Medium", "Large", "Larger"] as const;

export type FontSizeOption = (typeof FONT_SIZES)[number];

export const DEFAULT_FONT_SIZE: FontSizeOption = "Medium";

/**
 * Resolve free-form stored text to a known size, case-insensitively. Content
 * predating the current list (or written by another surface) falls back to the
 * default rather than leaving the control with nothing selected.
 */
export function normalizeFontSize(
  value: string | undefined | null,
): FontSizeOption {
  const normalized = value?.trim().toLowerCase();
  return (
    FONT_SIZES.find((size) => size.toLowerCase() === normalized) ??
    DEFAULT_FONT_SIZE
  );
}

export const HORIZONTAL_ALIGNMENTS = ["left", "center", "right"] as const;

export type HorizontalAlignment = (typeof HORIZONTAL_ALIGNMENTS)[number];

export const VERTICAL_ALIGNMENTS = ["top", "center", "bottom"] as const;

export type VerticalAlignment = (typeof VERTICAL_ALIGNMENTS)[number];
