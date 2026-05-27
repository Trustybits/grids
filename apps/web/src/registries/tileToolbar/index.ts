import { ContentType } from "@/types/TileContent";
import type { ToolbarButton } from "@/types/TileToolbar";
import { getTileDefinition } from "@/registries/tileRegistry";
import { RESIZE_PRESETS } from "./baseButtons";

export * from "./baseButtons";
export * from "./sharedCropButton";
export * from "./sharedTileLinkButton";
export * from "./mapButtons";
export * from "./linkButtons";
export * from "./textButtons";

const DEFAULT_BUTTONS: ToolbarButton[] = [...RESIZE_PRESETS];

export function getTileToolbarButtons(type: ContentType): ToolbarButton[] {
  const def = getTileDefinition(type);
  if (def?.toolbar) {
    if (typeof def.toolbar === "function") {
      return DEFAULT_BUTTONS;
    }
    return def.toolbar;
  }
  return DEFAULT_BUTTONS;
}
