import type { InjectionKey, Ref } from "vue";

/**
 * Grid → Tile channel for the id of the tile currently being dragged / resized.
 *
 * Griddle owns pointer handling at the grid level and emits grid-level
 * `dragStart`/`dragEnd` / `resizeStart`/`resizeEnd` events, so `Grid.vue`
 * publishes the active gesture's tile id here. `Tile.vue` injects it to drive
 * its drag visual state and to suppress its click-vs-drag disambiguation (the
 * job the old `<GridItem>` `@move`/`@moved` handlers used to do). `null` when no
 * gesture is in progress.
 */
export const TILE_DRAGGING_ID: InjectionKey<Ref<string | null>> = Symbol(
  "tileDraggingId",
);

export const TILE_RESIZING_ID: InjectionKey<Ref<string | null>> = Symbol(
  "tileResizingId",
);
