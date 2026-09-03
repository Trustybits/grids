import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";

const holder = vi.hoisted(() => ({
  collection: { grids: [] as Array<Record<string, unknown>> },
  isOwner: true,
  canUseEarlyAccess: true,
  fetchGrids: vi.fn(),
  addToast: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: () => reactive({ path: "/grid/1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/stores/grid/gridCollection", () => ({
  useGridCollectionStore: () => holder.collection,
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => ({
    get isOwner() {
      return holder.isOwner;
    },
  }),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({ fetchGrids: holder.fetchGrids }),
}));

vi.mock("@/composables/useMobileExperience", () => ({
  useMobileExperience: () => ({
    canUseEarlyAccess: holder.canUseEarlyAccess,
    isEarlyAccessEnrolled: false,
    setEarlyAccessEnrolled: vi.fn(),
  }),
}));

vi.mock("@/stores/toast", () => ({
  useToastStore: () => ({ addToast: holder.addToast }),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({
    signOut: holder.signOut,
    getCurrentUserId: () => "user-1",
  }),
}));

// Account settings pulled in by the drawer. The modals' own setup reaches for
// the service factory, so stub them; the tier/checkout composables are mocked
// so the account rows render without a real Stripe/service runtime.
vi.mock("@/components/modal/SlugClaimModal.vue", () => ({
  default: { template: "<div data-test=\"slug-modal\" />" },
}));

vi.mock("@/components/modal/FileArchiveModal.vue", () => ({
  default: { template: "<div data-test=\"file-archive-modal\" />" },
}));

vi.mock("@/composables/useTier", async () => {
  const { ref } = await import("vue");
  return { useTier: () => ({ isProOrAbove: ref(false) }) };
});

vi.mock("@/composables/useStripeCheckout", async () => {
  const { ref } = await import("vue");
  return {
    useStripeCheckout: () => ({
      loading: ref(false),
      openCustomerPortal: vi.fn(),
    }),
  };
});

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getUserService: () => ({
      getUserProfile: vi.fn(async () => ({ slug: "me" })),
    }),
  }),
}));

vi.mock("@/utils/TimeConversion", () => ({
  valueToMillis: (v: unknown) => (typeof v === "number" ? v : 0),
}));

vi.mock("@/composables/useGridStats", async () => {
  const { ref } = await import("vue");
  return {
    useGridStats: () => ({
      lifetimeViews: ref(42),
      uniqueViewers: ref(7),
      yesterdayViews: ref(5),
      averageTimeSpent: ref("1m 3s"),
    }    ),
  };
});

vi.mock("@/components/ui-controls/Toggle.vue", () => ({
  default: { template: '<span data-test="toggle" />' },
}));

// The global test setup stubs RouterLink as `true` (no slot). Override it with
// an object stub so the row labels inside <router-link> actually render.
const globalOpts = {
  stubs: {
    RouterLink: {
      props: ["to"],
      template: '<a class="rl"><slot /></a>',
    },
  },
};

async function mountDrawer(open: boolean) {
  const { default: MobileMenuDrawer } = await import("../MobileMenuDrawer.vue");
  return mount(MobileMenuDrawer, { props: { open }, global: globalOpts });
}

describe("MobileMenuDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.collection = {
      grids: [
        { id: "a", name: "Alpha", updatedAt: 200 },
        { id: "b", name: "Beta", updatedAt: 100 },
      ],
    };
    holder.isOwner = true;
    holder.canUseEarlyAccess = true;
  });

  it("renders nothing until opened", async () => {
    const wrapper = await mountDrawer(false);
    expect(wrapper.find(".mmd-panel").exists()).toBe(false);
  });

  it("renders the panel and recent grids when open", async () => {
    const wrapper = await mountDrawer(true);
    expect(wrapper.find(".mmd-panel").exists()).toBe(true);
    expect(wrapper.text()).toContain("Recent Grid Pages");
    expect(wrapper.text()).toContain("Alpha");
    expect(wrapper.text()).toContain("Beta");
  });

  it("does not refetch grids when the collection is already loaded", async () => {
    await mountDrawer(true);
    expect(holder.fetchGrids).not.toHaveBeenCalled();
  });

  it("fetches grids on open only when the collection is empty", async () => {
    holder.collection = { grids: [] };
    await mountDrawer(true);
    expect(holder.fetchGrids).toHaveBeenCalled();
  });

  it("emits close when the backdrop is clicked", async () => {
    const wrapper = await mountDrawer(true);
    await wrapper.get(".mmd-backdrop").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("exposes the Early Access opt-out toggle when eligible", async () => {
    const wrapper = await mountDrawer(true);
    expect(wrapper.find('[data-test="toggle"]').exists()).toBe(true);
  });

  it("hides the analytics section for non-owners", async () => {
    holder.isOwner = false;
    const wrapper = await mountDrawer(true);
    expect(wrapper.find(".mmd-analytics").exists()).toBe(false);
  });

  it("shows the collapsed analytics summary and expands it inline on tap", async () => {
    const wrapper = await mountDrawer(true);
    const analytics = wrapper.get(".mmd-analytics");
    // Collapsed: the summary shows yesterday's views and the body is closed.
    expect(analytics.find(".mmd-analytics__summary").text()).toContain(
      "5 views yesterday",
    );
    expect(analytics.find(".mmd-analytics__body").classes()).not.toContain(
      "is-open",
    );

    await analytics.get(".mmd-analytics__trigger").trigger("click");

    // Expanded: the summary is hidden and the stat rows are revealed inline.
    expect(analytics.find(".mmd-analytics__summary").exists()).toBe(false);
    expect(analytics.find(".mmd-analytics__body").classes()).toContain(
      "is-open",
    );
    const stats = analytics.findAll(".mmd-stat");
    expect(stats).toHaveLength(4);
    expect(analytics.text()).toContain("Total views");
    expect(analytics.text()).toContain("42");
  });

  it("anchors the account/support group after the recent grids", async () => {
    const wrapper = await mountDrawer(true);
    const order = wrapper
      .findAll(".mmd-panel > *")
      .map((el) => el.classes().join(" "));
    const recentsIdx = order.findIndex((c) => c.includes("mmd-recents"));
    const toggleIdx = order.findIndex((c) => c.includes("mmd-account-toggle"));
    // The recents block precedes the bottom-anchored account toggle.
    expect(recentsIdx).toBeGreaterThanOrEqual(0);
    expect(toggleIdx).toBeGreaterThan(recentsIdx);
  });
});
