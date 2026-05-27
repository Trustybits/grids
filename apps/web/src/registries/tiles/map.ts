import { ContentType, type MapContent } from "@/types/TileContent";
import type { TileDefinition } from "@/types/TileDefinition";
import { RESIZE_4x4, RESIZE_2x4, RESIZE_4x2 } from "@/registries/tileToolbar/sharedButtons";
import { MAP_DEFAULT, MAP_PAN, MAP_SEARCH, MAP_RECENTER } from "@/registries/tileToolbar/mapButtons";

export const mapDefinition: TileDefinition<MapContent> = {
  type: ContentType.MAP,
  label: "Map",
  category: "utility",

  component: () => import("@/components/tilecontent/MapContent.vue"),

  defaultContent: (data) => ({
    type: ContentType.MAP,
    provider: "mapbox",
    center: data?.center || { lat: 0, lng: 0 },
    zoom: data?.zoom ?? 9,
    bearing: data?.bearing ?? 0,
    pitch: data?.pitch ?? 0,
    style: data?.style || "default",
    show3d: data?.show3d ?? false,
    showClouds: data?.showClouds ?? true,
    showPlanes: data?.showPlanes ?? true,
    searchQuery: data?.searchQuery,
    marker: data?.marker,
  }),

  validate: (content) =>
    content.provider === "mapbox" &&
    Number.isFinite(content.center?.lat) &&
    Number.isFinite(content.center?.lng),

  capabilities: {
    caption: true,
    border: true,
  },

  editMode: "interactive",

  toolbar: [RESIZE_4x4, RESIZE_2x4, RESIZE_4x2, MAP_DEFAULT, MAP_PAN, MAP_SEARCH, MAP_RECENTER],
};
