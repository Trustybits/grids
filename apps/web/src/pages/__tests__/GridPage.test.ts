import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import type { Grid } from "@grids/contracts/types";

const holders = vi.hoisted(() => ({
  route: null as Record<string, unknown> | null,
  session: null as Record<string, unknown> | null,
  controller: null as Record<string, unknown> | null,
  routerPush: vi.fn(),
  trackGridEnter: vi.fn(),
  getSlugData: vi.fn(),
  applyGridTheme: vi.fn(),
  resetToAppDefault: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: () => holders.route,
  useRouter: () => ({ push: holders.routerPush }),
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => holders.session,
}));

vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => ({
    forcedBreakpoint: null,
    viewportBreakpoint: "lg",
  }),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => holders.controller,
}));

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({
    applyGridTheme: holders.applyGridTheme,
    resetToAppDefault: holders.resetToAppDefault,
  }),
}));

vi.mock("@/composables/useAnalytics", () => ({
  useAnalytics: () => ({ trackGridEnter: holders.trackGridEnter }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getUserService: () => ({
      getSlugData: holders.getSlugData,
    }),
  }),
}));

vi.mock("@/composables/usePageTitle", () => ({
  usePageTitle: vi.fn(),
}));

vi.mock("@/composables/useDynamicFavicon", () => ({
  useDynamicFavicon: vi.fn(),
}));

vi.mock("@/composables/useDragAndPaste", () => ({
  useDragAndPaste: () => ({ isDraggingOver: { value: false } }),
}));

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({ uploadFileToUrl: vi.fn() }),
}));

vi.mock("@/composables/useUndoRedoKeys", () => ({
  useUndoRedoKeys: vi.fn(),
}));

vi.mock("@/composables/useColorPicker", () => ({
  computeTextColor: vi.fn(() => "#000000"),
}));

const dependencyStub = vi.hoisted(() => ({
  name: "DependencyStub",
  template: "<div />",
}));

vi.mock("@/components/grid/Grid.vue", () => ({
  default: dependencyStub,
}));
vi.mock("@/components/grid/GridToolbar.vue", () => ({
  default: dependencyStub,
}));
vi.mock("@/components/grid/ViewControls.vue", () => ({
  default: dependencyStub,
}));
vi.mock("@/components/grid/UndoRedoControls.vue", () => ({
  default: dependencyStub,
}));
vi.mock("@/components/ui-elements/Button.vue", () => ({
  default: dependencyStub,
}));
vi.mock("@/components/icons/AlertCircleIcon.vue", () => ({
  default: dependencyStub,
}));
vi.mock("@/components/icons/UploadIcon.vue", () => ({
  default: dependencyStub,
}));

function makeGrid(id: string): Grid {
  return {
    id,
    userId: "user-1",
    name: `Grid ${id}`,
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeSession() {
  return reactive({
    currentGrid: null as Grid | null,
    isOwner: false,
    loadError: null as string | null,
    canEditAtBreakpoint: vi.fn(() => false),
  });
}

function makeController(session: ReturnType<typeof makeSession>) {
  return {
    clearSession: vi.fn(() => {
      session.currentGrid = null;
    }),
    stopWatchingGrid: vi.fn(),
    loadGrid: vi.fn(),
    addBackgroundImage: vi.fn(),
    deleteGrid: vi.fn(),
  };
}

describe("GridPage route loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holders.route = reactive({
      path: "/grid/grid-1",
      params: { id: "grid-1", slug: undefined },
    });
    const session = makeSession();
    holders.session = session;
    holders.controller = makeController(session);
    holders.getSlugData.mockResolvedValue(null);
  });

  it("clears the prior session, loads a direct grid route, and tracks entry", async () => {
    const session = holders.session as ReturnType<typeof makeSession>;
    const controller = holders.controller as ReturnType<typeof makeController>;
    controller.loadGrid.mockImplementation(async (id: string) => {
      session.currentGrid = makeGrid(id);
    });
    const { default: GridPage } = await import("@/pages/GridPage.vue");

    const wrapper = mount(GridPage);
    await flushPromises();

    expect(controller.clearSession).toHaveBeenCalledTimes(1);
    expect(controller.loadGrid).toHaveBeenCalledWith("grid-1");
    expect(holders.trackGridEnter).toHaveBeenCalledWith("grid-1");
    expect(wrapper.find(".loading-state").exists()).toBe(false);
    expect(wrapper.find(".background-image-container").exists()).toBe(true);

    wrapper.unmount();
  });

  it("ignores completion handling from an obsolete route request", async () => {
    const route = holders.route as {
      path: string;
      params: { id?: string; slug?: string };
    };
    const session = holders.session as ReturnType<typeof makeSession>;
    const controller = holders.controller as ReturnType<typeof makeController>;
    const first = deferred<void>();
    const second = deferred<void>();
    controller.loadGrid.mockImplementation(async (id: string) => {
      if (id === "grid-1") {
        await first.promise;
        return;
      }
      await second.promise;
      session.currentGrid = makeGrid("grid-2");
    });
    const { default: GridPage } = await import("@/pages/GridPage.vue");
    const wrapper = mount(GridPage);
    await flushPromises();

    route.path = "/grid/grid-2";
    route.params.id = "grid-2";
    await flushPromises();
    expect(controller.loadGrid).toHaveBeenNthCalledWith(2, "grid-2");

    second.resolve();
    await flushPromises();
    expect(holders.trackGridEnter).toHaveBeenCalledTimes(1);
    expect(holders.trackGridEnter).toHaveBeenCalledWith("grid-2");
    expect(wrapper.find(".loading-state").exists()).toBe(false);

    first.resolve();
    await flushPromises();

    expect(holders.trackGridEnter).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".loading-state").exists()).toBe(false);

    wrapper.unmount();
  });

  it("resolves a slug to its default grid and tracks that grid", async () => {
    holders.route = reactive({
      path: "/ada",
      params: { id: undefined, slug: "ada" },
    });
    const session = holders.session as ReturnType<typeof makeSession>;
    const controller = holders.controller as ReturnType<typeof makeController>;
    holders.getSlugData.mockResolvedValue({
      defaultGridId: "default-grid",
    });
    controller.loadGrid.mockImplementation(async (id: string) => {
      session.currentGrid = makeGrid(id);
    });
    const { default: GridPage } = await import("@/pages/GridPage.vue");

    const wrapper = mount(GridPage);
    await flushPromises();

    expect(holders.getSlugData).toHaveBeenCalledWith("ada");
    expect(controller.loadGrid).toHaveBeenCalledWith("default-grid");
    expect(holders.trackGridEnter).toHaveBeenCalledWith("default-grid");
    expect(wrapper.find(".background-image-container").exists()).toBe(true);

    wrapper.unmount();
  });

  it("shows specific errors for a missing slug and a slug without a default grid", async () => {
    holders.route = reactive({
      path: "/missing",
      params: { id: undefined, slug: "missing" },
    });
    holders.getSlugData.mockResolvedValueOnce(null);
    const { default: GridPage } = await import("@/pages/GridPage.vue");

    const missingWrapper = mount(GridPage);
    await flushPromises();

    expect(missingWrapper.find(".error-state h1").text()).toBe(
      "Handle Not Found",
    );
    expect(missingWrapper.find(".error-description").text()).toContain(
      `The handle "@missing" doesn't exist`,
    );
    missingWrapper.unmount();

    holders.route = reactive({
      path: "/ada",
      params: { id: undefined, slug: "ada" },
    });
    holders.getSlugData.mockResolvedValueOnce({ defaultGridId: null });

    const noDefaultWrapper = mount(GridPage);
    await flushPromises();

    expect(noDefaultWrapper.find(".error-state h1").text()).toBe(
      "No Default Grid",
    );
    expect(noDefaultWrapper.find(".error-description").text()).toContain(
      "hasn't set a default grid yet",
    );
    noDefaultWrapper.unmount();
  });
});
