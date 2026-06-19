import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  watch,
  type CSSProperties,
  type MaybeRefOrGetter,
} from "vue";
import type {
  Breakpoint,
  Tile,
  TilePosition,
} from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import {
  breakpointToColumnCount,
  calculateViewportColumnCount,
  columnCountToBreakpoint,
  projectGridLayout,
  reconcileGridLayout,
} from "@/utils/GridLayoutUtils";

type GridLayoutElement =
  | HTMLElement
  | { $el: HTMLElement }
  | null;

interface GridResizeObserverEntry {
  contentRect: {
    height: number;
  };
}

interface GridResizeObserver {
  observe(element: HTMLElement): void;
  disconnect(): void;
}

export interface ResponsiveGridLayoutEnvironment {
  getViewportWidth(): number;
  addResizeListener(listener: () => void): void;
  removeResizeListener(listener: () => void): void;
  createResizeObserver(
    callback: (entries: readonly GridResizeObserverEntry[]) => void,
  ): GridResizeObserver | null;
}

export interface UseResponsiveGridLayoutInput {
  baseColumnCount: MaybeRefOrGetter<number>;
  forcedBreakpoint: MaybeRefOrGetter<Breakpoint | null>;
  tiles: MaybeRefOrGetter<readonly Tile[]>;
  overrides: MaybeRefOrGetter<
    Partial<Record<Breakpoint, Record<string, TilePosition>>> | undefined
  >;
  rowHeight: MaybeRefOrGetter<number>;
  margin: MaybeRefOrGetter<number>;
  disableAutoScale?: MaybeRefOrGetter<boolean>;
  onBreakpointsChanged?: (
    activeBreakpoint: Breakpoint,
    viewportBreakpoint: Breakpoint,
  ) => void;
  environment?: ResponsiveGridLayoutEnvironment;
}

export interface ViewportGridMeasurementInput {
  rowHeight?: number;
  margin?: number;
  selector?: string;
  documentRef?: Pick<Document, "querySelector"> | null;
  viewportHeight?: number;
}

const defaultEnvironment: ResponsiveGridLayoutEnvironment = {
  getViewportWidth: () =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  addResizeListener: (listener) => {
    if (typeof window !== "undefined") {
      window.addEventListener("resize", listener);
    }
  },
  removeResizeListener: (listener) => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", listener);
    }
  },
  createResizeObserver: (callback) => {
    if (typeof ResizeObserver === "undefined") return null;
    return new ResizeObserver((entries) => callback(entries));
  },
};

export function measureViewportGridRow({
  rowHeight = 75,
  margin = 48,
  selector = ".vue-grid-grid",
  documentRef = typeof document === "undefined" ? null : document,
  viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight,
}: ViewportGridMeasurementInput = {}): number {
  const gridElement = documentRef?.querySelector<HTMLElement>(selector);
  if (!gridElement) return 0;

  const pixelsIntoGrid =
    viewportHeight / 2 - gridElement.getBoundingClientRect().top;
  const gridRow = Math.floor(
    (pixelsIntoGrid - margin) / (rowHeight + margin),
  );
  return Math.max(0, gridRow);
}

export function useResponsiveGridLayout({
  baseColumnCount,
  forcedBreakpoint,
  tiles,
  overrides,
  rowHeight,
  margin,
  disableAutoScale = false,
  onBreakpointsChanged,
  environment = defaultEnvironment,
}: UseResponsiveGridLayoutInput) {
  const viewportWidth = ref(environment.getViewportWidth());
  const gridLayoutRef = ref<GridLayoutElement>(null);
  const scaleWrapperRef = ref<HTMLElement | null>(null);
  const naturalGridHeight = ref(0);
  const renderedLayout = ref<GridLayoutItem[]>([]);
  const layoutRevision = ref(0);
  const layoutReadyBreakpoint = ref<Breakpoint | null>(null);
  const layoutWaiters = new Map<
    Breakpoint,
    Set<() => void>
  >();
  let resizeObserver: GridResizeObserver | null = null;

  const viewportColumnCount = computed(() =>
    calculateViewportColumnCount({
      baseColumnCount: toValue(baseColumnCount),
      viewportWidth: viewportWidth.value,
      rowHeight: toValue(rowHeight),
      margin: toValue(margin),
    }),
  );

  const responsiveColumnCount = computed(() => {
    const forced = toValue(forcedBreakpoint);
    return forced
      ? breakpointToColumnCount(forced, toValue(baseColumnCount))
      : viewportColumnCount.value;
  });

  const viewportBreakpoint = computed<Breakpoint>(() =>
    columnCountToBreakpoint(viewportColumnCount.value),
  );

  const activeBreakpoint = computed<Breakpoint>(
    () => toValue(forcedBreakpoint) ?? viewportBreakpoint.value,
  );

  const projectedLayout = computed(() =>
    projectGridLayout({
      tiles: toValue(tiles),
      breakpoint: activeBreakpoint.value,
      columns: responsiveColumnCount.value,
      overrides: toValue(overrides),
    }),
  );

  const gridWidth = computed(
    () =>
      responsiveColumnCount.value * toValue(rowHeight) +
      (responsiveColumnCount.value + 1) * toValue(margin),
  );

  const mobileScale = computed(() => {
    if (toValue(disableAutoScale)) return 1;
    if (viewportWidth.value >= gridWidth.value) return 1;
    return viewportWidth.value / gridWidth.value;
  });

  const scaleWrapperStyle = computed<CSSProperties>(() => {
    if (mobileScale.value >= 1) return {};

    const scaledHeight =
      naturalGridHeight.value > 0
        ? naturalGridHeight.value * mobileScale.value
        : undefined;
    return {
      width: `${viewportWidth.value}px`,
      overflow: "hidden",
      ...(scaledHeight === undefined
        ? {}
        : { height: `${scaledHeight}px` }),
    };
  });

  const gridInnerStyle = computed<CSSProperties>(() => {
    const base = { width: `${gridWidth.value}px` };
    if (mobileScale.value >= 1) return base;
    return {
      ...base,
      transformOrigin: "top left",
      transform: `scale(${mobileScale.value})`,
    };
  });

  const resolveLayoutWaiters = (breakpoint: Breakpoint) => {
    const waiters = layoutWaiters.get(breakpoint);
    if (!waiters) return;
    for (const resolve of waiters) resolve();
    layoutWaiters.delete(breakpoint);
  };

  const waitForLayoutReady = (breakpoint: Breakpoint): Promise<void> => {
    if (layoutReadyBreakpoint.value === breakpoint) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const waiters = layoutWaiters.get(breakpoint) ?? new Set();
      waiters.add(resolve);
      layoutWaiters.set(breakpoint, waiters);
    });
  };

  const resolveGridElement = (): HTMLElement | null => {
    const value = gridLayoutRef.value;
    return value && "$el" in value ? value.$el : value;
  };

  const observeGridHeight = () => {
    resizeObserver?.disconnect();
    resizeObserver = null;

    const element = resolveGridElement();
    if (!element) return;

    resizeObserver = environment.createResizeObserver((entries) => {
      for (const entry of entries) {
        naturalGridHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver?.observe(element);
    naturalGridHeight.value = element.getBoundingClientRect().height;
  };

  const updateViewportWidth = () => {
    viewportWidth.value = environment.getViewportWidth();
  };

  watch(
    [activeBreakpoint, viewportBreakpoint],
    ([active, viewport]) => {
      onBreakpointsChanged?.(active, viewport);
    },
    { immediate: true },
  );

  watch(
    [activeBreakpoint, projectedLayout],
    ([breakpoint, projected]) => {
      renderedLayout.value = reconcileGridLayout(
        renderedLayout.value,
        projected,
      );
      layoutReadyBreakpoint.value = breakpoint;
      layoutRevision.value += 1;
      resolveLayoutWaiters(breakpoint);
      void nextTick(observeGridHeight);
    },
    { immediate: true },
  );

  watch(gridLayoutRef, (element) => {
    if (element) void nextTick(observeGridHeight);
  });

  onMounted(() => {
    updateViewportWidth();
    environment.addResizeListener(updateViewportWidth);
    void nextTick(observeGridHeight);
  });

  onUnmounted(() => {
    environment.removeResizeListener(updateViewportWidth);
    resizeObserver?.disconnect();
    resizeObserver = null;
    for (const waiters of layoutWaiters.values()) {
      for (const resolve of waiters) resolve();
    }
    layoutWaiters.clear();
  });

  return {
    activeBreakpoint,
    gridInnerStyle,
    gridLayoutRef,
    gridWidth,
    layoutReadyBreakpoint,
    layoutRevision,
    mobileScale,
    naturalGridHeight,
    projectedLayout,
    renderedLayout,
    responsiveColumnCount,
    scaleWrapperRef,
    scaleWrapperStyle,
    viewportBreakpoint,
    viewportColumnCount,
    viewportWidth,
    waitForLayoutReady,
  };
}
