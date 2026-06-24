import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { GridViewContext } from "@/grid-view/GridViewContext";
import {
  provideGridViewContext,
  resetDefaultGridViewContext,
  setDefaultGridViewContextFactory,
  useGridViewContext,
} from "@/grid-view/useGridViewContext";

const storeHolder = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => storeHolder.current,
}));

function makeContext(mode: GridViewContext["mode"]): GridViewContext {
  return { mode } as GridViewContext;
}

function mountContextConsumer(provider?: GridViewContext): {
  wrapper: VueWrapper;
  resolved: GridViewContext | null;
} {
  let resolved: GridViewContext | null = null;

  const Child = defineComponent({
    setup() {
      resolved = useGridViewContext();
      return () => h("div");
    },
  });

  const Parent = defineComponent({
    setup() {
      if (provider) {
        provideGridViewContext(provider);
      }
      return () => h(Child);
    },
  });

  const wrapper = mount(Parent);
  return { wrapper, resolved };
}

afterEach(() => {
  resetDefaultGridViewContext();
});

describe("useGridViewContext", () => {
  it("returns an explicitly provided context", () => {
    const provided = makeContext("demo");
    const fallback = makeContext("live");
    const factory = vi.fn(() => fallback);
    setDefaultGridViewContextFactory(factory);

    const { wrapper, resolved } = mountContextConsumer(provided);

    expect(resolved).toBe(provided);
    expect(factory).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("lazily memoizes the default context when no provider exists", () => {
    const fallback = makeContext("live");
    const factory = vi.fn(() => fallback);
    setDefaultGridViewContextFactory(factory);

    const first = mountContextConsumer();
    const second = mountContextConsumer();

    expect(first.resolved).toBe(fallback);
    expect(second.resolved).toBe(fallback);
    expect(factory).toHaveBeenCalledTimes(1);

    first.wrapper.unmount();
    second.wrapper.unmount();
  });

  it("resets the memoized default context", () => {
    const first = makeContext("live");
    const second = makeContext("demo");
    setDefaultGridViewContextFactory(vi.fn(() => first));

    const firstMount = mountContextConsumer();
    resetDefaultGridViewContext();
    setDefaultGridViewContextFactory(vi.fn(() => second));
    const secondMount = mountContextConsumer();

    expect(firstMount.resolved).toBe(first);
    expect(secondMount.resolved).toBe(second);

    firstMount.wrapper.unmount();
    secondMount.wrapper.unmount();
  });

  it("creates a live context when no provider or override factory exists", () => {
    storeHolder.current = {
      currentGrid: null,
      isOwner: false,
      canEdit: false,
      isLoading: false,
      verticalCompact: true,
      activeBreakpoint: "lg",
      viewportBreakpoint: "lg",
      forcedBreakpoint: null,
      displayPositions: [],
      showMetaData: false,
      showMetaDataVerbose: false,
      uploadingTiles: {},
      activeTileId: null,
      activePanelId: null,
      pendingFocusTileId: null,
      registerLayoutReadinessAdapter: vi.fn(),
      setActiveBreakpoint: vi.fn(),
      setViewportBreakpoint: vi.fn(),
      setForcedBreakpoint: vi.fn(),
      setDisplayPositions: vi.fn(),
      commitCompactedLayout: vi.fn(),
      beginMove: vi.fn(),
      commitMove: vi.fn(),
      beginResize: vi.fn(),
      commitResize: vi.fn(),
      beginEditing: vi.fn(),
      commitEditing: vi.fn(),
      setTileContent: vi.fn(),
      patchTileContent: vi.fn(),
      autosaveTileContent: vi.fn(),
      patchDocumentItem: vi.fn(),
      updateCaption: vi.fn(),
      removeTile: vi.fn(),
      duplicateTile: vi.fn(),
      resizeTile: vi.fn(),
      toggleTileBorder: vi.fn(),
      toggleLinkBackground: vi.fn(),
      setPanelActive: vi.fn(),
      toggleMenuActive: vi.fn(),
      togglePanelActive: vi.fn(),
      closeMenus: vi.fn(),
      getCookieValue: vi.fn(),
    };

    const first = mountContextConsumer();
    const second = mountContextConsumer();

    expect(first.resolved?.mode).toBe("live");
    expect(second.resolved).toBe(first.resolved);

    first.wrapper.unmount();
    second.wrapper.unmount();
  });
});
