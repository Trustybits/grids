import { ContentType, type ChatContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_3x2, RESIZE_4x2, RESIZE_4x4 } from "@/registries/tileToolbar/baseButtons";

export const chatDefinition: TileDefinition<ChatContent> = {
  type: ContentType.CHAT,
  label: "Chat",
  category: "social",

  component: () => import("@/components/tilecontent/ChatContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.CHAT,
    messages: data?.messages || [],
  }),

  validate: () => true,

  capabilities: {
    caption: false,
    border: true,
  },

  editMode: "composer",

  extraProps: (tile) => ({ tileId: tile.i }),

  toolbar: [RESIZE_3x2, RESIZE_4x2, RESIZE_4x4],
};
