<template>
  <div class="map-tile" :class="{ 'is-editing': isEditing }">
    <div
      ref="mapContainer"
      class="map-canvas"
      :class="{ 'is-interactive': isInteractive }"
    ></div>

    <div v-if="showClouds" class="map-overlay map-clouds" aria-hidden="true">
      <div class="map-cloud layer-a"></div>
      <div class="map-cloud layer-b"></div>
      <div class="map-cloud layer-c"></div>
    </div>

    <div v-if="showPlanes" class="map-overlay map-plane" aria-hidden="true">
      <div class="plane-group">
        <span class="plane-trail"></span>
        <img class="plane-icon" :src="planeIcon" alt="" />
      </div>
    </div>

    <div v-if="!hasToken" class="map-empty-state">
      Add <strong>VITE_MAPBOX_TOKEN</strong> to enable maps.
    </div>

    <div v-if="layoutStore.isOwner && isEditing" class="map-toolbar" @mousedown.stop>
      <form class="map-search" @submit.prevent="handleSearch">
        <input
          v-model="searchInput"
          class="map-input"
          type="text"
          placeholder="Search for a location"
        />
        <button class="map-btn" type="submit">Search</button>
        <button class="map-btn map-btn--ghost" type="button" @click="useMyLocation">
          My location
        </button>
      </form>

      <div v-if="statusMessage" class="map-status">{{ statusMessage }}</div>

      <div class="map-options">
        <label class="map-select">
          <span>Style</span>
          <select v-model="styleMode">
            <option value="auto">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="dawn">Dawn</option>
            <option value="day">Day</option>
            <option value="dusk">Dusk</option>
            <option value="night">Night</option>
            <option value="satellite">Satellite</option>
          </select>
        </label>
        <label class="map-toggle">
          <input type="checkbox" v-model="show3d" />
          3D
        </label>
        <label class="map-toggle">
          <input type="checkbox" v-model="showClouds" />
          Clouds
        </label>
        <label class="map-toggle">
          <input type="checkbox" v-model="showPlanes" />
          Planes
        </label>
      </div>
    </div>

    <button
      v-if="layoutStore.isOwner"
      class="map-edit-btn hover-display"
      :class="{ 'is-active': isEditing }"
      :style="{ display: isEditing ? 'flex' : '' }"
      @click.stop="toggleEditMode"
    >
      {{ isEditing ? "Done" : "Edit" }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from "vue";
import mapboxgl from "mapbox-gl";
import planeIcon from "@/svgs/icons/airplane2.svg";
import { useLayoutStore } from "@/stores/layout";
import { useThemeStore } from "@/stores/theme";
import { type MapContent, type MapStyleMode } from "@/types/TileContent";

type MapStylePreset = {
  style: string;
  light?: {
    anchor?: "map" | "viewport";
    color?: string;
    intensity?: number;
    position?: [number, number, number];
  };
  fog?: {
    color?: string;
    "high-color"?: string;
    "space-color"?: string;
    "horizon-blend"?: number;
    "star-intensity"?: number;
  };
};

const MAP_STYLE_PRESETS: Record<Exclude<MapStyleMode, "auto">, MapStylePreset> = {
  light: {
    style: "mapbox://styles/mapbox/light-v11",
    light: {
      anchor: "map",
      color: "#ffffff",
      intensity: 0.45,
      position: [1.2, 200, 35],
    },
  },
  dark: {
    style: "mapbox://styles/mapbox/dark-v11",
    light: {
      anchor: "map",
      color: "#b8c7ff",
      intensity: 0.28,
      position: [1.05, 220, 20],
    },
    fog: {
      color: "#0a0f1f",
      "high-color": "#1a2a4a",
      "space-color": "#03050c",
      "horizon-blend": 0.08,
    },
  },
  dawn: {
    style: "mapbox://styles/mapbox/outdoors-v12",
    light: {
      anchor: "map",
      color: "#ffd7b2",
      intensity: 0.38,
      position: [1.1, 120, 28],
    },
    fog: {
      color: "#f4c3a5",
      "high-color": "#f9d4b7",
      "space-color": "#fbe4cc",
      "horizon-blend": 0.2,
    },
  },
  day: {
    style: "mapbox://styles/mapbox/navigation-day-v1",
    light: {
      anchor: "map",
      color: "#fff4dc",
      intensity: 0.55,
      position: [1.25, 180, 45],
    },
    fog: {
      color: "#d7e6ff",
      "high-color": "#c0d9ff",
      "space-color": "#eef4ff",
      "horizon-blend": 0.12,
    },
  },
  dusk: {
    style: "mapbox://styles/mapbox/streets-v12",
    light: {
      anchor: "map",
      color: "#f3b28b",
      intensity: 0.32,
      position: [1.05, 250, 22],
    },
    fog: {
      color: "#a47aa7",
      "high-color": "#7c79b6",
      "space-color": "#222448",
      "horizon-blend": 0.24,
      "star-intensity": 0.2,
    },
  },
  night: {
    style: "mapbox://styles/mapbox/navigation-night-v1",
    light: {
      anchor: "map",
      color: "#8aa5ff",
      intensity: 0.22,
      position: [1.0, 260, 16],
    },
    fog: {
      color: "#05070f",
      "high-color": "#0d1424",
      "space-color": "#020409",
      "horizon-blend": 0.08,
      "star-intensity": 0.35,
    },
  },
  satellite: {
    style: "mapbox://styles/mapbox/satellite-streets-v12",
    light: {
      anchor: "map",
      color: "#ffffff",
      intensity: 0.5,
      position: [1.2, 190, 30],
    },
  },
};

const resolveStyle = (mode: MapStyleMode, isDarkMode: boolean) => {
  if (mode === "auto") {
    return isDarkMode ? MAP_STYLE_PRESETS.dark.style : MAP_STYLE_PRESETS.light.style;
  }
  return MAP_STYLE_PRESETS[mode].style;
};

const resolvePreset = (mode: MapStyleMode, isDarkMode: boolean) => {
  if (mode === "auto") {
    return isDarkMode ? MAP_STYLE_PRESETS.dark : MAP_STYLE_PRESETS.light;
  }
  return MAP_STYLE_PRESETS[mode];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default defineComponent({
  props: {
    content: {
      type: Object as () => MapContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const themeStore = useThemeStore();
    const mapContainer = ref<HTMLDivElement | null>(null);
    const mapInstance = ref<mapboxgl.Map | null>(null);
    const isEditing = ref(false);
    const searchInput = ref(props.content.searchQuery || "");
    const statusMessage = ref<string | null>(null);
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const hasToken = computed(() => !!token);

    const styleMode = computed<MapStyleMode>({
      get: () => props.content.style || "auto",
      set: (value) => {
        props.content.style = value;
        layoutStore.saveLayout();
      },
    });

    const isInteractive = computed(() => !layoutStore.isOwner || isEditing.value);

    const show3d = computed({
      get: () => props.content.show3d ?? false,
      set: (value: boolean) => {
        props.content.show3d = value;
        layoutStore.saveLayout();
        apply3d(value);
      },
    });

    const showClouds = computed({
      get: () => props.content.showClouds ?? false,
      set: (value: boolean) => {
        props.content.showClouds = value;
        layoutStore.saveLayout();
      },
    });

    const showPlanes = computed({
      get: () => props.content.showPlanes ?? false,
      set: (value: boolean) => {
        props.content.showPlanes = value;
        layoutStore.saveLayout();
      },
    });

    const resolvedStyle = computed(() => resolveStyle(styleMode.value, themeStore.isDarkMode));

    const saveLayout = () => {
      layoutStore.saveLayout();
    };

    const setMapInteractivity = (enabled: boolean) => {
      const map = mapInstance.value;
      if (!map) return;
      if (enabled) {
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.dragRotate.enable();
        map.doubleClickZoom.enable();
        map.keyboard.enable();
        map.touchZoomRotate.enable();
      } else {
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.dragRotate.disable();
        map.doubleClickZoom.disable();
        map.keyboard.disable();
        map.touchZoomRotate.disable();
      }
    };

    const syncContentFromMap = () => {
      if (!layoutStore.isOwner) return;
      const map = mapInstance.value;
      if (!map) return;
      const center = map.getCenter();
      props.content.center = {
        lat: Number(center.lat.toFixed(6)),
        lng: Number(center.lng.toFixed(6)),
      };
      props.content.zoom = Number(map.getZoom().toFixed(2));
      props.content.bearing = Number(map.getBearing().toFixed(2));
      props.content.pitch = Number(map.getPitch().toFixed(2));
      saveLayout();
    };

    const flyToLocation = (center: { lat: number; lng: number }, zoom?: number) => {
      const map = mapInstance.value;
      const targetZoom = zoom ?? props.content.zoom ?? 9;
      if (layoutStore.isOwner) {
        props.content.center = center;
        props.content.zoom = targetZoom;
        saveLayout();
      }
      if (map) {
        map.easeTo({
          center: [center.lng, center.lat],
          zoom: targetZoom,
          duration: 800,
        });
      }
    };

    const handleGeocode = async (query: string) => {
      if (!token) {
        statusMessage.value = "Missing Mapbox token.";
        return;
      }
      statusMessage.value = "Searching...";
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${token}&limit=1`;
        const response = await fetch(url);
        if (!response.ok) {
          statusMessage.value = "Search failed.";
          return;
        }
        const data = await response.json();
        const match = data.features?.[0];
        if (!match?.center) {
          statusMessage.value = "No results found.";
          return;
        }
        statusMessage.value = null;
        const [lng, lat] = match.center as [number, number];
        flyToLocation({ lat, lng }, clamp(props.content.zoom ?? 9, 9, 14));
      } catch (error) {
        console.error("Mapbox search failed:", error);
        statusMessage.value = "Search failed.";
      }
    };

    const useMyLocation = () => {
      if (!layoutStore.isOwner) return;
      if (!navigator.geolocation) {
        statusMessage.value = "Geolocation not supported.";
        return;
      }
      statusMessage.value = "Locating...";
      navigator.geolocation.getCurrentPosition(
        (position) => {
          statusMessage.value = null;
          flyToLocation(
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
            clamp(props.content.zoom ?? 9, 10, 14)
          );
        },
        () => {
          statusMessage.value = "Unable to get location.";
        }
      );
    };

    const handleSearch = async () => {
      const query = searchInput.value.trim();
      props.content.searchQuery = query || undefined;
      saveLayout();
      if (!query) {
        useMyLocation();
        return;
      }
      await handleGeocode(query);
    };

    const enable3d = (map: mapboxgl.Map) => {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.1 });
      if (!map.getLayer("3d-buildings")) {
        map.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#a3acb6",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.6,
          },
        });
      }
    };

    const disable3d = (map: mapboxgl.Map) => {
      if (map.getLayer("3d-buildings")) {
        map.removeLayer("3d-buildings");
      }
      map.setTerrain(null);
      if (map.getSource("mapbox-dem")) {
        try {
          map.removeSource("mapbox-dem");
        } catch (error) {
          console.warn("Failed to remove terrain source:", error);
        }
      }
    };

    const apply3d = (enabled: boolean) => {
      const map = mapInstance.value;
      if (!map) return;
      const apply = () => {
        if (enabled) {
          enable3d(map);
          map.easeTo({ pitch: 25, duration: 500 });
        } else {
          disable3d(map);
          map.easeTo({ pitch: 0, duration: 500 });
        }
      };
      if (map.isStyleLoaded()) {
        apply();
      } else {
        map.once("style.load", apply);
      }
    };

    const applyStylePreset = (preset: MapStylePreset) => {
      const map = mapInstance.value as mapboxgl.Map & {
        setLight?: (light: MapStylePreset["light"]) => void;
        setFog?: (fog: MapStylePreset["fog"] | null) => void;
      } | null;
      if (!map) return;
      if (preset.light) {
        map.setLight?.(preset.light);
      }
      map.setFog?.(preset.fog ?? null);
    };

    const applyActivePreset = () => {
      const map = mapInstance.value;
      if (!map) return;
      const preset = resolvePreset(styleMode.value, themeStore.isDarkMode);
      const apply = () => applyStylePreset(preset);
      if (map.isStyleLoaded()) {
        apply();
      } else {
        map.once("style.load", apply);
      }
    };

    const toggleEditMode = () => {
      if (!layoutStore.isOwner) return;
      isEditing.value = !isEditing.value;
      if (isEditing.value) {
        mapInstance.value?.resize();
      } else {
        saveLayout();
      }
    };

    const onShortClick = () => {
      if (!layoutStore.isOwner || isEditing.value) return;
      toggleEditMode();
    };

    const onExitClick = () => {
      if (!layoutStore.isOwner) return;
      if (!isEditing.value) return;
      isEditing.value = false;
      saveLayout();
    };

    const onResize = () => {
      mapInstance.value?.resize();
    };

    watch(resolvedStyle, (value) => {
      const map = mapInstance.value;
      if (!map) return;
      map.setStyle(value);
    });

    watch([() => styleMode.value, () => themeStore.isDarkMode], () => {
      applyActivePreset();
    });

    watch(isInteractive, (value) => {
      setMapInteractivity(value);
    });

    watch(
      () => props.content.searchQuery,
      (value) => {
        if (value !== undefined && value !== searchInput.value) {
          searchInput.value = value || "";
        }
      }
    );

    onMounted(() => {
      if (!mapContainer.value || !token) return;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapContainer.value,
        style: resolvedStyle.value,
        center: [props.content.center?.lng ?? 0, props.content.center?.lat ?? 0],
        zoom: props.content.zoom ?? 9,
        bearing: props.content.bearing ?? 0,
        pitch: props.content.pitch ?? 0,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      map.on("moveend", syncContentFromMap);
      map.on("style.load", () => {
        apply3d(show3d.value);
        applyActivePreset();
      });

      mapInstance.value = map;
      setMapInteractivity(isInteractive.value);

      applyActivePreset();

      const hasSavedCenter =
        props.content.center &&
        (props.content.center.lat !== 0 || props.content.center.lng !== 0);

      if (layoutStore.isOwner) {
        if (props.content.searchQuery && !hasSavedCenter) {
          handleGeocode(props.content.searchQuery);
        } else if (!hasSavedCenter) {
          useMyLocation();
        }
      }

      if (show3d.value) {
        apply3d(true);
      }
    });

    onUnmounted(() => {
      mapInstance.value?.remove();
    });

    return {
      layoutStore,
      planeIcon,
      mapContainer,
      isEditing,
      isInteractive,
      searchInput,
      statusMessage,
      styleMode,
      show3d,
      showClouds,
      showPlanes,
      handleSearch,
      useMyLocation,
      toggleEditMode,
      onShortClick,
      onExitClick,
      onResize,
      hasToken,
    };
  },
});
</script>

<style scoped lang="scss">
.map-tile {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: var(--tile-border-radius);
}

.map-canvas {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.map-canvas.is-interactive {
  pointer-events: auto;
}

.map-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.map-clouds {
  opacity: 0.5;
  mix-blend-mode: screen;
  filter: blur(6px);
}

.map-cloud {
  position: absolute;
  inset: -25%;
  background-image:
    radial-gradient(circle at 18% 40%, rgba(255, 255, 255, 0.65) 0 22%, transparent 44%),
    radial-gradient(circle at 38% 30%, rgba(255, 255, 255, 0.55) 0 18%, transparent 40%),
    radial-gradient(circle at 58% 45%, rgba(255, 255, 255, 0.6) 0 20%, transparent 42%),
    radial-gradient(circle at 78% 30%, rgba(255, 255, 255, 0.5) 0 18%, transparent 38%),
    radial-gradient(circle at 90% 50%, rgba(255, 255, 255, 0.45) 0 16%, transparent 36%);
  background-size: 320px 200px;
  background-repeat: repeat;
  will-change: transform;
}

.map-cloud.layer-a {
  top: -35%;
  opacity: 0.45;
  animation: cloudDriftSlow 140s linear infinite;
}

.map-cloud.layer-b {
  top: -15%;
  opacity: 0.35;
  filter: blur(10px);
  animation: cloudDriftMid 110s linear infinite;
}

.map-cloud.layer-c {
  top: 5%;
  opacity: 0.25;
  filter: blur(14px);
  animation: cloudDriftFast 90s linear infinite;
}

.map-plane {
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
}

.plane-group {
  position: absolute;
  left: -30%;
  top: 35%;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: planePath 28s linear infinite;
  will-change: transform, opacity;
}

.plane-trail {
  width: 140px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.6));
  filter: blur(1px);
  opacity: 0.7;
}

.plane-icon {
  width: 40px;
  height: 40px;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
  transform: rotate(0deg);
}

.map-empty-state {
  position: absolute;
  inset: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 12px;
  background: color-mix(in srgb, var(--color-tile-background) 75%, transparent);
  border: var(--tile-border-width) dashed var(--color-tile-stroke);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 12px;
  z-index: 1;
}

.map-toolbar {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: color-mix(in srgb, var(--color-tile-background) 88%, transparent);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  z-index: 2;
  backdrop-filter: blur(12px);
}

.map-search {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.map-input {
  flex: 1 1 220px;
  min-width: 160px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  background: var(--color-content-background);
  color: var(--color-text-primary);
  font-size: 12px;
}

.map-input:focus {
  outline: none;
  border-color: var(--color-content-default);
}

.map-btn {
  border: none;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-content-high);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
}

.map-btn--ghost {
  background: color-mix(in srgb, var(--color-tile-background) 70%, transparent);
}

.map-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-primary);
}

.map-select {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-select select {
  background: var(--color-content-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  padding: 4px 6px;
  font-size: 12px;
}

.map-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-toggle input {
  accent-color: var(--color-figma-blue);
}

.map-status {
  font-size: 11px;
  color: var(--color-content-default);
}

.map-edit-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  background: color-mix(in srgb, var(--color-tile-background) 80%, transparent);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
  z-index: 2;
}

.map-edit-btn.is-active {
  background: var(--color-text-primary);
  color: var(--color-tile-background);
}

.map-tile :deep(.mapboxgl-ctrl-top-right) {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.map-tile:hover :deep(.mapboxgl-ctrl-top-right),
.map-tile.is-editing :deep(.mapboxgl-ctrl-top-right) {
  opacity: 1;
  pointer-events: auto;
}

.map-tile :deep(.mapboxgl-ctrl-bottom-right) {
  opacity: 0.45;
  transition: opacity 0.2s ease;
}

.map-tile:hover :deep(.mapboxgl-ctrl-bottom-right),
.map-tile.is-editing :deep(.mapboxgl-ctrl-bottom-right) {
  opacity: 1;
}

@keyframes cloudDriftSlow {
  from {
    transform: translateX(-8%);
  }
  to {
    transform: translateX(8%);
  }
}

@keyframes cloudDriftMid {
  from {
    transform: translateX(-12%);
  }
  to {
    transform: translateX(12%);
  }
}

@keyframes cloudDriftFast {
  from {
    transform: translateX(-18%);
  }
  to {
    transform: translateX(18%);
  }
}

@keyframes planePath {
  0% {
    transform: translate3d(-35%, 8%, 0) rotate(2deg);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  55% {
    transform: translate3d(45vw, -6%, 0) rotate(-2deg);
  }
  100% {
    transform: translate3d(120vw, 10%, 0) rotate(4deg);
    opacity: 0;
  }
}
</style>
