/**
 * What the phone editor's tools are and what tapping one does, for one tile —
 * shared by the tile toolbar and the All settings sheet so a tool behaves the
 * same from either:
 *
 *  - instant tools act (Duplicate, Delete, Copy, Download, Re-center,
 *    Preview; Open is a real link the browser follows);
 *  - Crop / Pan / Interact put the tile in its mode;
 *  - Edit starts typing in the tile's fields;
 *  - Arrange toggles on-canvas move/resize;
 *  - popover tools toggle their card.
 */

import { computed, proxyRefs } from "vue";
import type { Tile } from "@grids/contracts/types";
import {
  getMobileTools,
  WRITERS,
  type MobileTool,
  type MobileToolId,
} from "@/registries/tileToolbar/mobileTools";
import { getTileToolbarButtons } from "@/registries/tileToolbar";
import type { ToolbarContext } from "@/types/TileToolbar";
import type { MobileToolState } from "@/components/app/mobile-editor/MobileToolButton.vue";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useMobileExperience } from "@/composables/useMobileExperience";
import {
  startTileTyping,
  useMobileTileEdit,
} from "@/composables/useMobileTileEdit";
import { useTileActions } from "@/composables/useTileActions";
import { useMobileTileCommands } from "@/composables/useMobileTileCommands";
import { toolModeFor } from "@/composables/useTileToolModes";

const ICON_BY_TOOL: Partial<Record<MobileToolId, string>> = {
  mapStyle: "map-style",
};

/** The icon asset a tool draws (most are named after the tool). */
export const mobileToolIcon = (id: MobileToolId): string =>
  ICON_BY_TOOL[id] ?? id;

export function useMobileToolActions(tileSource: () => Tile) {
  const ui = useGridUiStore();
  const controller = useGridController();
  const gridView = proxyRefs(useGridViewContext());
  const { isUnifiedText } = useMobileExperience();
  const { handle } = useMobileTileEdit();
  const actions = useTileActions(tileSource);
  const commands = useMobileTileCommands();

  const tile = computed(tileSource);

  const tools = computed(() =>
    getMobileTools({
      tile: tile.value,
      unifiedText: isUnifiedText.value,
      canDownload: actions.hasDownload.value,
    }),
  );

  const stateFor = (tool: MobileTool): MobileToolState => {
    if (tool.danger) return "danger";
    if (ui.mobileOpenToolId === tool.id) return "selected";
    if (tool.id === "arrange" && ui.mobileArrangeTileId === tile.value.i) {
      return "selected";
    }
    // Toggles that are on read as "on" while their panel is closed.
    if (tool.id === "border" && WRITERS.border.read(tile.value) === true) {
      return "on";
    }
    if (tool.id === "link" && WRITERS.link.read(tile.value)) return "on";
    return "default";
  };

  /** Run a desktop registry action against the live tile (map re-center). */
  const runRegistryAction = (buttonId: string) => {
    const tileHandle = handle.value;
    if (!tileHandle) return;
    const context: ToolbarContext = {
      tile: tile.value,
      childComponent: tileHandle.childComponent,
      gridView,
      resizeTile: tileHandle.resizeTile,
      isEditing: tileHandle.isEditing,
      isExitingCropMode: tileHandle.isExitingCropMode,
    };
    getTileToolbarButtons(tile.value.content.type, context)
      .find((button) => button.id === buttonId)
      ?.action(context);
  };

  const run = (tool: MobileTool): void => {
    switch (tool.id) {
      case "duplicate":
        return void commands.duplicate(tile.value);
      case "delete":
        return commands.remove(tile.value);
      case "open":
        // A real link; the browser follows it.
        return;
      case "copy":
        return void actions.copyToClipboard();
      case "download":
        return void actions.download();
      case "recenter":
        return runRegistryAction("map-recenter");
      case "preview":
        return handle.value?.childComponent.value?.openPreview?.();
      case "crop":
      case "pan":
      case "interact": {
        // The tile enters the mode; the bar becomes the mode bar.
        const mode = toolModeFor(tool.id, tile.value.content.type);
        if (mode) handle.value?.enterToolMode?.(mode);
        return;
      }
      case "edit":
        // Start typing in the tile's fields; the bar becomes the typing bar.
        return startTileTyping(handle.value);
      case "arrange":
        return controller.setMobileArrangeTile(
          ui.mobileArrangeTileId === tile.value.i ? null : tile.value.i,
        );
      default:
        // Popover tools open their card; a second tap closes it.
        return controller.setMobileOpenTool(
          ui.mobileOpenToolId === tool.id ? null : tool.id,
        );
    }
  };

  return {
    tools,
    stateFor,
    run,
    iconFor: mobileToolIcon,
    openHref: computed(() => actions.resolvedTileUrl.value),
  };
}
