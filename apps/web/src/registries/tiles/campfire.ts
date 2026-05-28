import { ContentType, type CampfireContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE } from "@/registries/tileToolbar/baseButtons";

export const campfireDefinition: TileDefinition<CampfireContent> = {
  type: ContentType.CAMPFIRE,
  label: "Campfire",
  category: "game",

  component: () => import("@/components/tilecontent/CampfireContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.CAMPFIRE,
    count: data?.count || 0,
    highScore: data?.highScore || 0,
  }),

  validate: () => true,

  capabilities: {
    caption: false,
    border: true,
  },

  editMode: "none",

  maxPerGrid: 1,

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE],
};
