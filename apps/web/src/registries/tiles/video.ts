import { ContentType, type VideoContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import { isDirectVideoUrl } from "@/utils/TileUtils";
import { RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON } from "@/registries/tileToolbar/baseButtons";
import { CROP_BUTTON } from "@/registries/tileToolbar/sharedCropButton";
import { TILE_LINK } from "@/registries/tileToolbar/sharedTileLinkButton";

export const videoDefinition: TileDefinition<VideoContent> = {
  type: ContentType.VIDEO,
  label: "Video",
  category: "media",

  component: () => import("@/components/tilecontent/VideoContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.VIDEO,
    src: data?.src || "",
    srcHash: data?.srcHash,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    backgroundColor: data?.backgroundColor,
    tileLink: data?.tileLink,
  }),

  validate: (content) =>
    !!content.src &&
    (content.src.startsWith("http") ||
      content.src.startsWith("data:") ||
      content.src.startsWith("blob:")),

  capabilities: {
    caption: true,
    border: true,
    tileLink: true,
  },

  colorTheming: {
    backgroundColor: true,
  },

  editMode: "crop",

  actions: {
    downloadUrl: (content) => content.src || null,
    externalUrl: (content) => content.tileLink || null,
  },

  // Matches image.ts — border and colour adjacent, crop after them.
  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON, CROP_BUTTON, TILE_LINK],

  matchUrl: (url) => isDirectVideoUrl(url),
  parseUrl: (url) => ({ src: url }),
};
