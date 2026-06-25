import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { Grid, LinkContent, ProfileBioContent } from "@grids/contracts/types";

const dependencySpies = vi.hoisted(() => ({
  getAuthProvider: vi.fn(() => ({
    getCurrentUserId: vi.fn(() => "user-1"),
  })),
  getServiceFactory: vi.fn(() => ({
    getBadgeService: vi.fn(),
    getStorageService: vi.fn(),
  })),
  // The live view context is the single chokepoint that resolves live
  // stores + the controller; the demo must never construct it.
  createLiveGridViewContext: vi.fn(),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: dependencySpies.getAuthProvider,
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: dependencySpies.getServiceFactory,
}));

vi.mock("@/grid-context/createLiveGridViewContext", () => ({
  createLiveGridViewContext: dependencySpies.createLiveGridViewContext,
}));

vi.mock("@/utils/TileUtils", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/TileUtils")>();
  const { defineComponent, h, markRaw } = await import("vue");

  const TileContentStub = markRaw(
    defineComponent({
      name: "TileContentStub",
      props: {
        content: {
          type: Object,
          required: true,
        },
      },
      setup(props) {
        return () =>
          h("div", {
            "data-test": "tile-content",
            "data-content-type": (props.content as { type?: string }).type,
          });
      },
    }),
  );

  return {
    ...actual,
    getContentComponent: vi.fn(() => TileContentStub),
    getOptionComponent: vi.fn(() => null),
  };
});

vi.mock("vue3-grid-layout", async () => {
  const { defineComponent, h } = await import("vue");

  return {
    GridLayout: defineComponent({
      name: "GridLayoutStub",
      emits: ["layout-ready", "layout-updated"],
      setup(_props, { slots }) {
        return () => h("div", { "data-test": "grid-layout" }, slots.default?.());
      },
    }),
    GridItem: defineComponent({
      name: "GridItemStub",
      emits: ["move", "moved", "resize", "resized"],
      setup(_props, { slots }) {
        return () => h("div", { "data-test": "grid-item" }, slots.default?.());
      },
    }),
  };
});

vi.mock("@/data/DemoGrid", async () => {
  const { ContentType } = await import("@grids/contracts/types");
  const paragraphDoc = (text: string) =>
    JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
  const demoGrid = {
    id: "__homepage_demo__",
    userId: "__homepage_demo_user__",
    name: "Demo",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [
      {
        i: "demo-profile",
        x: 0,
        y: 0,
        w: 4,
        h: 4,
        caption: "",
        content: {
          type: ContentType.PROFILE,
          name: paragraphDoc("Demo Profile"),
          title: paragraphDoc("Demo Title"),
          bio: paragraphDoc("Demo bio"),
          avatarShape: "square",
          avatarRadius: 12,
          avatarSides: 6,
          profilePhotoUrl: "",
        } as ProfileBioContent,
      },
      {
        i: "demo-link",
        x: 4,
        y: 0,
        w: 2,
        h: 1,
        caption: "",
        content: {
          type: ContentType.LINK,
          link: "https://example.com",
          customTitle: "Example",
          customSubtitle: "@example.com",
        } as LinkContent,
      },
    ],
    overrides: {},
  } satisfies Grid;

  return {
    DEMO_GRID_DIMENSIONS: {
      lg: { width: 900, height: 600 },
      md: { width: 600, height: 500 },
      sm: { width: 300, height: 600 },
    },
    createDemoGrid: () => demoGrid,
  };
});

describe("LandingPageGridEmbed canvas isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(900);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    class ResizeObserverStub {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("mounts representative demo canvas renderers without touching live store or services", async () => {
    const { default: LandingPageGridEmbed } = await import(
      "@/components/marketing/LandingPageGridEmbed.vue"
    );

    const wrapper = mount(LandingPageGridEmbed, {
      attachTo: document.body,
      global: {
        stubs: { Teleport: true },
      },
    });
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-test="grid-layout"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-test="grid-item"]').length).toBeGreaterThan(0);
    expect(dependencySpies.createLiveGridViewContext).not.toHaveBeenCalled();
    expect(dependencySpies.getServiceFactory).not.toHaveBeenCalled();
    expect(dependencySpies.getAuthProvider).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
