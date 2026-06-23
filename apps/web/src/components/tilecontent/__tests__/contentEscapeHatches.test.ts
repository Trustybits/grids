import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
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
  useBadges: () => ({ earnedBadges: computed(() => []) }),
}));

vi.mock("@/composables/useDocumentThumbnail", () => ({
  documentItemIsPdf: vi.fn(() => false),
  ensureDocumentItemThumbnailOnServer: vi.fn(),
}));

vi.mock("mapbox-gl", () => ({
  default: {
    accessToken: "",
    Map: vi.fn(function () {
      return {
        addControl: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        remove: vi.fn(),
        resize: vi.fn(),
        isStyleLoaded: vi.fn(() => true),
        setStyle: vi.fn(),
        setLight: vi.fn(),
        setFog: vi.fn(),
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
      };
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
  return reactive({
    canEdit: true,
    isOwner: true,
    currentGrid: {
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
    },
    uploadingTiles: {},
    pendingFocusTileId: null,
    patchTileContent: vi.fn(),
    patchDocumentItem: vi.fn(),
    beginEditing: vi.fn(),
    commitEditing: vi.fn(),
    saveGrid: vi.fn(),
  });
}

describe("tile-content direct mutation escape hatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    class ResizeObserverStub {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("link detail edits mutate content, patch once after debounce, and commit editing on exit", async () => {
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
    expect(store.patchTileContent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    expect(content.customTitle).toBe("Custom title");
    expect(store.patchTileContent).toHaveBeenCalledTimes(1);
    expect(store.patchTileContent).toHaveBeenCalledWith("tile-1", {
      customTitle: "Custom title",
      customDescription: "",
      customSubtitle: "@example.com",
    });
    expect(store.saveGrid).not.toHaveBeenCalled();

    wrapper.vm.onExitClick();

    expect(store.commitEditing).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("document detail edits patch once after debounce and commit editing on exit", async () => {
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
    expect(store.patchTileContent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);

    expect(content.customTitle).toBe("Custom document");
    expect(store.patchTileContent).toHaveBeenCalledTimes(1);
    expect(store.patchTileContent).toHaveBeenCalledWith("tile-1", {
      customTitle: "Custom document",
      customDescription: "1 file",
    });

    wrapper.vm.onTileClick({ target: document.body } as unknown as MouseEvent);

    expect(store.commitEditing).toHaveBeenCalledTimes(1);
    expect(store.saveGrid).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("map option changes mutate canonical content and save each discrete change", async () => {
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
        style: "satellite",
        showClouds: false,
        showPlanes: false,
      }),
    );
    expect(store.saveGrid).toHaveBeenCalledTimes(3);
    expect(store.patchTileContent).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("profile avatar controls save once on discrete commit, not while radius input changes", async () => {
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

    expect(content.avatarShape).toBe("circle");
    expect(content.avatarRadius).toBe(12);
    expect(store.saveGrid).toHaveBeenCalledTimes(1);

    wrapper.vm.onRadiusCommit();

    expect(content.avatarRadius).toBe(24);
    expect(store.saveGrid).toHaveBeenCalledTimes(2);
    expect(store.patchTileContent).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
