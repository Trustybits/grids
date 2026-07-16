import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";

const h = vi.hoisted(() => ({
  canEdit: false,
  routerPush: vi.fn(),
  toast: vi.fn(),
  themeSet: vi.fn(),
  cancelTransfer: vi.fn(),
  controller: {
    canEditCurrentGrid: vi.fn(() => h.canEdit),
    hasBreakpointOverride: vi.fn(() => false),
    setVerticalCompact: vi.fn(),
    setGridTheme: vi.fn(),
    setDuplicatable: vi.fn(),
    saveBreakpointPositions: vi.fn(),
    resetBreakpoint: vi.fn(),
    duplicateGrid: vi.fn(),
    deleteGrid: vi.fn(),
    addBackgroundImage: vi.fn(),
    setBackgroundColor: vi.fn(),
    removeBackgroundImage: vi.fn(),
    removeBackgroundColor: vi.fn(),
    setShowMetaData: vi.fn(),
    setShowMetaDataVerbose: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: h.routerPush }),
}));
vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({ getCurrentUserId: () => "user-1" }),
}));
vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => ({
    currentGrid: {
      id: "grid-1",
      userId: "user-1",
      name: "Grid",
      verticalCompact: true,
      duplicatable: false,
    },
    isOwner: true,
    verticalCompact: true,
  }),
}));
vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => ({
    activeBreakpoint: "md",
    displayPositions: [{ i: "tile-1", x: 0, y: 0, w: 2, h: 2 }],
  }),
}));
vi.mock("@/stores/grid/gridUi", () => ({
  useGridUiStore: () => ({
    showMetaData: false,
    showMetaDataVerbose: false,
  }),
}));
vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => h.controller,
}));
vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ isDarkMode: false, setTheme: h.themeSet }),
}));
vi.mock("@/stores/toast", () => ({
  useToastStore: () => ({ addToast: h.toast }),
}));
vi.mock("@/stores/pixelRacers", () => ({
  usePixelRacersStore: () => ({ startGame: vi.fn() }),
}));
vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({ uploadFileToArchive: vi.fn() }),
}));
vi.mock("@/composables/useGridDuplicateStorage", () => ({
  useGridDuplicateStorage: () => ({ resolveStoragePlan: vi.fn() }),
}));
vi.mock("@/composables/useGridTransfers", () => ({
  useGridTransfers: () => ({
    pendingOutgoingForGrid: () => undefined,
    cancelTransfer: h.cancelTransfer,
  }),
}));

const PassthroughStub = defineComponent({
  template: "<div><slot /></div>",
});
const MenuItemStub = defineComponent({
  emits: ["click"],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
});
const ToggleStub = defineComponent({
  props: { label: String, modelValue: Boolean },
  emits: ["update:modelValue"],
  template:
    '<button type="button" @click="$emit(\'update:modelValue\', !modelValue)">{{ label }}</button>',
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
  const { default: GridSettings } = await import("@/components/grid/GridSettings.vue");
  const wrapper = mount(GridSettings, {
    global: {
      stubs: {
        FloatingTooltip: PassthroughStub,
        MenuSection: PassthroughStub,
        MenuItem: MenuItemStub,
        Toggle: ToggleStub,
        Accordion: PassthroughStub,
        Divider: true,
        GridMenuIcon: true,
        SpinnerIcon: true,
        GhostSplitButton: PassthroughStub,
        ColorPicker: true,
        OgImageModal: true,
        TransferGridModal: true,
        PromptModal: PromptModalStub,
        ResponsiveLayoutSettings: true,
      },
    },
  });
  await wrapper.get(".grid-menu-button").trigger("click");
  return wrapper;
}

describe("GridSettings preview mutation guards", () => {
  beforeEach(() => {
    h.canEdit = false;
    vi.clearAllMocks();
  });

  it("does not apply local theme state or report a blocked breakpoint save", async () => {
    const wrapper = await mountOpenMenu();

    await findButton(wrapper, "Dark Mode").trigger("click");
    await findButton(wrapper, "Save Tablet Layout").trigger("click");

    expect(h.themeSet).not.toHaveBeenCalled();
    expect(h.controller.setGridTheme).not.toHaveBeenCalled();
    expect(h.controller.saveBreakpointPositions).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalled();
  });

  it("does not navigate after deletion becomes blocked by preview", async () => {
    h.canEdit = true;
    const wrapper = await mountOpenMenu();
    await findButton(wrapper, "Delete Grid").trigger("click");
    expect(wrapper.find('[data-testid="prompt-confirm"]').exists()).toBe(true);

    h.canEdit = false;
    await wrapper.get('[data-testid="prompt-confirm"]').trigger("click");

    expect(h.controller.deleteGrid).not.toHaveBeenCalled();
    expect(h.routerPush).not.toHaveBeenCalled();
  });
});
