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
