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
