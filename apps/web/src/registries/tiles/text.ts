import { ContentType, type TextContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON } from "@/registries/tileToolbar/baseButtons";
import { TEXT_ALIGN_BUTTON, TEXT_MORE_MENU } from "@/registries/tileToolbar/textButtons";

export const textDefinition: TileDefinition<TextContent> = {
  type: ContentType.TEXT,
  label: "Text",
  category: "text",

  component: () => import("@/components/tilecontent/TextContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.TEXT,
    text: data?.text || "",
    font: data?.font || "Arial",
    fontSize: data?.fontSize || 14,
    isBold: data?.isBold || false,
    isItalic: data?.isItalic || false,
    textType: data?.textType || "",
    color: data?.color || "#ffffff",
    textAlign: data?.textAlign,
    tileLink: data?.tileLink,
    backgroundColor: data?.backgroundColor,
  }),

  validate: (content) => content.text.trim().length > 0,

  capabilities: {
    caption: false,
    border: true,
    tileLink: true,
  },

  colorTheming: {
    backgroundColor: true,
    textColor: true,
  },

  editMode: "richtext",

  actions: {
    copyContent: (content) => {
      if (!content.text) return null;
      try {
        const doc = JSON.parse(content.text);
        // A tiptap doc is always an object; a primitive (number, boolean, or a
        // JSON-quoted string) parses successfully but has no text/content, so
        // fall back to the raw string rather than silently dropping it.
        if (typeof doc !== "object" || doc === null) return content.text;
        const extractText = (node: { text?: string; content?: unknown[] }): string => {
          if (node.text) return node.text;
          if (node.content) return (node.content as typeof node[]).map(extractText).join("");
          return "";
        };
        return extractText(doc);
      } catch {
        return content.text;
      }
    },
    externalUrl: (content) => content.tileLink || null,
  },

  toolbar: [
    ...RESIZE_PRESETS,
    BORDER_TOGGLE,
    COLOR_BUTTON,
    TEXT_ALIGN_BUTTON,
    TEXT_MORE_MENU,
  ],
};
