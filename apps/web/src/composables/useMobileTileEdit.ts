/**
 * useMobileTileEdit — Mobile 2.0 `/EDIT` tile sheet state
 *
 * One tile at a time is the edit target. Tapping a tile makes it the target
 * (`Tile.vue`), which morphs the bottom command pill into the `/EDIT` input and
 * raises `MobileTileEditSheet` behind it — the same morph-and-rise pattern as
 * `/TILE` and `/GRID`.
 *
 * The sheet renders in `MobileGridBar`, which is app chrome and therefore
 * outside the grid canvas. Some of what a tile's controls need cannot be reached
 * from there: the live content-component instance behind bold/italic, the
 * Griddle-routed resize that displaces neighbours, and the tile's own exit
 * animation on delete. So the activated tile *registers a handle* — the few
 * things only it can provide — and clears it on deactivate. One handle, not a
 * map: only one tile is ever the target.
 *
 * Split of state, on purpose:
 *   - the target tile id lives in the `gridUi` store, so leaving the grid clears
 *     it (`resetSessionState`) and it can never point at a tile that is no
 *     longer on screen;
 *   - the handle and the filter text are module-level here, because both belong
 *     to an open sheet and mean nothing once it closes.
 */

import { computed, ref, shallowRef, type Ref } from "vue";
import type { TileChildComponent } from "@/types/Tile";
import type { TileToolMode } from "@/composables/useTileToolModes";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";

export interface MobileTileEditHandle {
  childComponent: Ref<TileChildComponent | null>;
  isEditing: Ref<boolean>;
  isExitingCropMode: Ref<boolean>;
  /**
   * Griddle-routed resize, as injected inside the grid canvas — so a preset tap
   * from the sheet displaces neighbours exactly like the desktop toolbar's does,
   * rather than falling back to the plain controller write.
   */
  resizeTile: (tileId: string, width: number, height: number) => void;
  /** Runs the tile's exit animation, then removes it. */
  remove: () => void;
  /** Crop / pan / interact, when the tile is in one (phone toolbar). */
  toolMode?: Readonly<Ref<TileToolMode | null>>;
  enterToolMode?: (mode: TileToolMode) => void;
  exitToolMode?: () => void;
}

const _query = ref("");
// Shallow: the handle is a bag of refs the tile already owns. A deep ref would
// unwrap them, which both loses the reactive link and changes the type.
const _handle = shallowRef<MobileTileEditHandle | null>(null);
// Which tile registered the handle. The selection can move without a tap (a
// duplicate's copy is selected before it mounts), and acting on the previous
// tile's handle would edit — or delete — the wrong tile.
const _handleTileId = ref<string | null>(null);

export function useMobileTileEdit() {
  const sessionStore = useGridSessionStore();
  const uiStore = useGridUiStore();
  const controller = useGridController();

  const editTileId = computed(() => uiStore.mobileEditTileId);

  /**
   * The target as a tile, resolved from the live grid rather than captured at
   * open time — so the sheet reflects edits (and disappears on delete) without
   * anything having to tell it to.
   */
  const editTile = computed(
    () =>
      sessionStore.currentGrid?.tiles.find(
        (tile) => tile.i === editTileId.value,
      ) ?? null,
  );

  const isEditTarget = (tileId: string) => editTileId.value === tileId;

  const openEdit = (tileId: string, handle: MobileTileEditHandle) => {
    _query.value = "";
    _handle.value = handle;
    _handleTileId.value = tileId;
    controller.setMobileEditTile(tileId);
  };

  const closeEdit = () => {
    _query.value = "";
    _handle.value = null;
    _handleTileId.value = null;
    controller.setMobileEditTile(null);
  };

  return {
    editTileId,
    editTile,
    isEditTarget,
    openEdit,
    closeEdit,
    // Only the selected tile's own handle; null until it has registered.
    handle: computed(() =>
      _handleTileId.value === editTileId.value ? _handle.value : null,
    ),
    query: _query,
  };
}

/** What starting and stopping typing needs from a tile, beyond the base. */
type TypingChild = TileChildComponent & {
  startEditing?: (focus?: "title") => void;
  stopEditing?: () => void;
};

/**
 * Start typing in the selected tile, as its Edit tool: the field tiles (link,
 * documents) open on their title, a profile on its name. Rich-text tiles start
 * with a second tap on the text itself.
 */
export function startTileTyping(handle: MobileTileEditHandle | null): void {
  const child = handle?.childComponent.value as TypingChild | null | undefined;
  if (!child) return;
  if (child.startEditing) child.startEditing("title");
  else child.onShortClick?.(new MouseEvent("click"));
}

/**
 * Stop typing in the selected tile — the typing bar's Done, or an empty-space
 * tap. Each tile's own exit saves and ends its edit session; the keyboard
 * goes down with the focus.
 */
export function stopTileTyping(handle: MobileTileEditHandle | null): void {
  const child = handle?.childComponent.value as TypingChild | null | undefined;
  if (!child) return;
  child.editor?.commands.blur();
  if (child.onExitClick) child.onExitClick();
  else child.stopEditing?.();
  (document.activeElement as HTMLElement | null)?.blur?.();
}
