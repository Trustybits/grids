import { ContentType, type ProfileBioContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON } from "@/registries/tileToolbar/sharedButtons";

export const profileDefinition: TileDefinition<ProfileBioContent> = {
  type: ContentType.PROFILE,
  label: "Profile",
  category: "social",

  component: () => import("@/components/tilecontent/ProfileBioContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.PROFILE,
    name: data?.name || "",
    title: data?.title || "",
    bio: data?.bio || "",
    avatarShape: data?.avatarShape || "square",
    avatarRadius: data?.avatarRadius ?? 12,
    avatarSides: data?.avatarSides ?? 6,
    profilePhotoUrl: data?.profilePhotoUrl ?? "",
    backgroundColor: data?.backgroundColor,
  }),

  validate: () => true,

  defaultSize: { w: 4, h: 4 },

  capabilities: {
    caption: false,
    border: true,
  },

  colorTheming: {
    backgroundColor: true,
    textColor: true,
  },

  editMode: "richtext",

  toolbar: [...RESIZE_PRESETS, BORDER_TOGGLE, COLOR_BUTTON],
};
