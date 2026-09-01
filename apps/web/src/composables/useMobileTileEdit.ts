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
}

const _query = ref("");
// Shallow: the handle is a bag of refs the tile already owns. A deep ref would
// unwrap them, which both loses the reactive link and changes the type.
const _handle = shallowRef<MobileTileEditHandle | null>(null);

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
    controller.setMobileEditTile(tileId);
  };

  const closeEdit = () => {
    _query.value = "";
    _handle.value = null;
    controller.setMobileEditTile(null);
  };

  return {
    editTileId,
    editTile,
    isEditTarget,
    openEdit,
    closeEdit,
    handle: computed(() => _handle.value),
    query: _query,
  };
}
