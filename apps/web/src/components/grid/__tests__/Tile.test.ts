import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive, ref } from "vue";
import {
  ContentType,
  type ImageContent,
  type LinkContent,
  type SuggestionContent,
  type Tile,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  TILE_DRAGGING_ID,
  TILE_REMOVE_REQUEST,
  TILE_RESIZE_REQUEST,
} from "@/grid-context/tileInteractionKeys";

const storeHolder = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const contentHooks = vi.hoisted(() => ({
  onShortClick: vi.fn(),
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => storeHolder.current,
}));

vi.mock("@/utils/TileUtils", async () => {
  const { defineComponent, h } = await import("vue");
  const ContentStub = defineComponent({
    name: "ContentStub",
    props: { content: Object },
    setup(props, { expose }) {
      expose({ onShortClick: contentHooks.onShortClick });
      return () =>
        h("span", {
          "data-test": "content",
          "data-content-type": (props.content as { type?: string })?.type,
        });
    },
  });
  return {
    createTileContent: vi.fn((type: ContentType) => ({ type })),
    getContentComponent: vi.fn(async () => ContentStub),
    getOptionComponent: vi.fn(async () => null),
  };
});

vi.mock("@/registries/tileRegistry", () => ({
  getTileDefinition: () => ({
    capabilities: {},
  }),
}));

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({
    uploadFileOptimisticForTile: vi.fn(),
  }),
}));

vi.mock("@/composables/useTileInput", () => ({
  useTileInput: () => ({
    submitLink: vi.fn(),
    submitEmbed: vi.fn(),
  }),
}));

const mobile = vi.hoisted(() => ({
  isMobile2: false,
  isDesktop2: false,
  openEdit: vi.fn(),
  closeEdit: vi.fn(),
}));

vi.mock("@/composables/useMobileExperience", async () => {
  const { computed } = await import("vue");
  return {
    useMobileExperience: () => ({
      isMobile2: computed(() => mobile.isMobile2),
      isDesktop2: computed(() => mobile.isDesktop2),
      chromeActive: computed(() => mobile.isMobile2 || mobile.isDesktop2),
    }),
  };
});

const editTileId = ref<string | null>(null);

vi.mock("@/composables/useMobileTileEdit", () => ({
  useMobileTileEdit: () => ({
    editTileId,
    openEdit: mobile.openEdit,
    closeEdit: mobile.closeEdit,
    isEditTarget: (tileId: string) => editTileId.value === tileId,
  }),
}));

function makeTile(): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: "",
    content: {
      type: ContentType.LINK,
      link: "https://example.com",
      metaTitle: "Initial",
    } as LinkContent,
  };
}

function makeStore(tile: Tile) {
  const grid = { tiles: [tile] };

  return reactive({
    activeBreakpoint: "md",
    activeTileId: null,
    canEdit: false,
    isOwner: false,
    grid,
    currentGrid: grid,
    pendingFocusTileId: null,
    showMetaData: false,
    showMetaDataVerbose: false,
    getCookieValue: vi.fn(() => null),
    beginMove: vi.fn(),
    commitMove: vi.fn(),
    beginResize: vi.fn(),
    commitResize: vi.fn(),
    removeTile: vi.fn(),
    setTileContent: vi.fn(),
  });
}

async function mountGridTile(
  store: ReturnType<typeof makeStore>,
  layout: GridLayoutItem,
  removeTileRequest?: (tileId: string) => void,
  resizeTileRequest?: (tileId: string, w: number, h: number) => void,
) {
  storeHolder.current = store;
  const draggingTileId = ref<string | null>(null);
  const provided: Record<symbol, unknown> = {
    [TILE_DRAGGING_ID as symbol]: draggingTileId,
  };
  if (removeTileRequest) {
    provided[TILE_REMOVE_REQUEST as symbol] = removeTileRequest;
  }
  if (resizeTileRequest) {
    provided[TILE_RESIZE_REQUEST as symbol] = resizeTileRequest;
  }
  const { default: GridTile } = await import("@/components/grid/Tile.vue");
  const wrapper = mount(GridTile, {
    props: { tile: store.currentGrid.tiles[0]!, layout },
    global: {
      provide: provided,
      stubs: {
        TileActions: true,
        TileCaption: true,
        TileToolbar: true,
        FloatingInputModal: true,
      },
    },
  });
  await flushPromises();
  return { wrapper, draggingTileId };
}

describe("GridTile position-only rendering", () => {
  beforeEach(() => {
    contentHooks.onShortClick.mockReset();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("uses layout geometry while rendering canonical tile content", async () => {
    const tile = makeTile();
    const store = makeStore(tile);
    storeHolder.current = store;
    const layout: GridLayoutItem = {
      i: "tile-1",
      x: 3,
      y: 4,
      w: 5,
      h: 6,
    };
    const { wrapper } = await mountGridTile(store, layout);

    // Tile geometry (data-tile-w/h) is sourced from the layout slot prop that
    // Grid.vue derives from the Griddle tile rather than a positioning wrapper.
    expect(wrapper.find(".tile-wrapper").attributes()).toEqual(
      expect.objectContaining({
        "data-tile-type": ContentType.LINK,
        "data-tile-w": "5",
        "data-tile-h": "6",
      }),
    );

    // Content is read live from the canonical tile, independent of geometry.
    (store.currentGrid.tiles[0] as Tile).content = {
      type: ContentType.IMAGE,
      src: "https://cdn.example/image.png",
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    } as ImageContent;
    await flushPromises();

    expect(wrapper.find(".tile-wrapper").attributes("data-tile-type")).toBe(
      ContentType.IMAGE,
    );
    expect(wrapper.find(".tile-wrapper").attributes()).toEqual(
      expect.objectContaining({ "data-tile-w": "5", "data-tile-h": "6" }),
    );

    wrapper.unmount();
  });

  it("routes delayed deletion through the grid engine removal request", async () => {
    const tile = makeTile();
    const store = makeStore(tile);
    const removeTileRequest = vi.fn();
    const { wrapper } = await mountGridTile(
      store,
      { i: tile.i, x: 0, y: 0, w: 2, h: 2 },
      removeTileRequest,
    );
    vi.useFakeTimers();

    (
      wrapper.vm as unknown as { removeElement: () => void }
    ).removeElement();
    expect(removeTileRequest).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(removeTileRequest).toHaveBeenCalledWith("tile-1");
    expect(store.removeTile).not.toHaveBeenCalled();

    wrapper.unmount();
    vi.useRealTimers();
  });

  it("reflows child content when the tile footprint changes", async () => {
    const onResize = vi.fn();
    const tile = makeTile();
    const store = makeStore(tile);
    const layout: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };
    const { wrapper } = await mountGridTile(store, layout);

    // Stand in for the resolved content component's onResize hook.
    (
      wrapper.vm as unknown as {
        childComponent: { onResize: () => void } | null;
      }
    ).childComponent = { onResize };

    await wrapper.setProps({
      layout: { i: "tile-1", x: 0, y: 0, w: 5, h: 6 },
    });
    await flushPromises();

    expect(onResize).toHaveBeenCalled();
    expect(wrapper.find(".tile-wrapper").attributes()).toEqual(
      expect.objectContaining({ "data-tile-w": "5", "data-tile-h": "6" }),
    );

    wrapper.unmount();
  });

  it("withholds a suggestion tile from a visitor who cannot edit", async () => {
    const tile = makeTile();
    tile.content = {
      type: ContentType.SUGGESTION,
      action: "profile",
      label: "Add Profile",
    } as SuggestionContent;
    const store = makeStore(tile);
    store.canEdit = false;
    const layout: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };
    const { wrapper } = await mountGridTile(store, layout);

    // The CTA must not reach the DOM at all — hiding it in CSS alone would
    // still expose "Add Profile" to the accessibility tree and page source.
    expect(wrapper.find(".suggestion-cta").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Add Profile");
    // ...and the tile keeps its footprint so the visitor's layout matches the
    // owner's, with the dashed `.card-body` frame hidden by the class.
    expect(wrapper.find(".tile-wrapper").classes()).toContain(
      "suggestion-hidden",
    );

    wrapper.unmount();
  });

  it("renders a suggestion tile for an owner who can edit", async () => {
    const tile = makeTile();
    tile.content = {
      type: ContentType.SUGGESTION,
      action: "profile",
      label: "Add Profile",
    } as SuggestionContent;
    const store = makeStore(tile);
    store.canEdit = true;
    const layout: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };
    const { wrapper } = await mountGridTile(store, layout);

    expect(wrapper.find(".suggestion-cta").exists()).toBe(true);
    expect(wrapper.text()).toContain("Add Profile");
    expect(wrapper.find(".tile-wrapper").classes()).not.toContain(
      "suggestion-hidden",
    );

    wrapper.unmount();
  });

  it("executes a short-click action recognized by the Griddle wrapper", async () => {
    const tile = makeTile();
    tile.content = {
      type: ContentType.SUGGESTION,
      action: "profile",
      label: "Add Profile",
    } as SuggestionContent;
    const store = makeStore(tile);
    store.canEdit = true;
    const layout: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };
    const { wrapper } = await mountGridTile(store, layout);
    const pointerEvent = Object.assign(
      new MouseEvent("pointerdown", { button: 0 }),
      { pointerType: "mouse" },
    );
    (
      wrapper.vm as unknown as {
        handleGridShortClick: (event: PointerEvent) => void;
      }
    ).handleGridShortClick(pointerEvent as PointerEvent);

    expect(store.setTileContent).toHaveBeenCalledTimes(1);
    expect(store.setTileContent).toHaveBeenCalledWith("tile-1", {
      type: ContentType.PROFILE,
    });

    wrapper.unmount();
  });

  it("forwards the original content target from the Griddle hitbox", async () => {
    const tile = makeTile();
    const store = makeStore(tile);
    store.canEdit = true;
    const layout: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };
    const { wrapper } = await mountGridTile(store, layout);
    const content = wrapper.find('[data-test="content"]');
    const pointerEvent = Object.assign(
      new MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 50,
        clientY: 60,
      }),
      { pointerType: "mouse" },
    );
    content.element.dispatchEvent(pointerEvent);
    (
      wrapper.vm as unknown as {
        handleGridShortClick: (event: PointerEvent) => void;
      }
    ).handleGridShortClick(pointerEvent as PointerEvent);

    expect(contentHooks.onShortClick).toHaveBeenCalledTimes(1);
    const forwardedEvent = contentHooks.onShortClick.mock.calls[0]![0];
    expect((forwardedEvent.target as HTMLElement).dataset.test).toBe("content");

    wrapper.unmount();
  });
});

describe("GridTile Mobile 2.0 editing", () => {
  const LAYOUT: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };

  /** Drives activation directly; the touch handler that flips it is not the subject. */
  const activate = async (
    wrapper: Awaited<ReturnType<typeof mountGridTile>>["wrapper"],
    activated: boolean,
  ) => {
    (wrapper.vm as unknown as { isActivated: boolean }).isActivated = activated;
    await flushPromises();
  };

  beforeEach(() => {
    mobile.isMobile2 = true;
    mobile.isDesktop2 = false;
    mobile.openEdit.mockReset();
    mobile.closeEdit.mockReset();
    editTileId.value = null;
  });

  afterEach(() => {
    mobile.isMobile2 = false;
    mobile.isDesktop2 = false;
  });

  it("replaces the desktop toolbar and action bar with the /EDIT sheet", async () => {
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    // Both are hover-oriented and land on top of the bottom command pill.
    expect(wrapper.find(".tile-actions-layer").exists()).toBe(false);
    expect(wrapper.find(".tile-toolbar-layer").exists()).toBe(false);

    wrapper.unmount();
  });

  it("keeps the desktop toolbar and action bar outside Mobile 2.0", async () => {
    mobile.isMobile2 = false;
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    expect(wrapper.find(".tile-actions-layer").exists()).toBe(true);
    expect(wrapper.find(".tile-toolbar-layer").exists()).toBe(true);

    wrapper.unmount();
  });

  it("opens the sheet on activation with a handle only the tile can supply", async () => {
    const resizeTileRequest = vi.fn();
    const removeTileRequest = vi.fn();
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(
      store,
      LAYOUT,
      removeTileRequest,
      resizeTileRequest,
    );

    await activate(wrapper, true);

    expect(mobile.openEdit).toHaveBeenCalledTimes(1);
    const [tileId, handle] = mobile.openEdit.mock.calls[0]!;
    expect(tileId).toBe("tile-1");

    // Resize goes through the injected Griddle request, so a preset tap from
    // the sheet displaces neighbours exactly as the desktop toolbar's does.
    handle.resizeTile("tile-1", 4, 1);
    expect(resizeTileRequest).toHaveBeenCalledWith("tile-1", 4, 1);

    // Delete runs the tile's own removal path, keeping the exit animation.
    vi.useFakeTimers();
    handle.remove();
    vi.advanceTimersByTime(250);
    expect(removeTileRequest).toHaveBeenCalledWith("tile-1");
    vi.useRealTimers();

    wrapper.unmount();
  });

  it("leaves suggestion tiles alone", async () => {
    const tile = makeTile();
    tile.content = {
      type: ContentType.SUGGESTION,
      action: "profile",
      label: "Add Profile",
    } as SuggestionContent;
    const store = makeStore(tile);
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    // A suggestion is an invitation to add content, not content to style.
    await activate(wrapper, true);
    expect(mobile.openEdit).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("closes the sheet when the tile deactivates", async () => {
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    await activate(wrapper, true);
    editTileId.value = "tile-1";
    await activate(wrapper, false);

    expect(mobile.closeEdit).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("deactivates when another tile becomes the edit target", async () => {
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    await activate(wrapper, true);
    editTileId.value = "tile-2";
    await flushPromises();

    // Only one tile is ever the target, so this one steps down — and does not
    // then close the sheet that now belongs to tile-2.
    expect(
      (wrapper.vm as unknown as { isActivated: boolean }).isActivated,
    ).toBe(false);
    expect(mobile.closeEdit).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("ignores activation outside Mobile 2.0", async () => {
    mobile.isMobile2 = false;
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    await activate(wrapper, true);
    expect(mobile.openEdit).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});

describe("GridTile desktop chrome (/EDIT without a sheet)", () => {
  const LAYOUT: GridLayoutItem = { i: "tile-1", x: 0, y: 0, w: 2, h: 2 };

  const clickTile = async (
    wrapper: Awaited<ReturnType<typeof mountGridTile>>["wrapper"],
    down: { x: number; y: number },
    up: { x: number; y: number } = down,
  ) => {
    await wrapper
      .find(".tile-wrapper")
      .trigger("mousedown", { clientX: down.x, clientY: down.y });
    await wrapper
      .find(".tile-wrapper")
      .trigger("click", { clientX: up.x, clientY: up.y });
    await flushPromises();
  };

  beforeEach(() => {
    mobile.isMobile2 = false;
    mobile.isDesktop2 = true;
    mobile.openEdit.mockReset();
    mobile.closeEdit.mockReset();
    editTileId.value = null;
  });

  afterEach(() => {
    mobile.isDesktop2 = false;
  });

  it("keeps the desktop toolbar and action bar", async () => {
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    // Unlike the phone chrome, desktop keeps its hover surfaces — the /EDIT
    // pill is additive, not a replacement.
    expect(wrapper.find(".tile-actions-layer").exists()).toBe(true);
    expect(wrapper.find(".tile-toolbar-layer").exists()).toBe(true);

    wrapper.unmount();
  });

  it("targets the /EDIT pill on a settled click", async () => {
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    await clickTile(wrapper, { x: 50, y: 50 });

    expect(mobile.openEdit).toHaveBeenCalledTimes(1);
    expect(mobile.openEdit.mock.calls[0]![0]).toBe("tile-1");

    wrapper.unmount();
  });

  it("ignores the click that trails a drag", async () => {
    const store = makeStore(makeTile());
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    // Pointer travelled well past the slop between down and click.
    await clickTile(wrapper, { x: 50, y: 50 }, { x: 120, y: 50 });

    expect(mobile.openEdit).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("ignores clicks on suggestion tiles", async () => {
    const tile = makeTile();
    tile.content = {
      type: ContentType.SUGGESTION,
      action: "profile",
      label: "Add Profile",
    } as SuggestionContent;
    const store = makeStore(tile);
    store.canEdit = true;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    await clickTile(wrapper, { x: 50, y: 50 });
    expect(mobile.openEdit).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("ignores clicks for visitors without edit permission", async () => {
    const store = makeStore(makeTile());
    store.canEdit = false;
    const { wrapper } = await mountGridTile(store, LAYOUT);

    await clickTile(wrapper, { x: 50, y: 50 });
    expect(mobile.openEdit).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
