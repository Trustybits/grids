import { ContentType, type ImageContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { isDirectImageUrl } from "@/utils/TileUtils";
import { RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON } from "@/registries/tileToolbar/sharedButtons";
import { CROP_BUTTON } from "@/registries/tileToolbar/cropButton";
import { TILE_LINK } from "@/registries/tileToolbar/tileLinkButton";

export const imageDefinition: TileDefinition<ImageContent> = {
  type: ContentType.IMAGE,
  label: "Image",
  category: "media",

  component: () => import("@/components/tilecontent/ImageContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.IMAGE,
    src: data?.src || "",
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

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, CROP_BUTTON, COLOR_BUTTON, TILE_LINK],

  matchUrl: (url) => isDirectImageUrl(url),
  parseUrl: (url) => ({ src: url }),
};
