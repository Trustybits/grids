import { ContentType, type XProfileContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import {
  BORDER_TOGGLE,
  RESIZE_2x2,
  RESIZE_2x4,
  RESIZE_4x2,
  RESIZE_4x4,
} from "@/registries/tileToolbar/baseButtons";

export const xProfileDefinition: TileDefinition<XProfileContent> = {
  type: ContentType.X_PROFILE,
  label: "X Profile",
  category: "social",
  featureFlag: "social-x-feeds",

  component: () => import("@/components/tilecontent/XProfileContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.X_PROFILE,
    screenName: data?.screenName || "",
    profileUrl: data?.profileUrl || "",
    profile: data?.profile,
    posts: data?.posts,
    pinnedPostId: data?.pinnedPostId,
    unavailable: data?.unavailable,
    fetchedAt: data?.fetchedAt,
  }),

  validate: (content) =>
    /^[A-Za-z0-9_]{1,15}$/.test(content.screenName) && !!content.profileUrl,

  defaultSize: { w: 4, h: 4 },

  capabilities: {
    caption: false,
    border: true,
  },

  editMode: "none",

  actions: {
    copyContent: (content) => content.profile?.profileUrl || content.profileUrl || null,
    externalUrl: (content) => content.profile?.profileUrl || content.profileUrl || null,
  },

  toolbar: [RESIZE_2x2, RESIZE_2x4, RESIZE_4x2, RESIZE_4x4, BORDER_TOGGLE],
};
