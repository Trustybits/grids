// Pure decision logic for the text tile's vertical alignment.
//
// Vertical alignment only has a clear meaning when the text fits the tile.
// When it doesn't, behaviour depends on the tile's shape:
//   - Taller tiles scroll, so overflowing text is anchored to the top
//     (centered/bottom flex content would clip its top edge and become
//     unreachable when scrolling).
//   - Single-row (N×1) tiles never scroll. There, an oversized line box makes
//     top/bottom alignment read as inverted (the glyph sits in the middle of a
//     line box taller than the row), so center is the only correct option —
//     it's forced and the toolbar disables the top/bottom buttons.
//
// This module is shared by TextContent.vue (rendering) and TextAlignPanel.vue
// (the toolbar) so both derive the behaviour from one source of truth.

export type VerticalAlign = "top" | "center" | "bottom";
export type JustifyContent = "flex-start" | "center" | "flex-end";

export interface VerticalAlignInput {
  /** The stored, user-chosen vertical alignment. */
  verticalAlign: VerticalAlign;
  /** True when the tile is a single row wider than it is tall (N×1). */
  isWideOneHigh: boolean;
  /** True when the rendered text is taller than the available tile height. */
  isTextOverflowing: boolean;
}

/** N×1 tiles clip; every other shape scrolls when text overflows. */
export function allowsOverflowScroll(isWideOneHigh: boolean): boolean {
  return !isWideOneHigh;
}

/** Overflow that should be handled by scrolling (top-anchored), not clipping. */
export function isScrollableOverflow(
  isWideOneHigh: boolean,
  isTextOverflowing: boolean,
): boolean {
  return isTextOverflowing && allowsOverflowScroll(isWideOneHigh);
}

/**
 * On an N×1 tile, oversized text forces center alignment and the toolbar
 * disables the top/bottom buttons. False for every other shape.
 */
export function shouldDisableTopBottomAlign(
  isWideOneHigh: boolean,
  isTextOverflowing: boolean,
): boolean {
  return isWideOneHigh && isTextOverflowing;
}

/** Resolve the CSS `justify-content` value that positions the text vertically. */
export function resolveVerticalAlignJustify({
  verticalAlign,
  isWideOneHigh,
  isTextOverflowing,
}: VerticalAlignInput): JustifyContent {
  // Scrollable overflow stays top-anchored so the start of the text is reachable.
  if (isScrollableOverflow(isWideOneHigh, isTextOverflowing)) return "flex-start";
  // Oversized N×1 text is centered (top/bottom would look inverted).
  if (shouldDisableTopBottomAlign(isWideOneHigh, isTextOverflowing)) return "center";

  switch (verticalAlign) {
    case "center":
      return "center";
    case "bottom":
      return "flex-end";
    default:
      return "flex-start";
  }
}

/**
 * The alignment the toolbar should highlight as active. While the ends are
 * disabled the tile renders centered, so center is shown regardless of the
 * stored value (which is preserved so it returns when the tile grows again).
 */
export function resolveActiveVerticalAlign(
  stored: VerticalAlign,
  endsDisabled: boolean,
): VerticalAlign {
  return endsDisabled ? "center" : stored;
}
