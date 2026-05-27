import { ContentType, type MusicContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import {
  RESIZE_1x1,
  RESIZE_2x3,
  RESIZE_2x2,
  RESIZE_4x2,
  RESIZE_4x4,
} from "@/registries/tileToolbar/baseButtons";

export const musicDefinition: TileDefinition<MusicContent> = {
  type: ContentType.MUSIC,
  label: "Music",
  category: "media",

  component: () => import("@/components/tilecontent/MusicContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.MUSIC,
    platform: data?.platform || "spotify",
    trackId: data?.trackId || "",
    trackType: data?.trackType,
    trackName: data?.trackName || "",
    artistName: data?.artistName || "",
    albumArt: data?.albumArt || "",
    previewUrl: data?.previewUrl || "",
    trackUrl: data?.trackUrl || "",
    artistUrl: data?.artistUrl || "",
    backgroundColor: data?.backgroundColor || "",
    backgroundTinted: data?.backgroundTinted || "",
    textSubdued: data?.textSubdued || "",
  }),

  validate: (content) => !!content.trackId && !!content.platform,

  capabilities: {
    caption: false,
  },

  editMode: "none",

  actions: {
    copyContent: (content) => content.trackUrl || null,
    externalUrl: (content) => content.trackUrl || null,
  },

  toolbar: [RESIZE_1x1, RESIZE_2x3, RESIZE_2x2, RESIZE_4x2, RESIZE_4x4],
};
