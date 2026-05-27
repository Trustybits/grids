import { ContentType, type EmbedContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE } from "@/registries/tileToolbar/baseButtons";
import { normalizeEmbedSrc } from "@/utils/TileUtils";

export const embedDefinition: TileDefinition<EmbedContent> = {
  type: ContentType.EMBED,
  label: "Embed",
  category: "embed",

  component: () => import("@/components/tilecontent/EmbedContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.EMBED,
    src: normalizeEmbedSrc(data?.src || ""),
  }),

  validate: (content) => !!content.src && content.src.startsWith("http"),

  capabilities: {
    caption: false,
    border: true,
  },

  editMode: "none",

  actions: {
    copyContent: (content) => content.src || null,
    externalUrl: (content) => content.src || null,
  },

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE],
};
