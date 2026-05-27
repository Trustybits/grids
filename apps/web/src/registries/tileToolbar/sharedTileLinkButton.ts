import { markRaw } from "vue";
import type { ToolbarButton, ToolbarContext } from "@/types/TileToolbar";
import LinkIcon from "@/components/icons/LinkIcon.vue";
import ClearLinkIcon from "@/components/icons/ClearLinkIcon.vue";

const _linkIcon = markRaw(LinkIcon);
const _clearLinkIcon = markRaw(ClearLinkIcon);

const hasTileLink = (ctx: ToolbarContext) =>
  !!(ctx.tile.content as { tileLink?: string })?.tileLink;

export const TILE_LINK: ToolbarButton = {
  id: "tile-link",
  icon: (ctx: ToolbarContext) =>
    hasTileLink(ctx) ? _clearLinkIcon : _linkIcon,
  title: (ctx: ToolbarContext) => {
    if (!hasTileLink(ctx)) return "Add a link";
    const url = (ctx.tile.content as { tileLink?: string }).tileLink as string;
    return `Remove link to ${url}`;
  },
  group: "appearance",
  danger: (ctx: ToolbarContext) => hasTileLink(ctx),
  action: (ctx: ToolbarContext) => {
    if (hasTileLink(ctx)) {
      ctx.childComponent.value?.clearLink?.();
    } else {
      ctx.childComponent.value?.openUrlInput?.();
    }
  },
};
