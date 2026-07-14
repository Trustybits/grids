import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";

const holder = vi.hoisted(() => ({
  collection: { grids: [] as Array<Record<string, unknown>> },
  isOwner: true,
  canUseMobile2: true,
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
    canUseMobile2: holder.canUseMobile2,
    isMobile2Enabled: false,
    setMobile2Enabled: vi.fn(),
  }),
}));

vi.mock("@/stores/toast", () => ({
  useToastStore: () => ({ addToast: holder.addToast }),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({ signOut: holder.signOut }),
}));

vi.mock("@/utils/TimeConversion", () => ({
  valueToMillis: (v: unknown) => (typeof v === "number" ? v : 0),
}));

vi.mock("@/components/grid/GridStats.vue", () => ({
  default: { template: '<span data-test="grid-stats" />' },
}));

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
    holder.canUseMobile2 = true;
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
    expect(holder.fetchGrids).toHaveBeenCalled();
  });

  it("emits close when the backdrop is clicked", async () => {
    const wrapper = await mountDrawer(true);
    await wrapper.get(".mmd-backdrop").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("exposes the Mobile 2.0 opt-out toggle when eligible", async () => {
    const wrapper = await mountDrawer(true);
    expect(wrapper.find('[data-test="toggle"]').exists()).toBe(true);
  });

  it("hides the analytics section for non-owners", async () => {
    holder.isOwner = false;
    const wrapper = await mountDrawer(true);
    expect(wrapper.find('[data-test="grid-stats"]').exists()).toBe(false);
  });
});
