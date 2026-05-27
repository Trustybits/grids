import { ContentType, type DocumentsContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON } from "@/registries/tileToolbar/baseButtons";

export const documentDefinition: TileDefinition<DocumentsContent> = {
  type: ContentType.DOCUMENT,
  label: "Documents",
  category: "utility",
  featureFlag: "beta-documents",

  component: () => import("@/components/tilecontent/DocumentsContent.vue"),

  defaultContent: (data) => {
    const payload: DocumentsContent = {
      type: ContentType.DOCUMENT,
      items: data?.items ?? [],
    };
    if (typeof data?.backgroundColor === "string" && data.backgroundColor !== "") {
      payload.backgroundColor = data.backgroundColor;
    }
    if (typeof data?.customTitle === "string") {
      payload.customTitle = data.customTitle;
    }
    if (typeof data?.customDescription === "string") {
      payload.customDescription = data.customDescription;
    }
    return payload;
  },

  validate: (content) =>
    Array.isArray(content.items) &&
    content.items.length > 0 &&
    content.items.every(
      (item) =>
        !!item.id &&
        typeof item.fileName === "string" &&
        item.fileName.length > 0 &&
        typeof item.url === "string" &&
        (item.url.startsWith("http") ||
          item.url.startsWith("blob:") ||
          item.url.startsWith("data:")),
    ),

  capabilities: {
    caption: false,
    border: true,
  },

  colorTheming: {
    backgroundColor: true,
    textColor: true,
  },

  editMode: "fields",

  extraProps: (tile) => ({ tileId: tile.i }),

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
};
