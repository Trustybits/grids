import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { computed, nextTick, reactive } from "vue";
import {
  ContentType,
  type DocumentsContent,
  type LinkContent,
  type MapContent,
  type ProfileBioContent,
} from "@grids/contracts/types";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const badgeHolder = vi.hoisted(() => ({
  userId: null as unknown,
}));
const mapboxHolder = vi.hoisted(() => ({
  instances: [] as Array<{
    __emit: (event: string, ...args: unknown[]) => void;
    remove: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

// Tile-content composables (useTileContentWriter, useEditingLifecycle, …) now
// dispatch through the controller; point it at the same spy object the view
// context exposes so both command paths funnel into one set of assertions.
vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => storeHolder.current,
}));

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

vi.mock("@/composables/useColorPicker", () => ({
  useColorPicker: () => ({
    backgroundColor: computed(() => "var(--color-tile-background)"),
    textColor: computed(() => "#000000"),
    overlayColor: computed(() => null),
    pickerFillColor: computed(() => ""),
    pickerOverlayColor: computed(() => ""),
    colorMode: computed(() => "fill"),
    setColorMode: vi.fn(),
    handleBackgroundColorChange: vi.fn(),
    handleOverlayColorChange: vi.fn(),
  }),
}));

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({
    uploadFileToUrl: vi.fn(),
    uploadExternalImageToStorage: vi.fn(),
  }),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({ getCurrentUserId: () => "user-1" }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getStorageService: () => ({
      uploadResumable: vi.fn(),
    }),
  }),
}));

vi.mock("@/composables/useBadges", () => ({
  useBadges: (userId: unknown) => {
    badgeHolder.userId = userId;
    return { earnedBadges: computed(() => []) };
  },
}));

vi.mock("@/composables/useDocumentThumbnail", () => ({
  documentItemIsPdf: vi.fn(() => false),
  ensureDocumentItemThumbnailOnServer: vi.fn(),
}));

vi.mock("mapbox-gl", () => ({
  default: {
    accessToken: "",
    Map: vi.fn(function () {
      const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
      const onceHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
      const instance = {
        addControl: vi.fn(),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
          return instance;
        }),
        once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          onceHandlers.set(event, [...(onceHandlers.get(event) ?? []), handler]);
          return instance;
        }),
        remove: vi.fn(),
        resize: vi.fn(),
        isStyleLoaded: vi.fn(() => true),
        setStyle: vi.fn(),
        setLight: vi.fn(),
        setFog: vi.fn(),
        getSource: vi.fn(() => null),
        addSource: vi.fn(),
        removeSource: vi.fn(),
        getLayer: vi.fn(() => null),
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        setTerrain: vi.fn(),
        easeTo: vi.fn(),
        flyTo: vi.fn(),
        jumpTo: vi.fn(),
        getCenter: vi.fn(() => ({ lat: 0, lng: 0 })),
        getZoom: vi.fn(() => 9),
        getBearing: vi.fn(() => 0),
        getPitch: vi.fn(() => 0),
        dragPan: { enable: vi.fn(), disable: vi.fn() },
        scrollZoom: { enable: vi.fn(), disable: vi.fn() },
        dragRotate: { enable: vi.fn(), disable: vi.fn() },
        doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
        keyboard: { enable: vi.fn(), disable: vi.fn() },
        touchZoomRotate: { enable: vi.fn(), disable: vi.fn() },
        __emit: (event: string, ...args: unknown[]) => {
          for (const handler of handlers.get(event) ?? []) {
            handler(...args);
          }
          const queuedOnceHandlers = onceHandlers.get(event) ?? [];
          onceHandlers.delete(event);
          for (const handler of queuedOnceHandlers) {
            handler(...args);
          }
        },
      };
      mapboxHolder.instances.push(instance);
      return instance;
    }),
    Marker: vi.fn(function () {
      return {
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      };
    }),
    NavigationControl: vi.fn(function () {
      return {};
    }),
    AttributionControl: vi.fn(function () {
      return {};
    }),
  },
}));

function makeStore(content: LinkContent | DocumentsContent | MapContent | ProfileBioContent) {
  const grid = {
    id: "grid-1",
    userId: "user-1",
    tiles: [
      {
        i: "tile-1",
        x: 0,
        y: 0,
        w: 4,
        h: 4,
        caption: "",
        content,
      },
    ],
  };

  return reactive({
    mode: "live",
    canEdit: true,
    isOwner: true,
    grid,
    currentGrid: grid,
    uploadingTiles: {},
    pendingFocusTileId: null,
    patchTileContent: vi.fn(),
    patchTileContentSilently: vi.fn(),
    autosaveTileContent: vi.fn(),
    patchDocumentItem: vi.fn(),
    beginEditing: vi.fn(),
    commitEditing: vi.fn(),
    saveGrid: vi.fn(),
  });
}

describe("tile-content command boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    badgeHolder.userId = null;
    mapboxHolder.instances = [];
    vi.useRealTimers();
    class ResizeObserverStub {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("link detail edits patch once after debounce without mutating content directly", async () => {
    vi.useFakeTimers();
    const content = reactive({
      type: ContentType.LINK,
      link: "https://example.com",
      metaTitle: "Example",
    }) as LinkContent;
    const store = makeStore(content);
    storeHolder.current = store;
    const { default: LinkContentComponent } = await import(
      "@/components/tilecontent/LinkContent.vue"
    );
    const wrapper = mount(LinkContentComponent, {
      props: { content },
      global: {
        provide: { tileId: "tile-1", gridTileW: computed(() => 4), gridTileH: computed(() => 3) },
        stubs: { Teleport: true },
      },
    });

    wrapper.vm.startEditing("title");
    wrapper.vm.draftTitle = "  Custom title  ";
    await nextTick();

    expect(store.beginEditing).toHaveBeenCalledWith("tile-1");
    expect(store.autosaveTileContent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    // The debounced editor autosave routes through autosaveTileContent so the
    // paused edit persists mid-edit; it never mutates content directly and
    // never uses the discrete patchTileContent path.
    expect(content.customTitle).toBeUndefined();
    expect(store.patchTileContent).not.toHaveBeenCalled();
    expect(store.autosaveTileContent).toHaveBeenCalledTimes(1);
    expect(store.autosaveTileContent).toHaveBeenCalledWith("tile-1", {
      customTitle: "Custom title",
      customDescription: "",
      customSubtitle: "@example.com",
    });
    expect(store.saveGrid).not.toHaveBeenCalled();

    wrapper.vm.onExitClick();

    expect(store.commitEditing).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("document detail edits patch once after debounce without mutating content directly", async () => {
    vi.useFakeTimers();
    const content = reactive({
      type: ContentType.DOCUMENT,
      items: [{ id: "doc-1", fileName: "one.pdf", url: "https://cdn/doc.pdf" }],
    }) as DocumentsContent;
    const store = makeStore(content);
    storeHolder.current = store;
    const { default: DocumentsContentComponent } = await import(
      "@/components/tilecontent/DocumentsContent.vue"
    );
    const wrapper = mount(DocumentsContentComponent, {
      props: { content, tileId: "tile-1" },
      attachTo: document.body,
      global: {
        provide: { gridTileW: computed(() => 4), gridTileH: computed(() => 3) },
        stubs: { Teleport: true, DocumentPreviewer: true },
      },
    });
    await flushPromises();

    wrapper.vm.startEditing("title");
    wrapper.vm.draftTitle = "  Custom document  ";
    await nextTick();

    expect(store.beginEditing).toHaveBeenCalledWith("tile-1");
    expect(store.autosaveTileContent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    // The debounced editor autosave persists the paused edit mid-edit through
    // autosaveTileContent, never mutating content or using patchTileContent.
    expect(content.customTitle).toBeUndefined();
    expect(store.patchTileContent).not.toHaveBeenCalled();
    expect(store.autosaveTileContent).toHaveBeenCalledTimes(1);
    expect(store.autosaveTileContent).toHaveBeenCalledWith("tile-1", {
      customTitle: "Custom document",
      customDescription: "1 file",
    });

    wrapper.vm.onTileClick({ target: document.body } as unknown as MouseEvent);

    expect(store.commitEditing).toHaveBeenCalledTimes(1);
    expect(store.saveGrid).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("map option changes patch canonical content through typed commands", async () => {
    const content = reactive({
      type: ContentType.MAP,
      style: "default",
      show3d: false,
      showClouds: true,
      showPlanes: true,
    }) as MapContent;
    const store = makeStore(content);
    storeHolder.current = store;
    const { default: MapContentComponent } = await import(
      "@/components/tilecontent/MapContent.vue"
    );
    const wrapper = mount(MapContentComponent, {
      props: { content },
      global: {
        provide: { tileId: "tile-1", gridTileW: computed(() => 4), gridTileH: computed(() => 3) },
      },
    });

    wrapper.vm.styleMode = "satellite";
    wrapper.vm.showClouds = false;
    wrapper.vm.showPlanes = false;

    expect(content).toEqual(
      expect.objectContaining({
        style: "default",
        showClouds: true,
        showPlanes: true,
      }),
    );
    expect(store.patchTileContent).toHaveBeenNthCalledWith(1, "tile-1", {
      style: "satellite",
    });
    expect(store.patchTileContent).toHaveBeenNthCalledWith(2, "tile-1", {
      showClouds: false,
    });
    expect(store.patchTileContent).toHaveBeenNthCalledWith(3, "tile-1", {
      showPlanes: false,
    });
    expect(store.saveGrid).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("map load camera events do not patch canonical content", async () => {
    const content = reactive({
      type: ContentType.MAP,
      provider: "mapbox",
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 12,
      bearing: 0,
      pitch: 0,
      style: "default",
      show3d: false,
      showClouds: true,
      showPlanes: true,
    }) as MapContent;
    const store = makeStore(content);
    storeHolder.current = store;
    vi.stubEnv("VITE_MAPBOX_TOKEN", "token");
    const { default: MapContentComponent } = await import(
      "@/components/tilecontent/MapContent.vue"
    );
    const wrapper = mount(MapContentComponent, {
      props: { content },
      global: {
        provide: { tileId: "tile-1", gridTileW: computed(() => 4), gridTileH: computed(() => 3) },
      },
    });
    await flushPromises();

    expect(mapboxHolder.instances).toHaveLength(1);
    mapboxHolder.instances[0].__emit("style.load", { type: "style.load" });
    mapboxHolder.instances[0].__emit("moveend", { type: "moveend" });

    expect(store.patchTileContent).not.toHaveBeenCalled();
    expect(store.patchTileContentSilently).not.toHaveBeenCalled();
    expect(content.center).toEqual({ lat: 40.7128, lng: -74.006 });
    wrapper.unmount();
  });

  it("map initial geocode persists without undoing canonical content", async () => {
    const content = reactive({
      type: ContentType.MAP,
      provider: "mapbox",
      center: { lat: 0, lng: 0 },
      zoom: 9,
      bearing: 0,
      pitch: 0,
      style: "default",
      show3d: false,
      showClouds: true,
      showPlanes: true,
      searchQuery: "New York",
    }) as MapContent;
    const store = makeStore(content);
    storeHolder.current = store;
    vi.stubEnv("VITE_MAPBOX_TOKEN", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ features: [{ center: [-74.006, 40.7128] }] }),
      })),
    );
    const { default: MapContentComponent } = await import(
      "@/components/tilecontent/MapContent.vue"
    );
    const wrapper = mount(MapContentComponent, {
      props: { content },
      global: {
        provide: { tileId: "tile-1", gridTileW: computed(() => 4), gridTileH: computed(() => 3) },
      },
    });
    await flushPromises();

    expect(store.patchTileContent).not.toHaveBeenCalled();
    expect(store.patchTileContentSilently).toHaveBeenNthCalledWith(1, "tile-1", {
      marker: { lat: 40.7128, lng: -74.006 },
    });
    expect(store.patchTileContentSilently).toHaveBeenNthCalledWith(2, "tile-1", {
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 9,
    });
    wrapper.unmount();
  });

  it("profile avatar controls patch once on discrete commit, not while radius input changes", async () => {
    const content = reactive({
      type: ContentType.PROFILE,
      name: "",
      title: "",
      bio: "",
      avatarShape: "square",
      avatarRadius: 12,
      avatarSides: 6,
    }) as ProfileBioContent;
    const store = makeStore(content);
    storeHolder.current = store;
    const { default: ProfileBioContentComponent } = await import(
      "@/components/tilecontent/ProfileBioContent.vue"
    );
    const wrapper = mount(ProfileBioContentComponent, {
      props: { content },
      global: {
        provide: {
          tileId: "tile-1",
          gridTileW: computed(() => 4),
          gridTileH: computed(() => 4),
          hoveredToolbarZone: computed(() => null),
        },
        stubs: { Teleport: true },
      },
    });

    wrapper.vm.setAvatarShape("circle");
    wrapper.vm.onRadiusInput({ target: { value: "24" } } as unknown as Event);

    expect(content.avatarShape).toBe("square");
    expect(content.avatarRadius).toBe(12);
    expect(store.patchTileContent).toHaveBeenCalledTimes(1);
    expect(store.patchTileContent).toHaveBeenCalledWith("tile-1", {
      avatarShape: "circle",
    });
    expect(store.saveGrid).not.toHaveBeenCalled();

    wrapper.vm.onRadiusCommit();

    expect(content.avatarRadius).toBe(12);
    expect(store.patchTileContent).toHaveBeenCalledTimes(2);
    expect(store.patchTileContent).toHaveBeenLastCalledWith("tile-1", {
      avatarRadius: 24,
    });
    expect(store.saveGrid).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("profile badges do not subscribe for demo-rendered tiles", async () => {
    const content = reactive({
      type: ContentType.PROFILE,
      name: "",
      title: "",
      bio: "",
      avatarShape: "square",
      avatarRadius: 12,
      avatarSides: 6,
    }) as ProfileBioContent;
    const store = makeStore(content);
    store.mode = "demo";
    store.canEdit = false;
    storeHolder.current = store;
    const { default: ProfileBioContentComponent } = await import(
      "@/components/tilecontent/ProfileBioContent.vue"
    );
    const wrapper = mount(ProfileBioContentComponent, {
      props: { content },
      global: {
        provide: {
          tileId: "tile-1",
          gridTileW: computed(() => 4),
          gridTileH: computed(() => 4),
          hoveredToolbarZone: computed(() => null),
        },
        stubs: { Teleport: true },
      },
    });

    expect((badgeHolder.userId as { value: unknown }).value).toBeNull();
    wrapper.unmount();
  });
});
