import { markRaw } from "vue";
import type { ToolbarButton } from "@/types/TileToolbar";

import MapPanIcon from "@/components/icons/toolbar/MapPanIcon.vue";
import PlaneIcon from "@/components/icons/toolbar/PlaneIcon.vue";
import MapSearchIcon from "@/components/icons/toolbar/MapSearchIcon.vue";
import LocateFixedIcon from "@/components/icons/toolbar/LocateFixedIcon.vue";
import DefaultMapIcon from "@/components/icons/toolbar/DefaultMapIcon.vue";
import CloudsIcon from "@/components/icons/toolbar/CloudsIcon.vue";

export const MAP_PAN: ToolbarButton = {
  id: "map-pan",
  icon: markRaw(MapPanIcon),
  title: "Pan / Zoom",
  group: "map-style",
  action: (ctx) => {
    if (!ctx.childComponent.value?.toggleEditMode) return;
    ctx.childComponent.value.toggleEditMode();
    if (ctx.childComponent.value?.isEditing !== undefined) {
      ctx.isEditing.value = ctx.childComponent.value.isEditing;
    }
  },
  isActive: (ctx) => ctx.isEditing.value,
};

export const MAP_PLANE: ToolbarButton = {
  id: "map-plane",
  icon: markRaw(PlaneIcon),
  title: "Toggle plane",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.togglePlanes?.(),
  isActive: (ctx) => !!ctx.childComponent.value?.showPlanes,
};

export const MAP_SEARCH: ToolbarButton = {
  id: "map-search",
  icon: markRaw(MapSearchIcon),
  title: "Search",
  group: "map-style",
  panelId: "search",
  action: () => {
    // Panel open/close is handled by TileToolbar via the panelId presence
  },
};

// Flies the camera back to the saved marker (or center) location.
export const MAP_RECENTER: ToolbarButton = {
  id: "map-recenter",
  icon: markRaw(LocateFixedIcon),
  title: "Re-center on location",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.recenterOnMarker?.(),
};

export const MAP_DEFAULT: ToolbarButton = {
  id: "map-default",
  icon: markRaw(DefaultMapIcon),
  title: "Default view",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.toggleDefaultStyle?.(),
  isActive: (ctx) => !!ctx.childComponent.value?.isDefaultStyle,
};

export const MAP_CLOUDS: ToolbarButton = {
  id: "map-clouds",
  icon: markRaw(CloudsIcon),
  title: "Toggle clouds",
  group: "map-style",
  action: (ctx) => ctx.childComponent.value?.toggleClouds?.(),
  isActive: (ctx) => !!ctx.childComponent.value?.showClouds,
};
