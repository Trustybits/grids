import { markRaw } from "vue";
import type { ToolbarButton } from "@/types/TileToolbar";

import ResizeWideIcon from "@/components/icons/toolbar/ResizeWideIcon.vue";
import ResizeSquareIcon from "@/components/icons/toolbar/ResizeSquareIcon.vue";
import ResizeLandscapeIcon from "@/components/icons/toolbar/ResizeLandscapeIcon.vue";
import ResizePortraitIcon from "@/components/icons/toolbar/ResizePortraitIcon.vue";
import Resize1x1Icon from "@/components/icons/toolbar/Resize1x1Icon.vue";
import Resize4x4Icon from "@/components/icons/toolbar/Resize4x4Icon.vue";
import Resize2x4Icon from "@/components/icons/toolbar/Resize2x4Icon.vue";
import Resize4x2Icon from "@/components/icons/toolbar/Resize4x2Icon.vue";
import BorderToggleIcon from "@/components/icons/toolbar/BorderToggleIcon.vue";
import ColorIcon from "@/components/icons/toolbar/ColorIcon.vue";

function makeResizeButton(
  id: string,
  w: number,
  h: number,
  icon: object,
  title: string,
): ToolbarButton {
  return {
    id,
    icon: markRaw(icon),
    title,
    group: "resize",
    action: (ctx) => {
      ctx.gridView.resizeTile(ctx.tile.i, w, h);
      ctx.childComponent.value?.onResize?.();
    },
    // Compare against the size actually rendered at the active breakpoint, not
    // the tile's base (lg) dimensions. resizeTile writes per-breakpoint
    // overrides on md/sm without touching tile.w/h, so reading tile.w/h here
    // would highlight the desktop size instead of what's on screen. Fall back
    // to the base size when no display position exists (e.g. lg, or in tests).
    isActive: (ctx) => {
      const shown = ctx.gridView.displayPositions.find(
        (position) => position.i === ctx.tile.i,
      );
      const currentW = shown?.w ?? ctx.tile.w;
      const currentH = shown?.h ?? ctx.tile.h;
      return currentW === w && currentH === h;
    },
  };
}

export const RESIZE_5x1 = makeResizeButton(
  "resize-5x1",
  5,
  1,
  ResizeWideIcon,
  "Resize to 5x1",
);
export const RESIZE_2x2 = makeResizeButton(
  "resize-2x2",
  2,
  2,
  ResizeSquareIcon,
  "Resize to 2x2",
);
export const RESIZE_2x3 = makeResizeButton(
  "resize-2x3",
  2,
  3,
  Resize2x4Icon,
  "Resize to 2x3",
);
export const RESIZE_3x1 = makeResizeButton(
  "resize-3x1",
  3,
  1,
  ResizeWideIcon,
  "Resize to 3x1",
);
export const RESIZE_3x2 = makeResizeButton(
  "resize-3x2",
  3,
  2,
  ResizeLandscapeIcon,
  "Resize to 3x2",
);
export const RESIZE_2x4 = makeResizeButton(
  "resize-2x4",
  2,
  4,
  ResizePortraitIcon,
  "Resize to 2x4",
);
export const RESIZE_1x1 = makeResizeButton(
  "resize-1x1",
  1,
  1,
  Resize1x1Icon,
  "Resize to 1x1",
);
export const RESIZE_4x4 = makeResizeButton(
  "resize-4x4",
  4,
  4,
  Resize4x4Icon,
  "Resize to 4x4",
);
export const RESIZE_4x2 = makeResizeButton(
  "resize-4x2",
  4,
  2,
  Resize4x2Icon,
  "Resize to 4x2",
);
export const RESIZE_8x1 = makeResizeButton(
  "resize-8x1",
  8,
  1,
  ResizePortraitIcon,
  "Resize to 8x1",
);

export const RESIZE_PRESETS: ToolbarButton[] = [
  RESIZE_1x1,
  RESIZE_3x1,
  RESIZE_4x4,
  RESIZE_2x2,
];

export const BORDER_TOGGLE: ToolbarButton = {
  id: "border-toggle",
  icon: markRaw(BorderToggleIcon),
  title: (ctx) =>
    ctx.tile.borderEnabled !== false ? "Hide border" : "Show border",
  group: "appearance",
  cssClass: "toolbar-btn--border",
  action: (ctx) => ctx.gridView.toggleTileBorder(ctx.tile.i),
  isActive: (ctx) => ctx.tile.borderEnabled !== false,
};

export const COLOR_BUTTON: ToolbarButton = {
  id: "color",
  icon: markRaw(ColorIcon),
  title: "Tile color",
  group: "appearance",
  panelId: "colorSelect",
  action: (_ctx) => {
    // Menu open/close handled by tile toolbar via panelId
  },
};
