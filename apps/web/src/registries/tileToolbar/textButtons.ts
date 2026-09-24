import { markRaw } from "vue";
import type { TextContent } from "@grids/contracts/types";
import type { ToolbarButton, ToolbarContext } from "@/types/TileToolbar";
import TextAlignIcon from "@/components/icons/toolbar/TextAlignIcon.vue";
import MoreDotsIcon from "@/components/icons/toolbar/MoreDotsIcon.vue";
import BoldIcon from "@/components/icons/toolbar/BoldIcon.vue";
import ItalicIcon from "@/components/icons/toolbar/ItalicIcon.vue";
import LinkIcon from "@/components/icons/LinkIcon.vue";
import ClearLinkIcon from "@/components/icons/ClearLinkIcon.vue";
import { isFloatingFormatToolbarActive } from "@/composables/earlyAccessState";

const _linkIcon = markRaw(LinkIcon);
const _clearLinkIcon = markRaw(ClearLinkIcon);

// Text formatting moves to the floating toolbar for unified text users on a
// pointer device; the tile toolbar keeps tile-level controls only.
const inTileMenu = () => !isFloatingFormatToolbarActive();

const hasTileLink = (ctx: ToolbarContext) =>
  !!(ctx.tile.content as { tileLink?: string })?.tileLink;

export const TEXT_ALIGN_BUTTON: ToolbarButton = {
  id: "text-align",
  icon: markRaw(TextAlignIcon),
  title: "Text align",
  group: "appearance",
  panelId: "textAlign",
  action: () => {
    // Panel open/close is handled by TileToolbar via panelId
  },
};

export const TEXT_MORE_MENU: ToolbarButton = {
  id: "more-menu",
  icon: markRaw(MoreDotsIcon),
  title: "More",
  group: "actions",
  action: () => {},
  menuItemsLayoutDirection: "horizontal",
  menuItems: [
    {
      id: "font-family",
      visible: inTileMenu,
      panelId: "font-family",
      tooltip: "Change Font",
      action: (_ctx) => {},
    },
    {
      id: "font-size",
      visible: inTileMenu,
      panelId: "font-select",
      tooltip: "Change Font Size",
      action: (_ctx) => {},
    },
    {
      id: "bold-toggle",
      visible: inTileMenu,
      icon: markRaw(BoldIcon),
      tooltip: "Bold",
      isActive: (ctx) => !!ctx.childComponent.value?.isBoldActive,
      action: (ctx) => ctx.childComponent.value?.toggleBold?.(),
    },
    {
      id: "italic-toggle",
      visible: inTileMenu,
      icon: markRaw(ItalicIcon),
      tooltip: "Italic",
      isActive: (ctx) => !!ctx.childComponent.value?.isItalicActive,
      action: (ctx) => ctx.childComponent.value?.toggleItalic?.(),
    },
    {
      id: "tile-link",
      icon: (ctx: ToolbarContext) =>
        hasTileLink(ctx) ? _clearLinkIcon : _linkIcon,
      tooltip: (ctx: ToolbarContext) => {
        if (!hasTileLink(ctx)) return "Add a Link";
        const url = (ctx.tile.content as TextContent).tileLink as string;
        return `Remove link to ${url}`;
      },
      danger: (ctx: ToolbarContext) => hasTileLink(ctx),
      action: (ctx: ToolbarContext) => {
        if (hasTileLink(ctx)) {
          ctx.childComponent.value?.clearLink?.();
        } else {
          ctx.childComponent.value?.openUrlInput?.();
        }
      },
    },
  ],
};
