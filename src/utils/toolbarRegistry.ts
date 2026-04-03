import { markRaw } from "vue";
import {
  ContentType,
  type LinkContent,
  type TextContent,
} from "@/types/TileContent";
import type { ToolbarItem, ToolbarContext } from "@/types/TileToolbar";

import ResizeWideIcon from "@/components/icons/toolbar/ResizeWideIcon.vue";
import ResizeSquareIcon from "@/components/icons/toolbar/ResizeSquareIcon.vue";
import ResizeLandscapeIcon from "@/components/icons/toolbar/ResizeLandscapeIcon.vue";
import ResizePortraitIcon from "@/components/icons/toolbar/ResizePortraitIcon.vue";
import Resize1x1Icon from "@/components/icons/toolbar/Resize1x1Icon.vue";
import Resize4x4Icon from "@/components/icons/toolbar/Resize4x4Icon.vue";
import Resize2x4Icon from "@/components/icons/toolbar/Resize2x4Icon.vue";
import Resize4x2Icon from "@/components/icons/toolbar/Resize4x2Icon.vue";
import BorderToggleIcon from "@/components/icons/toolbar/BorderToggleIcon.vue";
import CropIcon from "@/components/icons/toolbar/CropIcon.vue";
import ColorIcon from "@/components/icons/toolbar/ColorIcon.vue";
import MoreDotsIcon from "@/components/icons/toolbar/MoreDotsIcon.vue";
import PlaneIcon from "@/components/icons/toolbar/PlaneIcon.vue";
import DefaultMapIcon from "@/components/icons/toolbar/DefaultMapIcon.vue";
import CloudsIcon from "@/components/icons/toolbar/CloudsIcon.vue";
import MapSearchIcon from "@/components/icons/toolbar/MapSearchIcon.vue";
import MapPanIcon from "@/components/icons/toolbar/MapPanIcon.vue";
import LocateFixedIcon from "@/components/icons/toolbar/LocateFixedIcon.vue";
import LinkIcon from "@/components/icons/LinkIcon.vue";
import BoldIcon from "@/components/icons/toolbar/BoldIcon.vue";
import ItalicIcon from "@/components/icons/toolbar/ItalicIcon.vue";
import TextAlignIcon from "@/components/icons/toolbar/TextAlignIcon.vue";
import ClearLinkIcon from "@/components/icons/ClearLinkIcon.vue";

// ── Shared reusable toolbar items ──────────────────────────────────

function makeResizeItem(
  id: string,
  w: number,
  h: number,
  icon: any,
  title: string,
): ToolbarItem {
  return {
    id,
    icon: markRaw(icon),
    title,
    group: "resize",
    action: (ctx) => {
      ctx.layoutStore.resizeTile(ctx.tile.i, w, h);
      ctx.childComponent.value?.onResize?.();
    },
    isActive: (ctx) => ctx.tile.w === w && ctx.tile.h === h,
  };
}

export const RESIZE_5x1 = makeResizeItem(
  "resize-5x1",
  5,
  1,
  ResizeWideIcon,
  "Resize to 5x1",
);
export const RESIZE_2x2 = makeResizeItem(
  "resize-2x2",
  2,
  2,
  ResizeSquareIcon,
  "Resize to 2x2",
);
export const RESIZE_2x3 = makeResizeItem(
  "resize-2x3",
  2,
  3,
  Resize2x4Icon,
  "Resize to 2x3",
);
export const RESIZE_3x1 = makeResizeItem(
  "resize-3x1",
  3,
  1,
  ResizeWideIcon,
  "Resize to 3x1",
);
export const RESIZE_3x2 = makeResizeItem(
  "resize-3x2",
  3,
  2,
  ResizeLandscapeIcon,
  "Resize to 3x2",
);
export const RESIZE_2x4 = makeResizeItem(
  "resize-2x4",
  2,
  4,
  ResizePortraitIcon,
  "Resize to 2x4",
);
export const RESIZE_1x1 = makeResizeItem(
  "resize-1x1",
  1,
  1,
  Resize1x1Icon,
  "Resize to 1x1",
);
export const RESIZE_4x4 = makeResizeItem(
  "resize-4x4",
  4,
  4,
  Resize4x4Icon,
  "Resize to 4x4",
);
export const RESIZE_4x2 = makeResizeItem(
  "resize-4x2",
  4,
  2,
  Resize4x2Icon,
  "Resize to 4x2",
);
export const RESIZE_8x1 = makeResizeItem(
  "resize-8x1",
  8,
  1,
  ResizePortraitIcon,
  "Resize to 8x1",
);

export const RESIZE_PRESETS: ToolbarItem[] = [
  RESIZE_1x1,
  RESIZE_3x1,
  RESIZE_4x4,
  RESIZE_2x2,
];

export const BORDER_TOGGLE: ToolbarItem = {
  id: "border-toggle",
  icon: markRaw(BorderToggleIcon),
  title: (ctx) =>
    ctx.tile.borderEnabled !== false ? "Hide border" : "Show border",
  group: "appearance",
  cssClass: "toolbar-btn--border",
  action: (ctx) => ctx.layoutStore.toggleTileBorder(ctx.tile.i),
  isActive: (ctx) => ctx.tile.borderEnabled !== false,
};

export const CROP_BUTTON: ToolbarItem = {
  id: "crop",
  icon: markRaw(CropIcon),
  title: "Crop / Zoom",
  group: "appearance",
  action: (ctx) => {
    if (!ctx.childComponent.value?.toggleEditMode) return;

    if (ctx.isEditing.value) {
      ctx.isExitingCropMode.value = true;
      setTimeout(() => {
        ctx.childComponent.value?.toggleEditMode();
        if (ctx.childComponent.value?.isEditing !== undefined) {
          ctx.isEditing.value = ctx.childComponent.value.isEditing;
        }
        ctx.isExitingCropMode.value = false;
      }, 450);
    } else {
      ctx.childComponent.value.toggleEditMode();
      if (ctx.childComponent.value?.isEditing !== undefined) {
        ctx.isEditing.value = ctx.childComponent.value.isEditing;
      }
    }
  },
  isActive: (ctx) => ctx.isEditing.value,
};

export const COLOR_BUTTON: ToolbarItem = {
  id: "color",
  icon: markRaw(ColorIcon),
  title: "Tile color",
  group: "appearance",
  panelId: "colorSelect",
  action: (_ctx) => {
    // Menu open/close handled by tile toolbar via panelId
  },
};

export const TEXT_ALIGN_BUTTON: ToolbarItem = {
  id: "text-align",
  icon: markRaw(TextAlignIcon),
  title: "Text align",
  group: "appearance",
  panelId: "textAlign",
  action: () => {
    // Panel open/close is handled by TileToolbar via panelId
  },
};

// ── Map-specific toolbar items ───────────────────────────────────

export const MAP_PAN: ToolbarItem = {
  id: "map-pan",
  icon: markRaw(MapPanIcon),
  title: "Pan / Zoom",
  group: "map-style",
  action: (ctx) => {
    if (!ctx.childComponent.value?.toggleEditMode) return;
    ctx.childComponent.value.toggleEditMode();
    if (ctx.childComponent.value?.isEditing !== undefined) {
      ctx.isEditing.value = ctx.childComponent.value.isEditing;
    }
  },
  isActive: (ctx) => ctx.isEditing.value,
};

export const MAP_PLANE: ToolbarItem = {
  id: "map-plane",
  icon: markRaw(PlaneIcon),
  title: "Toggle plane",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.togglePlanes?.(),
  isActive: (ctx) => !!ctx.childComponent.value?.showPlanes,
};

export const MAP_SEARCH: ToolbarItem = {
  id: "map-search",
  icon: markRaw(MapSearchIcon),
  title: "Search",
  group: "map-style",
  panelId: "search",
  action: () => {
    // Panel open/close is handled by TileToolbar via the panelId presence
  },
};

// Flies the camera back to the saved marker (or center) location.
export const MAP_RECENTER: ToolbarItem = {
  id: "map-recenter",
  icon: markRaw(LocateFixedIcon),
  title: "Re-center on location",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.recenterOnMarker?.(),
};

export const MAP_DEFAULT: ToolbarItem = {
  id: "map-default",
  icon: markRaw(DefaultMapIcon),
  title: "Default view",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.toggleDefaultStyle?.(),
  isActive: (ctx) => !!ctx.childComponent.value?.isDefaultStyle,
};

export const MAP_CLOUDS: ToolbarItem = {
  id: "map-clouds",
  icon: markRaw(CloudsIcon),
  title: "Toggle clouds",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.toggleClouds?.(),
  isActive: (ctx) => !!ctx.childComponent.value?.showClouds,
};

export const LINK_BG_TOGGLE: ToolbarItem = {
  id: "link-bg-toggle",
  icon: markRaw(ColorIcon),
  title: (ctx) => {
    const content = ctx.tile.content as LinkContent;
    return content.linkBackgroundEnabled !== false
      ? "Hide background image"
      : "Show background image";
  },
  group: "appearance",
  action: (ctx) => ctx.layoutStore.toggleLinkBackground(ctx.tile.i),
  isActive: (ctx) =>
    (ctx.tile.content as LinkContent).linkBackgroundEnabled !== false,
};

const _linkIcon = markRaw(LinkIcon);
const _clearLinkIcon = markRaw(ClearLinkIcon);

const hasTileLink = (ctx: ToolbarContext) =>
  !!(ctx.tile.content as any)?.tileLink;

export const TILE_LINK: ToolbarItem = {
  id: "tile-link",
  icon: (ctx: ToolbarContext) =>
    hasTileLink(ctx) ? _clearLinkIcon : _linkIcon,
  title: (ctx: ToolbarContext) => {
    if (!hasTileLink(ctx)) return "Add a link";
    const url = (ctx.tile.content as any).tileLink as string;
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

export const LINK_MORE_MENU: ToolbarItem = {
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
        ctx.layoutStore.setPanelActive(ctx.tile.i, "imageUrl");
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

export const TEXT_MORE_MENU: ToolbarItem = {
  id: "more-menu",
  icon: markRaw(MoreDotsIcon),
  title: "More",
  group: "actions",
  action: () => {},
  menuItemsLayoutDirection: "horizontal",
  menuItems: [
    {
      id: "font-family",
      panelId: "font-family",
      tooltip: "Change Font",
      action: (_ctx) => {},
    },
    {
      id: "font-size",
      panelId: "font-select",
      tooltip: "Change Font Size",
      action: (_ctx) => {},
    },
    {
      id: "bold-toggle",
      icon: markRaw(BoldIcon),
      tooltip: "Bold",
      isActive: (ctx) => !!ctx.childComponent.value?.isBoldActive,
      action: (ctx) => ctx.childComponent.value?.toggleBold?.(),
    },
    {
      id: "italic-toggle",
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

// ── Registry ───────────────────────────────────────────────────────

const registry: Partial<Record<ContentType, ToolbarItem[]>> = {
  [ContentType.IMAGE]: [
    ...RESIZE_PRESETS,
    BORDER_TOGGLE,
    CROP_BUTTON,
    COLOR_BUTTON,
    TILE_LINK,
  ],
  [ContentType.VIDEO]: [
    ...RESIZE_PRESETS,
    BORDER_TOGGLE,
    CROP_BUTTON,
    COLOR_BUTTON,
    TILE_LINK,
  ],
  [ContentType.LINK]: [
    ...RESIZE_PRESETS,
    BORDER_TOGGLE,
    COLOR_BUTTON,
    LINK_MORE_MENU,
  ],
  [ContentType.TEXT]: [
    ...RESIZE_PRESETS,
    BORDER_TOGGLE,
    COLOR_BUTTON,
    TEXT_ALIGN_BUTTON,
    TEXT_MORE_MENU,
  ],
  [ContentType.MUSIC]: [
    RESIZE_1x1,
    RESIZE_2x3,
    RESIZE_2x2,
    RESIZE_4x2,
    RESIZE_4x4,
  ],
  [ContentType.EMBED]: [...RESIZE_PRESETS, BORDER_TOGGLE],
  [ContentType.MAP]: [
    RESIZE_4x4,
    RESIZE_2x4,
    RESIZE_4x2,
    MAP_DEFAULT,
    MAP_PAN,
    MAP_SEARCH,
    MAP_RECENTER,
  ],
  [ContentType.CHAT]: [
    RESIZE_3x2,
    RESIZE_4x2,
    RESIZE_4x4,
    BORDER_TOGGLE,
    COLOR_BUTTON,
  ],
  [ContentType.CAMPFIRE]: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
  [ContentType.PROFILE]: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
  // Roadmap feed uses standard resize/appearance options; settings are managed inside the tile itself
  [ContentType.ROADMAP_FEED]: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
};

// Default fallback for any tile type not explicitly configured
const DEFAULT_ITEMS: ToolbarItem[] = [...RESIZE_PRESETS];

export function getToolbarItems(type: ContentType): ToolbarItem[] {
  return registry[type] ?? DEFAULT_ITEMS;
}
