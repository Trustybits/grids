import { ContentType } from "@grids/contracts/types";
import type { ToolbarButton, ToolbarContext } from "@/types/TileToolbar";
import { getTileDefinition } from "@/registries/tileRegistry";
import { RESIZE_PRESETS } from "./baseButtons";

export * from "./baseButtons";
export * from "./sharedCropButton";
export * from "./sharedTileLinkButton";
export * from "./mapButtons";
export * from "./linkButtons";
export * from "./textButtons";

const DEFAULT_BUTTONS: ToolbarButton[] = [...RESIZE_PRESETS];

export function getTileToolbarButtons(
  type: ContentType,
  ctx?: ToolbarContext,
): ToolbarButton[] {
  const def = getTileDefinition(type);
  if (def?.toolbar) {
    if (typeof def.toolbar === "function") {
      // A function toolbar is computed from the live context. If no context is
      // available (e.g. a non-rendering caller), fall back to the defaults
      // rather than invoking it without the data it needs.
      return ctx ? def.toolbar(ctx) : DEFAULT_BUTTONS;
    }
    return def.toolbar;
  }
  return DEFAULT_BUTTONS;
}
