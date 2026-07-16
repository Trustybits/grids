import type { InjectionKey, Ref } from "vue";

/**
 * Grid → Tile channel for the id of the tile currently being dragged.
 *
 * Griddle owns pointer handling at the grid level and emits grid-level
 * `dragStart`/`dragEnd` events, so `Grid.vue`
 * publishes the active gesture's tile id here. `Tile.vue` injects it to drive
 * its drag visual state. `null` when no gesture is in progress.
 */
export const TILE_DRAGGING_ID: InjectionKey<Ref<string | null>> = Symbol(
  "tileDraggingId",
);

/**
 * Tile toolbar -> Grid channel for preset resize requests.
 *
 * A preset resize has to enter through Griddle so its collision solver moves
 * neighboring tiles before the resized footprint is rendered. Grid.vue then
 * publishes and persists the engine's resolved layout as one resize gesture.
 */
export type TileResizeRequest = (
  tileId: string,
  width: number,
  height: number,
) => void;

export const TILE_RESIZE_REQUEST: InjectionKey<TileResizeRequest> = Symbol(
  "tileResizeRequest",
);

/**
 * Tile action bar -> Grid channel for deletion requests.
 *
 * Deletion has to pass through Griddle so configured gravity can compact the
 * remaining rendered layout before Grids persists the structural mutation.
 */
export type TileRemoveRequest = (tileId: string) => void;

export const TILE_REMOVE_REQUEST: InjectionKey<TileRemoveRequest> = Symbol(
  "tileRemoveRequest",
);

/**
 * Increments whenever Griddle changes rendered tile geometry. Teleported tile
 * chrome uses this signal to follow resize/repack FLIP animations.
 */
export const TILE_GEOMETRY_VERSION: InjectionKey<Ref<number>> = Symbol(
  "tileGeometryVersion",
);
