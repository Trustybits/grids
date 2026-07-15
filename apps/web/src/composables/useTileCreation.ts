import { computed, markRaw, type Component } from "vue";
import { ContentType } from "@grids/contracts/types";
import { createTileContent } from "@/utils/TileUtils";
import { useGridController } from "@/controllers/useGridController";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useTileInput } from "@/composables/useTileInput";
import { useFeatureFlags, FEATURE_FLAGS } from "@/composables/useFeatureFlags";
import { isValidLink, isValidEmbed } from "@/utils/UrlValidation";
import TextLegacyIcon from "@/components/icons/appbar/TextLegacyIcon.vue";
import AppBarTextIcon from "@/components/icons/appbar/TextIcon.vue";
import ProfileTileIcon from "@/components/icons/ProfileTileIcon.vue";
import ChatIcon from "@/components/icons/ChatIcon.vue";
import ImageIcon from "@/components/icons/ImageIcon.vue";
import DocumentsIcon from "@/components/icons/appbar/DocumentsIcon.vue";
import LinkTileIcon from "@/components/icons/LinkTileIcon.vue";
import EmbedIcon from "@/components/icons/EmbedIcon.vue";
import MapIcon from "@/components/icons/MapIcon.vue";
import CampfireIcon from "@/components/icons/CampfireIcon.vue";

/**
 * How a tile type is added from the mobile carousel:
 *  - "create"  : create the tile immediately on tap
 *  - "file"    : open a file picker (the host component owns the <input>)
 *  - "command" : focus the /TILE command input so the user can paste a URL
 */
export type TileTypeKind = "create" | "file" | "command";

export interface TileTypeDescriptor {
  /** Stable id used for filtering, keys, and select events. */
  id: string;
  label: string;
  icon: Component;
  /** Extra search terms so filtering matches intent, not just the label. */
  keywords: string[];
  kind: TileTypeKind;
  /** Present for `kind: "create"`. */
  contentType?: ContentType;
  /** Optional feature flag gating visibility (mirrors GridToolbar). */
  flag?: string;
}

// Order mirrors the Figma "New Tile Carousel" (1497-9533).
const ALL_TILE_TYPES: readonly TileTypeDescriptor[] = [
  {
    id: "text",
    label: "Text",
    icon: markRaw(TextLegacyIcon),
    keywords: ["text", "note", "markdown", "md", "write"],
    kind: "create",
    contentType: ContentType.TEXT,
  },
  {
    id: "profile",
    label: "Profile",
    icon: markRaw(ProfileTileIcon),
    keywords: ["profile", "about", "bio", "me"],
    kind: "create",
    contentType: ContentType.PROFILE,
  },
  {
    id: "chat",
    label: "Chat",
    icon: markRaw(ChatIcon),
    keywords: ["chat", "message", "guestbook", "comment"],
    kind: "create",
    contentType: ContentType.CHAT,
  },
  {
    id: "image",
    label: "Image / Video",
    icon: markRaw(ImageIcon),
    keywords: ["image", "photo", "picture", "video", "media", "upload"],
    kind: "file",
  },
  {
    id: "document",
    label: "Document",
    icon: markRaw(DocumentsIcon),
    keywords: ["document", "pdf", "doc", "file", "upload"],
    kind: "file",
    flag: FEATURE_FLAGS.BETA_DOCUMENTS,
  },
  {
    id: "link",
    label: "Link",
    icon: markRaw(LinkTileIcon),
    keywords: ["link", "url", "bookmark", "website"],
    kind: "command",
  },
  {
    id: "embed",
    label: "Embed",
    icon: markRaw(EmbedIcon),
    keywords: ["embed", "youtube", "spotify", "music", "iframe", "video"],
    kind: "command",
  },
  {
    id: "map",
    label: "Map",
    icon: markRaw(MapIcon),
    keywords: ["map", "location", "place", "address"],
    // "command": tapping focuses the input so the user can type a location;
    // ENTER creates the map tile with that location (empty = current location).
    kind: "command",
    contentType: ContentType.MAP,
  },
  {
    id: "campfire",
    label: "Campfire",
    icon: markRaw(CampfireIcon),
    keywords: ["campfire", "fire", "ambient"],
    kind: "create",
    contentType: ContentType.CAMPFIRE,
  },
  {
    id: "smart_text",
    label: "Smart Text",
    icon: markRaw(AppBarTextIcon),
    keywords: ["smart text", "ai", "text"],
    kind: "create",
    contentType: ContentType.SMART_TEXT,
    flag: FEATURE_FLAGS.EDITOR_SMART_TEXT,
  },
];

/** Text/Smart Text tiles get auto-focused so the user can type immediately. */
const AUTO_FOCUS_TYPES = new Set<ContentType>([
  ContentType.TEXT,
  ContentType.SMART_TEXT,
]);

const matchesQuery = (descriptor: TileTypeDescriptor, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (descriptor.label.toLowerCase().includes(needle)) return true;
  return descriptor.keywords.some((keyword) => keyword.includes(needle));
};

/**
 * Centralized tile creation for the Mobile 2.0 Add-a-Tile surfaces (carousel +
 * `/TILE` command input). Owns the tile-type registry and the create/add
 * actions; DOM-bound concerns (file <input>s) stay in the host component via
 * the `kind: "file"` descriptors.
 */
export const useTileCreation = () => {
  const controller = useGridController();
  const uiStore = useGridUiStore();
  const { submitLink } = useTileInput();
  const { isEnabled } = useFeatureFlags();

  const tileTypes = computed(() =>
    ALL_TILE_TYPES.filter((type) => !type.flag || isEnabled(type.flag)),
  );

  const filterTileTypes = (query: string): TileTypeDescriptor[] =>
    tileTypes.value.filter((type) => matchesQuery(type, query));

  const createTile = (
    contentType: ContentType,
    options: Record<string, unknown> = {},
  ): string | null => {
    const content = createTileContent(contentType, options);
    const tileId = controller.addTile(content);
    if (tileId && AUTO_FOCUS_TYPES.has(contentType)) {
      uiStore.setPendingFocusTileId(tileId);
    }
    return tileId;
  };

  /**
   * ENTER handler for the `/TILE` input. A pasted URL / embed becomes the
   * matching rich tile; otherwise a keyword that resolves to a "create" tile
   * type creates it. Returns the new tile id, or null when nothing was created
   * (e.g. the text is only being used to filter the carousel).
   */
  const submitCommand = async (raw: string): Promise<string | null> => {
    const text = (raw || "").trim();
    if (!text) return null;

    if (isValidLink(text) || isValidEmbed(text)) {
      return submitLink(text, { mode: "add" });
    }

    const match = filterTileTypes(text).find((type) => type.kind === "create");
    if (match?.contentType) {
      return createTile(match.contentType);
    }

    return null;
  };

  return {
    tileTypes,
    filterTileTypes,
    createTile,
    submitCommand,
  };
};
