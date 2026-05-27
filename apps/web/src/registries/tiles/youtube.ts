import { ContentType, type YouTubeContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";

export const youtubeDefinition: TileDefinition<YouTubeContent> = {
  type: ContentType.YOUTUBE,
  label: "YouTube",
  category: "media",

  component: () => import("@/components/tilecontent/YouTubeContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.YOUTUBE,
    youtubeUrl: data?.youtubeUrl || "",
    youtubeType: data?.youtubeType || "video",
    youtubeId: data?.youtubeId || "",
    title: data?.title,
    description: data?.description,
    thumbnails: data?.thumbnails,
    publishedAt: data?.publishedAt,
    channelTitle: data?.channelTitle,
    channelId: data?.channelId,
    channelThumbnail: data?.channelThumbnail,
    duration: data?.duration,
    viewCount: data?.viewCount,
    likeCount: data?.likeCount,
    commentCount: data?.commentCount,
    categoryId: data?.categoryId,
    itemCount: data?.itemCount,
    playlistItems: data?.playlistItems,
    channelData: data?.channelData,
    recentVideos: data?.recentVideos,
  }),

  validate: (content) => !!content.youtubeUrl && !!content.youtubeId,

  capabilities: {
    caption: false,
  },

  editMode: "none",

  actions: {
    copyContent: (content) => content.youtubeUrl || null,
    externalUrl: (content) => content.youtubeUrl || null,
  },
};
