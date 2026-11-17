/**
 * Which phone editing state is on screen — one answer for every surface.
 *
 * The floating top bar, the morphing bottom bar and the tiles all render from
 * this, so they can never disagree about what's open (the plan's S0–S7). It is
 * pure: the store holds the facts, this names the state.
 *
 * Precedence, highest first: multi-edit, then typing / a tool mode (the tile
 * owns those and enters them itself), then arrange, the sheet, a popover, and
 * finally plain selection.
 */

export type MobileEditorView =
  /** S0 — nothing selected: home bar + full app bar. */
  | { kind: "home" }
  /** S1 — one tile selected: its toolbar. */
  | { kind: "tile"; tileId: string }
  /** S2 — a tool's popover above the toolbar. */
  | { kind: "popover"; tileId: string; toolId: string }
  /** S3 — the toolbar grown into the All settings sheet. */
  | { kind: "sheet"; tileId: string }
  /** S4 — move/resize with corner handles. */
  | { kind: "arrange"; tileId: string }
  /** S5 — typing inside the tile; the bar becomes the format/typing bar. */
  | { kind: "typing"; tileId: string }
  /** S6 — crop / pan / interact; the bar becomes a mode bar. */
  | { kind: "mode"; tileId: string }
  /** S7 — several tiles picked, plus its popover / sheet variants. */
  | { kind: "multi"; tileIds: string[] }
  | { kind: "multi-popover"; tileIds: string[]; toolId: string }
  | { kind: "multi-sheet"; tileIds: string[] };

export interface MobileEditorFacts {
  editTileId: string | null;
  multiSelectIds: readonly string[] | null;
  arrangeTileId: string | null;
  openToolId: string | null;
  sheetExpanded: boolean;
  /** The selected tile is being typed in (rich text or its fields). */
  isTyping: boolean;
  /** The selected tile is in crop, map pan, or embed-interact mode. */
  isInToolMode: boolean;
}

export function deriveMobileEditorView(
  facts: MobileEditorFacts,
): MobileEditorView {
  if (facts.multiSelectIds) {
    const tileIds = [...facts.multiSelectIds];
    if (facts.sheetExpanded) return { kind: "multi-sheet", tileIds };
    if (facts.openToolId) {
      return { kind: "multi-popover", tileIds, toolId: facts.openToolId };
    }
    return { kind: "multi", tileIds };
  }

  const tileId = facts.arrangeTileId ?? facts.editTileId;
  if (!tileId) return { kind: "home" };

  if (facts.isTyping) return { kind: "typing", tileId };
  if (facts.isInToolMode) return { kind: "mode", tileId };
  if (facts.arrangeTileId) return { kind: "arrange", tileId };
  if (facts.sheetExpanded) return { kind: "sheet", tileId };
  if (facts.openToolId) {
    return { kind: "popover", tileId, toolId: facts.openToolId };
  }
  return { kind: "tile", tileId };
}

/** The tiles a view is editing — what the ring/dim and the tools act on. */
export function editedTileIds(view: MobileEditorView): string[] {
  if (view.kind === "home") return [];
  if ("tileIds" in view) return view.tileIds;
  return [view.tileId];
}

/** Whether the other tiles should step back (dim/blur) in this view. */
export function dimsOtherTiles(view: MobileEditorView): boolean {
  // Arranging needs the whole grid in view to see where things go.
  return view.kind !== "home" && view.kind !== "arrange";
}
