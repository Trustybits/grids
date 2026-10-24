import { ContentType, type XPostContent } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import {
  BORDER_TOGGLE,
  RESIZE_2x2,
  RESIZE_2x4,
  RESIZE_4x2,
  RESIZE_4x4,
} from "@/registries/tileToolbar/baseButtons";

export const xPostDefinition: TileDefinition<XPostContent> = {
  type: ContentType.X_POST,
  label: "X Post",
  category: "social",

  component: () => import("@/components/tilecontent/XPostContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.X_POST,
    postId: data?.postId || "",
    postUrl: data?.postUrl || "",
    post: data?.post,
    quotedPost: data?.quotedPost,
    unavailable: data?.unavailable,
    fetchedAt: data?.fetchedAt,
  }),

  validate: (content) => /^\d+$/.test(content.postId) && !!content.postUrl,

  defaultSize: { w: 4, h: 4 },

  capabilities: {
    caption: false,
    border: true,
  },

  editMode: "none",

  actions: {
    copyContent: (content) => content.post?.postUrl || content.postUrl || null,
    externalUrl: (content) => content.post?.postUrl || content.postUrl || null,
  },

  toolbar: [RESIZE_2x2, RESIZE_2x4, RESIZE_4x2, RESIZE_4x4, BORDER_TOGGLE],
};
