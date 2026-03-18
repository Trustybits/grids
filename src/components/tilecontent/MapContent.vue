<template>
  <div ref="mapTile" class="map-tile">
    <div
      ref="mapContainer"
      class="map-canvas"
      :class="{ 'is-interactive': isInteractive, 'is-hidden': !mapReady }"
    ></div>

    <div v-if="showClouds" class="map-overlay map-clouds" aria-hidden="true">
      <img class="map-cloud map-cloud--shadow" :src="cloudShadow" alt="" />
      <img class="map-cloud map-cloud--main" :src="cloudImage" alt="" />
    </div>

    <div v-if="showPlanes" class="map-overlay map-plane" aria-hidden="true">
      <img class="plane-shadow" :src="planeShadow" alt="" />
      <img class="plane-icon" :src="planeIcon" alt="" />
    </div>

    <div v-if="!hasToken" class="map-empty-state">
      Add <strong>VITE_MAPBOX_TOKEN</strong> to enable maps.
    </div>

    <div v-if="statusMessage" class="map-status">{{ statusMessage }}</div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  inject,
  nextTick,
  type ComputedRef,
} from "vue";
import mapboxgl from "mapbox-gl";
import cloudImage from "@/assets/images/cloud.png";
import cloudShadow from "@/assets/images/cloud_shadow.png";
import planeIcon from "@/assets/images/plane.png";
import planeShadow from "@/assets/images/planeshadow.png";
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

const DEFAULT_STYLE_URL = "mapbox://styles/trustybits/cmlfi9mdh001t01qv29zg4wqn";

const MAP_STYLE_PRESETS: Record<Exclude<MapStyleMode, "auto">, MapStylePreset> = {
  default: {
    style: DEFAULT_STYLE_URL,
  },
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
const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
const formatPx = (value: number) => `${value.toFixed(3)}px`;
const formatDeg = (value: number) => `${value.toFixed(3)}deg`;
const formatSec = (value: number) => `${value.toFixed(2)}s`;

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
    const mapTile = ref<HTMLDivElement | null>(null);
    const mapContainer = ref<HTMLDivElement | null>(null);
    const mapInstance = ref<mapboxgl.Map | null>(null);
    const markerInstance = ref<mapboxgl.Marker | null>(null);
    const isEditing = ref(false);
    const showSearch = ref(false);
    const searchInput = ref(props.content.searchQuery || "");
    const searchInputRef = ref<HTMLInputElement | null>(null);
    const statusMessage = ref<string | null>(null);
    let resizeObserver: ResizeObserver | null = null;
    // Tracks whether the map is still performing its first positioning.
    // When true, flyToLocation uses jumpTo (instant) instead of easeTo
    // so the user never sees the default [0,0] ocean view.
    let isInitialLoad = true;
    // Suppresses syncContentFromMap during programmatic moves (flyTo,
    // easeTo, recenter) so the moveend handler doesn't overwrite the
    // position that the programmatic caller already persisted.
    let isProgrammaticMove = false;
    // Debounce timer for syncContentFromMap — collapses rapid-fire
    // moveend events (inertial scrolling, resize adjustments) into a
    // single Firestore write after the map settles.
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const SYNC_DEBOUNCE_MS = 300;
    // Controls map canvas visibility — hidden until the first real center
    // is applied so the user never sees a flash of the [0,0] ocean.
    const mapReady = ref(false);
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const hasToken = computed(() => !!token);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    // GridTile provides "tileId" as a raw string (not a ComputedRef).
    const injectedTileId = inject<string | null>("tileId", null);

    const resolvedTileId = computed(() =>
      injectedTileId ??
        layoutStore.currentLayout?.tiles.find((tile) => tile.content === props.content)?.i ??
        null
    );

    // vue3-grid-layout deep-clones every layout item (JSON.parse/stringify),
    // so props.content is a COPY — mutations to it never reach the store's
    // canonical tile.  storeContent resolves to the store tile's content so
    // all writes persist correctly across layout rebuilds.
    const storeContent = computed(() => {
      const tile = layoutStore.currentLayout?.tiles.find((t) => t.i === resolvedTileId.value);
      return (tile?.content as MapContent | undefined) ?? props.content;
    });

    const styleMode = computed<MapStyleMode>({
      get: () => storeContent.value.style || "default",
      set: (value) => {
        storeContent.value.style = value;
        layoutStore.saveLayout();
      },
    });

    const tileWidth = computed(() =>
      gridTileW?.value ??
        layoutStore.currentLayout?.tiles.find((tile) => tile.i === resolvedTileId.value)?.w ??
        0
    );

    const tileHeight = computed(() =>
      gridTileH?.value ??
        layoutStore.currentLayout?.tiles.find((tile) => tile.i === resolvedTileId.value)?.h ??
        0
    );

    const isInteractive = computed(() => !layoutStore.canEdit || isEditing.value);

    const show3d = computed({
      get: () => storeContent.value.show3d ?? false,
      set: (value: boolean) => {
        storeContent.value.show3d = value;
        layoutStore.saveLayout();
        apply3d(value);
      },
    });

    const showClouds = computed({
      get: () => storeContent.value.showClouds ?? true,
      set: (value: boolean) => {
        storeContent.value.showClouds = value;
        layoutStore.saveLayout();
      },
    });

    const showPlanes = computed({
      get: () => storeContent.value.showPlanes ?? true,
      set: (value: boolean) => {
        storeContent.value.showPlanes = value;
        layoutStore.saveLayout();
      },
    });

    const resolvedStyle = computed(() => resolveStyle(styleMode.value, themeStore.isDarkMode));

    const isDefaultStyle = computed(() => styleMode.value === "default");

    const seedAnimationVars = () => {
      const element = mapTile.value;
      if (!element) return;
      const setVar = (name: string, value: string) => {
        element.style.setProperty(name, value);
      };

      const { width, height } = element.getBoundingClientRect();
      const safeWidth = width || 800;
      const safeHeight = height || 600;
      const centerX = safeWidth / 2;
      const centerY = safeHeight / 2;
      const halfDiag = Math.hypot(safeWidth, safeHeight) / 2;

      const buildLine = (buffer: number, angleDeg = randomBetween(0, 360)) => {
        const radians = (angleDeg * Math.PI) / 180;
        const dx = Math.cos(radians);
        const dy = Math.sin(radians);
        const distance = halfDiag + buffer;

        return {
          angleDeg,
          dx,
          dy,
          start: {
            x: centerX - dx * distance,
            y: centerY - dy * distance,
          },
          end: {
            x: centerX + dx * distance,
            y: centerY + dy * distance,
          },
        };
      };

      const planeDuration = randomBetween(24, 34);
      const planeDelay = randomBetween(-8, 0);
      const planePath = buildLine(220);
      const planeRotation = (planePath.angleDeg + 90) % 360;
      const planeShadowOffset = { x: -12, y: 80 };

      setVar("--plane-duration", formatSec(planeDuration));
      setVar("--plane-delay", formatSec(planeDelay));
      setVar("--plane-rotate", formatDeg(planeRotation));
      setVar("--plane-start-x", formatPx(planePath.start.x));
      setVar("--plane-start-y", formatPx(planePath.start.y));
      setVar("--plane-end-x", formatPx(planePath.end.x));
      setVar("--plane-end-y", formatPx(planePath.end.y));

      setVar("--plane-shadow-duration", formatSec(planeDuration));
      setVar("--plane-shadow-delay", formatSec(planeDelay));
      setVar("--plane-shadow-rotate", formatDeg(planeRotation));
      setVar("--plane-shadow-start-x", formatPx(planePath.start.x + planeShadowOffset.x));
      setVar("--plane-shadow-start-y", formatPx(planePath.start.y + planeShadowOffset.y));
      setVar("--plane-shadow-end-x", formatPx(planePath.end.x + planeShadowOffset.x));
      setVar("--plane-shadow-end-y", formatPx(planePath.end.y + planeShadowOffset.y));

      const cloudDuration = randomBetween(70, 95);
      const cloudDelay = randomBetween(-20, 0);
      const cloudPath = buildLine(1000);
      const perp = { x: -cloudPath.dy, y: cloudPath.dx };
      const wander = randomBetween(-160, 160);
      const drift = randomBetween(-120, 120);
      const cloudMid = {
        x: (cloudPath.start.x + cloudPath.end.x) / 2 + perp.x * wander + cloudPath.dx * drift,
        y: (cloudPath.start.y + cloudPath.end.y) / 2 + perp.y * wander + cloudPath.dy * drift,
      };
      const cloudRotation = randomBetween(112, 128);
      const cloudShadowOffset = {
        x: planeShadowOffset.x * 1.6,
        y: planeShadowOffset.y * 1.6,
      };

      setVar("--cloud-duration", formatSec(cloudDuration));
      setVar("--cloud-delay", formatSec(cloudDelay));
      setVar("--cloud-rotate", formatDeg(cloudRotation));
      setVar("--cloud-start-x", formatPx(cloudPath.start.x));
      setVar("--cloud-start-y", formatPx(cloudPath.start.y));
      setVar("--cloud-mid-x", formatPx(cloudMid.x));
      setVar("--cloud-mid-y", formatPx(cloudMid.y));
      setVar("--cloud-end-x", formatPx(cloudPath.end.x));
      setVar("--cloud-end-y", formatPx(cloudPath.end.y));

      setVar("--cloud-shadow-duration", formatSec(cloudDuration));
      setVar("--cloud-shadow-delay", formatSec(cloudDelay));
      setVar("--cloud-shadow-rotate", formatDeg(cloudRotation));
      setVar("--cloud-shadow-start-x", formatPx(cloudPath.start.x + cloudShadowOffset.x));
      setVar("--cloud-shadow-start-y", formatPx(cloudPath.start.y + cloudShadowOffset.y));
      setVar("--cloud-shadow-mid-x", formatPx(cloudMid.x + cloudShadowOffset.x));
      setVar("--cloud-shadow-mid-y", formatPx(cloudMid.y + cloudShadowOffset.y));
      setVar("--cloud-shadow-end-x", formatPx(cloudPath.end.x + cloudShadowOffset.x));
      setVar("--cloud-shadow-end-y", formatPx(cloudPath.end.y + cloudShadowOffset.y));
    };

    const buildMarkerElement = () => {
      const element = document.createElement("div");
      element.className = "marker";
      element.setAttribute("aria-label", "Map marker");

      const wrap = document.createElement("div");
      wrap.className = "relative h-full w-full marker__wrap";

      const pulse = document.createElement("div");
      pulse.className =
        "absolute left-1/2 top-1/2 rounded-full bg-[#679BFF] opacity-20 s-3 styles_marker-pulse__BxsPp marker__pulse";

      const body = document.createElement("div");
      body.className =
        "relative flex h-full w-full items-center justify-center rounded-full bg-white styles_marker__Mzm27 marker__body";

      const inner = document.createElement("div");
      inner.className = "absolute inset-[3px] rounded-full bg-[#679BFF] marker__inner";

      const border = document.createElement("div");
      border.className = "absolute inset-[3px] rounded-full styles_marker-border__fxi6v marker__border";

      const core = document.createElement("div");
      core.className = "absolute inset-[5px] rounded-full bg-[#679BFF] marker__core";

      body.appendChild(inner);
      body.appendChild(border);
      body.appendChild(core);
      wrap.appendChild(pulse);
      wrap.appendChild(body);
      element.appendChild(wrap);
      return element;
    };

    const updateMarker = (markerData?: { lat: number; lng: number }) => {
      const map = mapInstance.value;
      if (!map || !markerData) return;
      if (!markerInstance.value) {
        const marker = new (mapboxgl as any).Marker({
          element: buildMarkerElement(),
          anchor: "center",
        }) as mapboxgl.Marker;
        markerInstance.value = marker
          .setLngLat([markerData.lng, markerData.lat])
          .addTo(map as any);
      } else {
        markerInstance.value.setLngLat([markerData.lng, markerData.lat]);
      }
    };

    const setMarker = (marker: { lat: number; lng: number }) => {
      if (!layoutStore.canEdit) return;
      storeContent.value.marker = marker;
      saveLayout();
      updateMarker(marker);
    };

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
      // Don't persist the default [0,0] center during initial load;
      // we only want to save once a real position has been established.
      if (isInitialLoad) return;
      if (!layoutStore.canEdit) return;
      // Skip intermediate moveend events fired during programmatic
      // animations (flyTo, easeTo, recenter).  Each caller sets
      // isProgrammaticMove = true before starting and registers a
      // map.once("moveend") that clears the flag and calls
      // syncContentFromMap() explicitly, so the final resting state
      // is always captured.
      if (isProgrammaticMove) return;
      // Debounce: Mapbox fires moveend repeatedly during inertial
      // deceleration and after resize-triggered viewport adjustments.
      // Collapsing them into one write ensures only the final resting
      // position is persisted.
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        syncTimer = null;
        const map = mapInstance.value;
        if (!map) return;
        const sc = storeContent.value;
        const center = map.getCenter();
        sc.center = {
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
        };
        sc.zoom = Number(map.getZoom().toFixed(2));
        sc.bearing = Number(map.getBearing().toFixed(2));
        sc.pitch = Number(map.getPitch().toFixed(2));
        saveLayout();
      }, SYNC_DEBOUNCE_MS);
    };

    const flyToLocation = (center: { lat: number; lng: number }, zoom?: number) => {
      const map = mapInstance.value;
      const targetZoom = zoom ?? storeContent.value.zoom ?? 9;
      if (map) {
        if (isInitialLoad) {
          // Snap instantly on first positioning so the user never sees [0,0].
          map.jumpTo({ center: [center.lng, center.lat], zoom: targetZoom });
          isInitialLoad = false;
          // Reveal the map now that it's positioned correctly.
          mapReady.value = true;
          // jumpTo doesn't fire moveend, so persist immediately.
          if (layoutStore.canEdit) {
            storeContent.value.center = center;
            storeContent.value.zoom = targetZoom;
            saveLayout();
          }
        } else {
          // Suppress intermediate moveend events during the animation.
          // When the animation finishes, clear the flag and let
          // syncContentFromMap capture the final resting state.
          isProgrammaticMove = true;
          map.once("moveend", () => {
            isProgrammaticMove = false;
            syncContentFromMap();
          });
          // Use Mapbox's flyTo for a cinematic arc animation between locations.
          map.flyTo({
            center: [center.lng, center.lat],
            zoom: targetZoom,
            speed: 1.2,
            curve: 1.42,
            essential: true,
          });
        }
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
          if (isInitialLoad) { isInitialLoad = false; mapReady.value = true; }
          return;
        }
        const data = await response.json();
        const match = data.features?.[0];
        if (!match?.center) {
          statusMessage.value = "No results found.";
          if (isInitialLoad) { isInitialLoad = false; mapReady.value = true; }
          return;
        }
        statusMessage.value = null;
        const [lng, lat] = match.center as [number, number];
        setMarker({ lat, lng });
        flyToLocation({ lat, lng }, clamp(props.content.zoom ?? 9, 9, 14));
      } catch (error) {
        console.error("Mapbox search failed:", error);
        statusMessage.value = "Search failed.";
        if (isInitialLoad) { isInitialLoad = false; mapReady.value = true; }
      }
    };

    const useMyLocation = () => {
      if (!layoutStore.canEdit) return;
      if (!navigator.geolocation) {
        statusMessage.value = "Geolocation not supported.";
        // Reveal the map even without a location so the tile isn't blank.
        if (isInitialLoad) { isInitialLoad = false; mapReady.value = true; }
        return;
      }
      statusMessage.value = "Locating...";
      navigator.geolocation.getCurrentPosition(
        (position) => {
          statusMessage.value = null;
          const marker = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMarker(marker);
          flyToLocation(marker, clamp(props.content.zoom ?? 9, 10, 14));
        },
        () => {
          statusMessage.value = "Unable to get location.";
          // Reveal the map even on failure so the tile isn't permanently blank.
          if (isInitialLoad) { isInitialLoad = false; mapReady.value = true; }
        }
      );
    };

    const handleSearch = async () => {
      const query = searchInput.value.trim();
      storeContent.value.searchQuery = query || undefined;
      saveLayout();
      if (!query) {
        useMyLocation();
        return;
      }
      await handleGeocode(query);
    };

    const isPresetActive = (w: number, h: number) => {
      return tileWidth.value === w && tileHeight.value === h;
    };

    const resizeMapTile = (w: number, h: number) => {
      const tileId = resolvedTileId.value;
      if (!tileId) return;
      layoutStore.resizeTile(tileId, w, h);
      nextTick(() => {
        mapInstance.value?.resize();
      });
    };

    const toggleDefaultStyle = () => {
      styleMode.value = isDefaultStyle.value ? "auto" : "default";
    };

    const toggleClouds = () => {
      showClouds.value = !showClouds.value;
    };

    const togglePlanes = () => {
      showPlanes.value = !showPlanes.value;
    };

    const toggleSearch = () => {
      showSearch.value = !showSearch.value;
      if (showSearch.value) {
        nextTick(() => {
          searchInputRef.value?.focus();
        });
      }
    };

    const enable3d = () => {
      const map = mapInstance.value;
      if (!map) return;
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

    const disable3d = () => {
      const map = mapInstance.value;
      if (!map) return;
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
          enable3d();
        } else {
          disable3d();
        }
        const targetPitch = enabled ? 25 : 0;
        const currentPitch = Math.round(map.getPitch());
        // If the pitch already matches the target, easeTo is a no-op and
        // Mapbox won't fire moveend — so skip the programmatic-move guard
        // to avoid permanently blocking syncContentFromMap.
        if (currentPitch === targetPitch) {
          syncContentFromMap();
          return;
        }
        isProgrammaticMove = true;
        map.once("moveend", () => {
          isProgrammaticMove = false;
          syncContentFromMap();
        });
        map.easeTo({ pitch: targetPitch, duration: 500 });
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
      if (!layoutStore.canEdit) return;
      isEditing.value = !isEditing.value;
      if (isEditing.value) {
        mapInstance.value?.resize();
      } else {
        saveLayout();
      }
    };

    const onShortClick = () => {
      // No-op: map is always interactive, no edit mode toggle needed
    };

    const onExitClick = () => {
      if (!layoutStore.canEdit) return;
      if (!isEditing.value) return;
      isEditing.value = false;
      saveLayout();
    };

    // Re-centers the map viewport on the marker (if set), falling back
    // to the saved center. Exposed to the toolbar as a "recenter" action.
    const recenterOnMarker = () => {
      const sc = storeContent.value;
      const target = sc.marker ?? sc.center;
      if (!target || (target.lat === 0 && target.lng === 0)) return;
      const map = mapInstance.value;
      if (!map) return;
      // Suppress intermediate moveend events during the animation.
      // When complete, sync the final position to Firestore.
      isProgrammaticMove = true;
      map.once("moveend", () => {
        isProgrammaticMove = false;
        syncContentFromMap();
      });
      // Use easeTo for a smooth pan back to the marker — flyTo's arc
      // animation is reserved for search-driven location changes.
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: sc.zoom ?? 9,
        duration: 800,
      });
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

    watch(
      () => props.content.marker,
      (value) => {
        if (value) {
          updateMarker(value);
        }
      },
      { deep: true }
    );

    onMounted(() => {
      seedAnimationVars();
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
        // Keep the last rendered frame in the WebGL buffer so the canvas
        // never flashes black when the tile container is being resized.
        preserveDrawingBuffer: true,
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

      // Watch for container size changes (e.g. grid resize transitions)
      // so the map re-renders to fill the new dimensions without black bars.
      // The resize call is debounced because during animated CSS transitions
      // (the spring settle after a tile resize) the observer fires on every
      // frame.  Each map.resize() sets the canvas width/height attributes
      // which clears the WebGL drawing buffer, producing a black flash.
      // By waiting until the container stops changing size we call resize()
      // only once after the animation finishes — preserveDrawingBuffer keeps
      // the last good frame visible in the meantime.
      if (mapContainer.value) {
        let resizeTimer: ReturnType<typeof setTimeout> | null = null;
        const ro = new ResizeObserver(() => {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            map.resize();
          }, 0);
        });
        ro.observe(mapContainer.value);
        resizeObserver = ro;
      }

      applyActivePreset();

      if (props.content.marker) {
        updateMarker(props.content.marker);
      }

      const hasSavedCenter =
        props.content.center &&
        (props.content.center.lat !== 0 || props.content.center.lng !== 0);

      if (hasSavedCenter) {
        // Map was constructed with valid coordinates — it's already positioned.
        isInitialLoad = false;
        mapReady.value = true;
      }

      if (layoutStore.canEdit) {
        if (props.content.searchQuery && !hasSavedCenter) {
          handleGeocode(props.content.searchQuery);
        } else if (!hasSavedCenter) {
          useMyLocation();
        }
      } else if (!hasSavedCenter) {
        // Non-owner viewing a map that was never positioned — just reveal it
        // at whatever center it has rather than leaving it invisible.
        isInitialLoad = false;
        mapReady.value = true;
      }

      if (show3d.value) {
        apply3d(true);
      }
    });

    onUnmounted(() => {
      // Flush any pending debounced save so the last position isn't lost.
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
        // Perform the save inline since the component is tearing down.
        const map = mapInstance.value;
        if (map && !isInitialLoad && layoutStore.canEdit) {
          const sc = storeContent.value;
          const center = map.getCenter();
          sc.center = {
            lat: Number(center.lat.toFixed(6)),
            lng: Number(center.lng.toFixed(6)),
          };
          sc.zoom = Number(map.getZoom().toFixed(2));
          sc.bearing = Number(map.getBearing().toFixed(2));
          sc.pitch = Number(map.getPitch().toFixed(2));
          saveLayout();
        }
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      markerInstance.value?.remove();
      mapInstance.value?.remove();
    });

    return {
      layoutStore,
      cloudShadow,
      cloudImage,
      planeIcon,
      planeShadow,
      mapTile,
      mapContainer,
      isEditing,
      isInteractive,
      isPresetActive,
      resizeMapTile,
      isDefaultStyle,
      toggleDefaultStyle,
      searchInput,
      searchInputRef,
      statusMessage,
      styleMode,
      show3d,
      showClouds,
      showPlanes,
      showSearch,
      toggleClouds,
      togglePlanes,
      toggleSearch,
      handleSearch,
      useMyLocation,
      toggleEditMode,
      onShortClick,
      onExitClick,
      onResize,
      hasToken,
      mapReady,
      recenterOnMarker,
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

// Overdraw buffer: render the map canvas slightly larger than the tile on
// every side so pre-rendered map is already available beyond the visible
// edges.  The parent .map-tile clips with overflow:hidden.  During resize
// transitions this buffer hides the black fringe that would otherwise
// appear before map.resize() fires.
$overdraw: 40px;

.map-canvas {
  position: absolute;
  top: -$overdraw;
  left: -$overdraw;
  width: calc(100% + #{$overdraw * 2});
  height: calc(100% + #{$overdraw * 2});
  pointer-events: none;
}

// Shift Mapbox's built-in UI controls inward so they stay within the
// visible tile bounds despite the canvas being oversized by $overdraw.
.map-canvas :deep(.mapboxgl-ctrl-top-right) {
  top: $overdraw;
  right: $overdraw;
}
.map-canvas :deep(.mapboxgl-ctrl-bottom-right) {
  bottom: $overdraw;
  right: $overdraw;
}
.map-canvas :deep(.mapboxgl-ctrl-top-left) {
  top: $overdraw;
  left: $overdraw;
}
.map-canvas :deep(.mapboxgl-ctrl-bottom-left) {
  bottom: $overdraw;
  left: $overdraw;
}

// Mapbox markers use transform:translate for positioning — the overdraw
// offset is already baked into the map's coordinate → pixel projection,
// so no additional CSS correction is needed for markers.

.map-canvas.is-hidden {
  visibility: hidden;
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
  width: 100%;
  height: 100%;
  /* overflow: hidden; */
}

.map-cloud {
  position: absolute;
  left: 0;
  top: 0;
  width: 1000px;
  height: auto;
  will-change: transform;
}

.map-cloud--main {
  opacity: 0.9;
  animation: cloudDrift var(--cloud-duration, 80s) linear infinite;
  animation-delay: var(--cloud-delay, 0s);
}

.map-cloud--shadow {
  opacity: 0.6;
  filter: blur(4px) brightness(0.01);
  animation: cloudShadowDrift var(--cloud-shadow-duration, 80s) linear infinite;
  animation-delay: var(--cloud-shadow-delay, 0s);
}

.map-plane {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  transform-origin: center;
  /* overflow: hidden; */
}

.plane-icon,
.plane-shadow {
  position: absolute;
  left: 0;
  top: 0;
  width: 24px;
  /*height: 24px; */
  transform-origin: center;
  /* will-change: transform, opacity; */
}

.plane-icon {
  filter: drop-shadow(0 3px 6px rgba(15, 45, 90, 0.35));
  animation: planeFly var(--plane-duration, 28s) linear infinite;
  animation-delay: var(--plane-delay, 0s);
}

.plane-shadow {
  /* opacity: 0.45; */
  /* filter: blur(3px) brightness(0.15); */
  animation: planeShadowFly var(--plane-shadow-duration, 28s) linear infinite;
  animation-delay: var(--plane-shadow-delay, 0s);
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

.map-status {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--color-content-default);
  text-align: center;
  z-index: 2;
  pointer-events: none;
}

.map-tile :deep(.mapboxgl-ctrl-top-right) {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.map-tile:hover :deep(.mapboxgl-ctrl-top-right) {
  opacity: 1;
  pointer-events: auto;
}

.map-tile :deep(.mapboxgl-ctrl-bottom-right) {
  opacity: 0.45;
  transition: opacity 0.2s ease;
}

.map-tile:hover :deep(.mapboxgl-ctrl-bottom-right) {
  opacity: 1;
}

.map-tile :deep(.marker) {
  position: relative;
  width: 28px;
  height: 28px;
  pointer-events: auto;
}

.map-tile :deep(.marker__wrap) {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-tile :deep(.marker__pulse) {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: #679bff;
  opacity: 0.2;
  transform: translate(-50%, -50%);
  animation: markerPulse 2.6s ease-out infinite;
}

.map-tile :deep(.marker__body) {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(20, 45, 110, 0.25);
}

.map-tile :deep(.marker__inner) {
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  background: #679bff;
  opacity: 0.55;
}

.map-tile :deep(.marker__border) {
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 0 0 1px rgba(103, 155, 255, 0.6);
}

.map-tile :deep(.marker__core) {
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: #679bff;
}

@keyframes cloudDrift {
  0% {
    transform: translate(
        var(--cloud-start-x, -1295.098px),
        var(--cloud-start-y, -250.375px)
      )
      rotate(var(--cloud-rotate, 120deg));
  }
  50% {
    transform: translate(
        var(--cloud-mid-x, -200px),
        var(--cloud-mid-y, -120px)
      )
      rotate(var(--cloud-rotate, 120deg));
  }
  100% {
    transform: translate(
        var(--cloud-end-x, 1077.3733px),
        var(--cloud-end-y, -124.672px)
      )
      rotate(var(--cloud-rotate, 120deg));
  }
}

@keyframes cloudShadowDrift {
  0% {
    transform: translate(
        var(--cloud-shadow-start-x, -1285.098px),
        var(--cloud-shadow-start-y, -200.375px)
      )
      rotate(var(--cloud-shadow-rotate, 120deg));
  }
  50% {
    transform: translate(
        var(--cloud-shadow-mid-x, -180px),
        var(--cloud-shadow-mid-y, -80px)
      )
      rotate(var(--cloud-shadow-rotate, 120deg));
  }
  100% {
    transform: translate(
        var(--cloud-shadow-end-x, 1067.3733px),
        var(--cloud-shadow-end-y, 76.67151px)
      )
      rotate(var(--cloud-shadow-rotate, 120deg));
  }
}

@keyframes markerPulse {
  0% {
    transform: translate(-50%, -50%) scale(0.6);
    opacity: 0.8;
  }
  70% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 0.2;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.6);
    opacity: 0;
  }
}

@keyframes planeFly {
  0% {
    transform: translate(
        var(--plane-start-x, 360px),
        var(--plane-start-y, -180px)
      )
      rotate(var(--plane-rotate, 221.775deg));
    opacity: 1;
  }
  100% {
    transform: translate(var(--plane-end-x, -40px), var(--plane-end-y, 270px))
      rotate(var(--plane-rotate, 221.775deg));
    opacity: 1;
  }
}

@keyframes planeShadowFly {
  0% {
    transform: translate(
        var(--plane-shadow-start-x, 350px),
        var(--plane-shadow-start-y, -100px)
      )
      rotate(var(--plane-shadow-rotate, 221.775deg));
    opacity: 1;
  }
  100% {
    transform: translate(
        var(--plane-shadow-end-x, -30px),
        var(--plane-shadow-end-y, 350px)
      )
      rotate(var(--plane-shadow-rotate, 221.775deg));
    opacity: 1;
  }
}
</style>
