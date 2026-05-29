import { markRaw } from "vue";
import type { LinkContent } from "@grids/contracts/types";
import type { ToolbarButton } from "@/types/TileToolbar";
import ColorIcon from "@/components/icons/toolbar/ColorIcon.vue";
import MoreDotsIcon from "@/components/icons/toolbar/MoreDotsIcon.vue";

export const LINK_BG_TOGGLE: ToolbarButton = {
  id: "link-bg-toggle",
  icon: markRaw(ColorIcon),
  title: (ctx) => {
    const content = ctx.tile.content as LinkContent;
    return content.linkBackgroundEnabled !== false
      ? "Hide background image"
      : "Show background image";
  },
  group: "appearance",
  action: (ctx) => ctx.gridStore.toggleLinkBackground(ctx.tile.i),
  isActive: (ctx) =>
    (ctx.tile.content as LinkContent).linkBackgroundEnabled !== false,
};

export const LINK_MORE_MENU: ToolbarButton = {
  id: "more-menu",
  icon: markRaw(MoreDotsIcon),
  title: "More",
  group: "actions",
  action: () => {
    // Menu open/close is handled by TileToolbar via the menuItems presence
  },
  menuItems: [
    {
      id: "upload-image",
      label: "Upload image",
      action: (ctx) => ctx.childComponent.value?.openCustomImagePicker?.(),
    },
    {
      id: "use-url",
      label: "Use image URL",
      action: (ctx) => {
        ctx.gridStore.setPanelActive(ctx.tile.i, "imageUrl");
      },
    },
    {
      id: "remove-image",
      label: "Remove image",
      danger: true,
      action: (ctx) => ctx.childComponent.value?.removeImage?.(),
      visible: (ctx) =>
        !!(ctx.tile.content as LinkContent).customImageUrl ||
        !!(ctx.tile.content as LinkContent).metaImageUrl,
    },
  ],
};
