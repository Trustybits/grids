import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import {
  defineComponent,
  h,
  nextTick,
  ref,
  type Ref,
} from "vue";
import type { Breakpoint, Tile } from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  measureViewportGridRow,
  useResponsiveGridLayout,
  type ResponsiveGridLayoutEnvironment,
} from "../useResponsiveGridLayout";

const layoutUtils = vi.hoisted(() => ({
  breakpointToColumnCount: vi.fn(),
  calculateViewportColumnCount: vi.fn(),
  columnCountToBreakpoint: vi.fn(),
  projectGridLayout: vi.fn(),
}));

vi.mock("@/utils/GridLayoutUtils", () => layoutUtils);

function layoutItem(
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
): GridLayoutItem {
  return { i, x, y, w, h };
}

function createEnvironment(initialWidth = 1000) {
  let viewportWidth = initialWidth;
  let resizeListener: (() => void) | null = null;
  let observerCallback:
    | ((entries: readonly [{ contentRect: { height: number } }]) => void)
    | null = null;
  const observer = {
    observe: vi.fn(),
    disconnect: vi.fn(),
  };
  const environment: ResponsiveGridLayoutEnvironment = {
    getViewportWidth: vi.fn(() => viewportWidth),
    addResizeListener: vi.fn((listener) => {
      resizeListener = listener;
    }),
    removeResizeListener: vi.fn((listener) => {
      if (resizeListener === listener) resizeListener = null;
    }),
    createResizeObserver: vi.fn((callback) => {
      observerCallback = callback as typeof observerCallback;
      return observer;
    }),
  };

  return {
    environment,
    observer,
    emitHeight(height: number) {
      observerCallback?.([{ contentRect: { height } }]);
    },
    resizeTo(width: number) {
      viewportWidth = width;
      resizeListener?.();
    },
  };
}

function mountComposable(
  environment: ResponsiveGridLayoutEnvironment,
  options: {
    baseColumnCount?: Ref<number>;
    forcedBreakpoint?: Ref<Breakpoint | null>;
    disableAutoScale?: Ref<boolean>;
  } = {},
) {
  const baseColumnCount = options.baseColumnCount ?? ref(12);
  const forcedBreakpoint = options.forcedBreakpoint ?? ref(null);
  const disableAutoScale = options.disableAutoScale ?? ref(false);
  const tiles = ref<Tile[]>([]);
  const overrides = ref({});
  const onBreakpointsChanged = vi.fn();
  let composable:
    | ReturnType<typeof useResponsiveGridLayout>
    | undefined;

  const wrapper = mount(
    defineComponent({
      setup() {
        composable = useResponsiveGridLayout({
          baseColumnCount,
          forcedBreakpoint,
          tiles,
          overrides,
          rowHeight: 75,
          margin: 48,
          disableAutoScale,
          onBreakpointsChanged,
          environment,
        });
        return () => h("div");
      },
    }),
  );

  return {
    baseColumnCount,
    composable: composable!,
    disableAutoScale,
    forcedBreakpoint,
    onBreakpointsChanged,
    overrides,
    tiles,
    wrapper,
  };
}

describe("measureViewportGridRow", () => {
  it("returns zero when the grid element is absent", () => {
    expect(
      measureViewportGridRow({
        documentRef: { querySelector: vi.fn(() => null) },
        viewportHeight: 800,
      }),
    ).toBe(0);
  });

  it("converts the viewport center to a non-negative grid row", () => {
    const querySelector = vi.fn(() => ({
      getBoundingClientRect: () => ({ top: -200 }),
    })) as unknown as Document["querySelector"];

    expect(
      measureViewportGridRow({
        documentRef: { querySelector },
        viewportHeight: 800,
        rowHeight: 75,
        margin: 48,
      }),
    ).toBe(4);
  });
});

describe("useResponsiveGridLayout", () => {
  beforeEach(() => {
    layoutUtils.calculateViewportColumnCount.mockReturnValue(8);
    layoutUtils.breakpointToColumnCount.mockImplementation(
      (breakpoint: Breakpoint) =>
        breakpoint === "sm" ? 4 : breakpoint === "md" ? 8 : 12,
    );
    layoutUtils.columnCountToBreakpoint.mockReturnValue("md");
    layoutUtils.projectGridLayout.mockImplementation(() => [
      layoutItem("tile-1", 0, 0, 2, 2),
    ]);
  });

  it("derives viewport and active breakpoints and reports them", () => {
    const browser = createEnvironment();
    const { composable, onBreakpointsChanged, wrapper } = mountComposable(
      browser.environment,
    );

    expect(composable.viewportColumnCount.value).toBe(8);
    expect(composable.viewportBreakpoint.value).toBe("md");
    expect(composable.activeBreakpoint.value).toBe("md");
    expect(onBreakpointsChanged).toHaveBeenCalledWith("md", "md");

    wrapper.unmount();
  });

  it("uses the forced breakpoint column count", async () => {
    const browser = createEnvironment();
    const forcedBreakpoint = ref<Breakpoint | null>(null);
    const { composable, wrapper } = mountComposable(browser.environment, {
      forcedBreakpoint,
    });

    forcedBreakpoint.value = "sm";
    await nextTick();

    expect(layoutUtils.breakpointToColumnCount).toHaveBeenCalledWith("sm", 12);
    expect(composable.responsiveColumnCount.value).toBe(4);
    expect(composable.activeBreakpoint.value).toBe("sm");

    wrapper.unmount();
  });

  it("updates viewport width from the registered resize listener", async () => {
    const browser = createEnvironment(1000);
    const { composable, wrapper } = mountComposable(browser.environment);

    browser.resizeTo(640);
    await nextTick();

    expect(composable.viewportWidth.value).toBe(640);
    expect(browser.environment.removeResizeListener).not.toHaveBeenCalled();

    wrapper.unmount();
    expect(browser.environment.removeResizeListener).toHaveBeenCalledOnce();
  });

  it("calculates scaling styles and can disable automatic scaling", async () => {
    layoutUtils.calculateViewportColumnCount.mockReturnValue(4);
    const browser = createEnvironment(300);
    const disableAutoScale = ref(false);
    const { composable, wrapper } = mountComposable(browser.environment, {
      disableAutoScale,
    });

    expect(composable.gridWidth.value).toBe(540);
    expect(composable.gridInnerStyle.value).toEqual({
      width: "540px",
      transformOrigin: "top left",
      transform: `scale(${300 / 540})`,
    });
    expect(composable.scaleWrapperStyle.value).toEqual({
      width: "300px",
      overflow: "hidden",
    });

    disableAutoScale.value = true;
    await nextTick();

    expect(composable.mobileScale.value).toBe(1);
    expect(composable.gridInnerStyle.value).toEqual({ width: "540px" });
    expect(composable.scaleWrapperStyle.value).toEqual({});

    wrapper.unmount();
  });

  it("observes the grid when its element ref becomes available after mounting", async () => {
    const browser = createEnvironment(300);
    const { composable, wrapper } = mountComposable(browser.environment);
    const element = {
      getBoundingClientRect: () => ({ height: 200 }),
    } as HTMLElement;

    await nextTick();
    await nextTick();
    expect(browser.observer.observe).not.toHaveBeenCalled();

    composable.gridLayoutRef.value = element;
    await nextTick();
    await nextTick();

    expect(browser.observer.observe).toHaveBeenCalledWith(element);
    expect(composable.naturalGridHeight.value).toBe(200);

    browser.emitHeight(240);
    expect(composable.naturalGridHeight.value).toBe(240);

    wrapper.unmount();
    expect(browser.observer.disconnect).toHaveBeenCalled();
  });

  it("projects position-only layouts and reprojects on tile change", async () => {
    const browser = createEnvironment();
    const { composable, tiles, wrapper } = mountComposable(
      browser.environment,
    );

    expect(layoutUtils.projectGridLayout).toHaveBeenCalledWith({
      tiles: [],
      breakpoint: "md",
      columns: 8,
      overrides: {},
    });
    expect(composable.projectedLayout.value).toEqual([
      layoutItem("tile-1", 0, 0, 2, 2),
    ]);

    layoutUtils.projectGridLayout.mockClear();
    tiles.value = [{ i: "tile-2" } as Tile];
    await nextTick();

    expect(layoutUtils.projectGridLayout).toHaveBeenCalledWith(
      expect.objectContaining({ tiles: [{ i: "tile-2" }] }),
    );

    wrapper.unmount();
  });

  it("resolves layout readiness only after the breakpoint is marked ready", async () => {
    const browser = createEnvironment();
    const forcedBreakpoint = ref<Breakpoint | null>(null);
    const { composable, wrapper } = mountComposable(browser.environment, {
      forcedBreakpoint,
    });

    let resolved = false;
    const readiness = composable.waitForLayoutReady("sm").then(() => {
      resolved = true;
    });
    await nextTick();
    expect(resolved).toBe(false);

    forcedBreakpoint.value = "sm";
    await nextTick();
    await nextTick();
    expect(resolved).toBe(false);
    expect(composable.layoutReadyBreakpoint.value).toBeNull();

    // markLayoutReady is what Grid.vue calls once it has loaded the projected
    // tiles into the Griddle engine for the active breakpoint.
    composable.markLayoutReady();
    await readiness;

    expect(resolved).toBe(true);
    expect(composable.layoutReadyBreakpoint.value).toBe("sm");

    wrapper.unmount();
  });
});
