import { ContentType, type SuggestionContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";

export const suggestionDefinition: TileDefinition<SuggestionContent> = {
  type: ContentType.SUGGESTION,
  label: "Suggestion",
  category: "utility",

  component: () =>
    Promise.resolve({ default: null as never }),

  defaultContent: (data) => {
    const payload: SuggestionContent = {
      type: ContentType.SUGGESTION,
      action: data?.action || "text",
    };
    if (typeof data?.icon === "string") payload.icon = data.icon;
    if (typeof data?.label === "string") payload.label = data.label;
    return payload;
  },

  validate: () => true,

  capabilities: {
    caption: false,
    duplicate: false,
    resizable: false,
  },

  editMode: "none",
};
