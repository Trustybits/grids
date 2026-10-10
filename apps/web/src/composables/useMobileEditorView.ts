/**
 * The phone editor's current state (S0–S7) as one reactive answer, plus the
 * selected tile and its live handle.
 *
 * Joins the store facts (selection, multi-edit, arrange, open tool, sheet)
 * with the one thing only the mounted tile knows — whether it is being typed
 * in or sits in a tool mode — and names the result with the pure
 * `deriveMobileEditorView`. The top bar, the bottom bar and the tiles all read
 * this, so they can't disagree about what's open.
 */

import { computed } from "vue";
import { ContentType, isRichTextContentType } from "@grids/contracts/types";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import {
  deriveMobileEditorView,
  dimsOtherTiles,
  editedTileIds,
} from "@/utils/mobileEditorView";

/** Types whose `isEditing` means "being typed in" rather than a tool mode. */
const TYPING_TYPES: ReadonlySet<string> = new Set([
  ContentType.TEXT,
  ContentType.SMART_TEXT,
  ContentType.PROFILE,
  ContentType.LINK,
  ContentType.DOCUMENT,
]);

export function useMobileEditorView() {
  const ui = useGridUiStore();
  const { editTile, handle } = useMobileTileEdit();

  /** The selected tile is being typed in (its text or its fields). */
  const isTyping = computed(() => {
    const tile = editTile.value;
    if (!tile || !handle.value?.isEditing.value) return false;
    return (
      TYPING_TYPES.has(tile.content.type) ||
      isRichTextContentType(tile.content.type)
    );
  });

  /** The selected tile is in crop / map pan / embed interact. */
  const isInToolMode = computed(() => {
    const tile = editTile.value;
    if (!tile || !handle.value?.isEditing.value) return false;
    return !TYPING_TYPES.has(tile.content.type);
  });

  const view = computed(() =>
    deriveMobileEditorView({
      editTileId: ui.mobileEditTileId,
      multiSelectIds: ui.mobileMultiSelectIds,
      arrangeTileId: ui.mobileArrangeTileId,
      openToolId: ui.mobileOpenToolId,
      sheetExpanded: ui.mobileSheetExpanded,
      isTyping: isTyping.value,
      isInToolMode: isInToolMode.value,
    }),
  );

  /** Tiles being edited — ringed and kept sharp. */
  const editedIds = computed(() => new Set(editedTileIds(view.value)));
  /** Whether the other tiles step back (dim/blur). */
  const dimsOthers = computed(() => dimsOtherTiles(view.value));

  return { view, editedIds, dimsOthers, editTile, handle };
}
