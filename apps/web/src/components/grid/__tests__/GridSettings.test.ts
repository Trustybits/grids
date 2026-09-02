import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, type Ref } from "vue";
import { mount } from "@vue/test-utils";

const h = vi.hoisted(() => ({
  saveBreakpoint: vi.fn(),
  resetBreakpoint: vi.fn(),
  requestDelete: vi.fn(),
  performDelete: vi.fn(async () => undefined),
  openOgStudio: vi.fn(),
  showDeleteModal: null as Ref<boolean> | null,
}));

vi.mock("@/composables/useGridSettings", async () => {
  const { ref } = await import("vue");
  return {
    useGridSettings: () => {
      const showDeleteModal = ref(false);
      h.showDeleteModal = showDeleteModal;
      return {
        isOwner: ref(true),
        isStaff: ref(false),
        gridPageId: ref("grid-1"),
        currentGridName: ref("Grid"),
        hasBackgroundImage: ref(false),
        hasBackgroundColor: ref(false),
        backgroundColor: ref(""),
        pendingTransfer: ref(undefined),
        isCancellingTransfer: ref(false),
        verticalCompact: ref(true),
        isDarkMode: ref(false),
        duplicatable: ref(false),
        hasOverride: ref(true),
        breakpointLabel: ref("Tablet"),
        showDeleteModal,
        showTransferModal: ref(false),
        showOgImageModal: ref(false),
        showOgStudio: ref(false),
        isEarlyAccessEnrolled: ref(false),
        copyGridLink: vi.fn(async () => undefined),
        duplicateGrid: vi.fn(async () => null),
        requestDelete: h.requestDelete,
        performDelete: h.performDelete,
        openTransferModal: vi.fn(),
        cancelPendingTransfer: vi.fn(async () => undefined),
        openOgImageModal: vi.fn(),
        openOgStudio: h.openOgStudio,
        closeOgStudio: vi.fn(),
        launchPixelRacers: vi.fn(),
        saveBreakpoint: h.saveBreakpoint,
        resetBreakpoint: h.resetBreakpoint,
        uploadBackgroundImage: vi.fn(async () => undefined),
        setBackgroundColor: vi.fn(),
        removeBackgroundImage: vi.fn(),
        removeBackgroundColor: vi.fn(),
      };
    },
  };
});

vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => ({ activeBreakpoint: "md" }),
}));
vi.mock("@/stores/grid/gridUi", () => ({
  useGridUiStore: () => ({
    showMetaData: false,
    showMetaDataVerbose: false,
    showGridGuide: true,
    setShowGridGuide: vi.fn(),
  }),
}));
vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({
    setShowMetaData: vi.fn(),
    setShowMetaDataVerbose: vi.fn(),
  }),
}));

const PassthroughStub = defineComponent({
  template: "<div><slot /><slot name='main' /><slot name='dropdown' /></div>",
});
const MenuItemStub = defineComponent({
  emits: ["click"],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
});
const PromptModalStub = defineComponent({
  props: { show: Boolean },
  emits: ["confirm", "close"],
  template:
    '<button v-if="show" data-testid="prompt-confirm" @click="$emit(\'confirm\')">Confirm delete</button>',
});

function findButton(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text().includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

async function mountOpenMenu() {
  const { default: GridSettings } = await import(
    "@/components/grid/GridSettings.vue"
  );
  const wrapper = mount(GridSettings, {
    global: {
      stubs: {
        FloatingTooltip: PassthroughStub,
        MenuSection: PassthroughStub,
        MenuItem: MenuItemStub,
        Toggle: true,
        Accordion: PassthroughStub,
        Divider: true,
        GridMenuIcon: true,
        SpinnerIcon: true,
        GhostSplitButton: PassthroughStub,
        ColorPicker: true,
        OgImageModal: true,
        OGStudio: true,
        LockIcon: true,
        TransferGridModal: true,
        PromptModal: PromptModalStub,
      },
    },
  });
  await wrapper.get(".grid-menu-button").trigger("click");
  return wrapper;
}

describe("GridSettings shared action wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requestDelete.mockImplementation(() => {
      if (h.showDeleteModal) h.showDeleteModal.value = true;
    });
    h.performDelete.mockImplementation(async () => {
      if (h.showDeleteModal) h.showDeleteModal.value = false;
    });
  });

  it("routes breakpoint update and reset through the shared settings composable", async () => {
    const wrapper = await mountOpenMenu();

    await findButton(wrapper, "Update Layout").trigger("click");
    expect(h.saveBreakpoint).toHaveBeenCalledOnce();

    await wrapper.get(".grid-menu-button").trigger("click");
    await findButton(wrapper, "Reset to Auto").trigger("click");
    expect(h.resetBreakpoint).toHaveBeenCalledOnce();
  });

  it("routes delete confirmation through the shared settings composable", async () => {
    const wrapper = await mountOpenMenu();

    await findButton(wrapper, "Delete Grid").trigger("click");
    expect(h.requestDelete).toHaveBeenCalledOnce();
    await wrapper.get('[data-testid="prompt-confirm"]').trigger("click");
    expect(h.performDelete).toHaveBeenCalledOnce();
  });

  it("routes openOgStudio through the shared settings composable when clicking OpenGraph Editor", async () => {
    const wrapper = await mountOpenMenu();

    await findButton(wrapper, "OpenGraph Editor").trigger("click");
    expect(h.openOgStudio).toHaveBeenCalledOnce();
  });
});
