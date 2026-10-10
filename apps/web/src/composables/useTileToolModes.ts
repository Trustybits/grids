/**
 * The tool modes a tile can be in on the phone toolbar (plan S6): Crop for
 * image and video, Pan for a map, Interact for an embed. Each tile owns its
 * mode — this only names it and gives the chrome one way in and one way out,
 * exposed on the tile's edit handle.
 *
 *  - crop      the content's crop editing (exit plays the tile's crop-out
 *              animation, then saves the offsets)
 *  - pan       the map's edit mode (exit saves the camera)
 *  - interact  the embed takes touches; the cover that keeps an embed inert
 *              while editing comes off
 */

import { computed, type Ref } from "vue";
import { ContentType } from "@grids/contracts/types";
import type { TileChildComponent } from "@/types/Tile";

export type TileToolMode = "crop" | "pan" | "interact";

export interface TileToolModesOptions {
  type: () => string;
  childComponent: Ref<TileChildComponent | null>;
  isEditing: Ref<boolean>;
  isExitingCropMode: Ref<boolean>;
  isEmbedInteractive: Ref<boolean>;
  /** The tile's crop toggle (with its exit animation). */
  toggleCropMode: () => void;
}

/** Which mode a tool id enters, for the tile types that have one. */
export function toolModeFor(
  toolId: string,
  type: string,
): TileToolMode | null {
  if (
    toolId === "crop" &&
    (type === ContentType.IMAGE || type === ContentType.VIDEO)
  ) {
    return "crop";
  }
  if (toolId === "pan" && type === ContentType.MAP) return "pan";
  if (toolId === "interact" && type === ContentType.EMBED) return "interact";
  return null;
}

export function useTileToolModes(options: TileToolModesOptions) {
  const {
    type,
    childComponent,
    isEditing,
    isExitingCropMode,
    isEmbedInteractive,
    toggleCropMode,
  } = options;

  /** The mode the tile is in now, if any. */
  const activeMode = computed<TileToolMode | null>(() => {
    if (isEmbedInteractive.value) return "interact";
    if (!isEditing.value) return null;
    const kind = type();
    if (kind === ContentType.IMAGE || kind === ContentType.VIDEO) return "crop";
    if (kind === ContentType.MAP) return "pan";
    return null;
  });

  const enterMode = (mode: TileToolMode): void => {
    if (activeMode.value === mode) return;
    exitMode();
    switch (mode) {
      case "crop":
        toggleCropMode();
        break;
      case "pan": {
        const child = childComponent.value;
        child?.toggleEditMode?.();
        if (child?.isEditing !== undefined) isEditing.value = child.isEditing;
        break;
      }
      case "interact":
        isEmbedInteractive.value = true;
        break;
    }
  };

  /** Leave whatever mode the tile is in; safe to call when there is none. */
  const exitMode = (): void => {
    switch (activeMode.value) {
      case "crop":
        // Already animating out: one toggle is enough.
        if (!isExitingCropMode.value) toggleCropMode();
        break;
      case "pan":
        // The map's own exit is idempotent and saves the camera.
        childComponent.value?.onExitClick?.();
        isEditing.value = false;
        break;
      case "interact":
        isEmbedInteractive.value = false;
        break;
    }
  };

  return { activeMode, enterMode, exitMode };
}
