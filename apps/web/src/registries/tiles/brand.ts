import { ContentType, type BrandShowcaseContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import {
  RESIZE_PRESETS,
  BORDER_TOGGLE,
  COLOR_BUTTON,
} from "@/registries/tileToolbar/baseButtons";

const DEFAULT_ICON_SIZE = 32;
const DEFAULT_GAP = 12;

export const brandDefinition: TileDefinition<BrandShowcaseContent> = {
  type: ContentType.BRAND,
  label: "Brands",
  category: "media",
  featureFlag: "beta-brand-tile",

  component: () => import("@/components/tilecontent/BrandShowcaseContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.BRAND,
    items: data?.items ?? [],
    iconSize: data?.iconSize ?? DEFAULT_ICON_SIZE,
    gap: data?.gap ?? DEFAULT_GAP,
    backgroundColor: data?.backgroundColor,
    customTitle: data?.customTitle,
  }),

  // Empty is allowed so a freshly added tile can be configured in place,
  // mirroring the roadmap/documents tiles.
  validate: (content) => Array.isArray(content.items),

  capabilities: {
    caption: true,
    border: true,
  },

  colorTheming: {
    backgroundColor: true,
  },

  editMode: "fields",

  extraProps: (tile) => ({ tileId: tile.i }),

  defaultSize: { w: 4, h: 1 },

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
};
