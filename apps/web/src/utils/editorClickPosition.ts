interface PointerCoords {
  left: number;
  top: number;
}

/** The slice of ProseMirror's EditorView this module needs. */
interface PositionLookup {
  posAtCoords(coords: PointerCoords): { pos: number } | null;
}

/**
 * Screen coordinates of the gesture that produced a tile short-click.
 *
 * Mouse clicks arrive as the grid's `pointerdown` event; taps arrive as the
 * tile's `touchend`, where the lifted finger only appears in `changedTouches`.
 */
export function getShortClickCoords(
  event: MouseEvent | TouchEvent | null | undefined,
): PointerCoords | null {
  if (!event) return null;

  if ("changedTouches" in event) {
    const touch = event.changedTouches?.[0];
    return touch ? { left: touch.clientX, top: touch.clientY } : null;
  }

  const { clientX, clientY } = event;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  return { left: clientX, top: clientY };
}

/**
 * Document position under the gesture that opened an editor, so the caret can
 * land where the user clicked instead of at the end of the text. Returns null
 * when the click was outside the text (tile padding, empty space), leaving the
 * caller to fall back to its default focus position.
 */
export function resolveShortClickPosition(
  view: PositionLookup | null | undefined,
  event: MouseEvent | TouchEvent | null | undefined,
): number | null {
  const coords = getShortClickCoords(event);
  if (!view || !coords) return null;
  try {
    return view.posAtCoords(coords)?.pos ?? null;
  } catch {
    // posAtCoords reads layout; a detached or not-yet-rendered view can throw.
    return null;
  }
}
