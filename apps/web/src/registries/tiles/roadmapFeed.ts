import { ContentType, type RoadmapFeedContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON } from "@/registries/tileToolbar/baseButtons";

export const roadmapFeedDefinition: TileDefinition<RoadmapFeedContent> = {
  type: ContentType.ROADMAP_FEED,
  label: "Roadmap",
  category: "utility",
  featureFlag: "beta-roadmap-feed",

  component: () => import("@/components/tilecontent/RoadmapFeedContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.ROADMAP_FEED,
    notionDatabaseId: data?.notionDatabaseId || "",
    statusPropertyName: data?.statusPropertyName || "",
    upvotePropertyName: data?.upvotePropertyName || "",
    statusMapping: data?.statusMapping || {},
    queryFilters: data?.queryFilters,
    cachedItems: data?.cachedItems,
    lastSyncedAt: data?.lastSyncedAt,
  }),

  validate: () => true,

  capabilities: {
    caption: true,
    border: true,
  },

  colorTheming: {
    backgroundColor: true,
  },

  editMode: "settings",

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
};
