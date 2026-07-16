import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import MobileGridSettingsSheet from "../MobileGridSettingsSheet.vue";

const gsHolder = vi.hoisted(() => ({
  refreshDefaultGrid: vi.fn(async () => undefined),
  toggleDefaultGrid: vi.fn(async () => undefined),
  copyGridLink: vi.fn(async () => undefined),
  duplicateGrid: vi.fn(async () => "new-grid" as string | null),
  requestDelete: vi.fn(),
  performDelete: vi.fn(async () => undefined),
  openTransferModal: vi.fn(),
  cancelPendingTransfer: vi.fn(async () => undefined),
  launchPixelRacers: vi.fn(),
  uploadBackgroundImage: vi.fn(async () => undefined),
  setBackgroundColor: vi.fn(),
  removeBackgroundImage: vi.fn(),
  removeBackgroundColor: vi.fn(),
  isOwner: true,
  isStaff: true,
  isDarkMode: false,
  hasBackgroundImage: false,
  hasBackgroundColor: false,
  pendingTransfer: undefined as unknown,
}));

vi.mock("@/composables/useGridSettings", () => ({
  useGridSettings: () => ({
    isOwner: ref(gsHolder.isOwner),
    isStaff: ref(gsHolder.isStaff),
    gridPageId: ref("grid-1"),
    currentGridName: ref("My Grid"),
    pendingTransfer: ref(gsHolder.pendingTransfer),
    isCancellingTransfer: ref(false),
    verticalCompact: ref(false),
    isDarkMode: ref(gsHolder.isDarkMode),
    duplicatable: ref(false),
    showMetaData: ref(false),
    showMetaDataVerbose: ref(false),
    isDefaultGrid: ref(false),
    refreshDefaultGrid: gsHolder.refreshDefaultGrid,
    toggleDefaultGrid: gsHolder.toggleDefaultGrid,
    hasBackgroundImage: ref(gsHolder.hasBackgroundImage),
    hasBackgroundColor: ref(gsHolder.hasBackgroundColor),
    backgroundColor: ref(""),
    uploadBackgroundImage: gsHolder.uploadBackgroundImage,
    setBackgroundColor: gsHolder.setBackgroundColor,
    removeBackgroundImage: gsHolder.removeBackgroundImage,
    removeBackgroundColor: gsHolder.removeBackgroundColor,
    showDeleteModal: ref(false),
    showTransferModal: ref(false),
    copyGridLink: gsHolder.copyGridLink,
    duplicateGrid: gsHolder.duplicateGrid,
    requestDelete: gsHolder.requestDelete,
    performDelete: gsHolder.performDelete,
    openTransferModal: gsHolder.openTransferModal,
    cancelPendingTransfer: gsHolder.cancelPendingTransfer,
    launchPixelRacers: gsHolder.launchPixelRacers,
  }),
}));

const ToggleStub = {
  props: ["label", "modelValue"],
  emits: ["update:modelValue"],
  template: "<div class='toggle-stub'>{{ label }}</div>",
};

const mountSheet = (query = "") =>
  mount(MobileGridSettingsSheet, {
    props: { query },
    global: {
      stubs: {
        Toggle: ToggleStub,
        PromptModal: true,
        TransferGridModal: true,
        ClipboardIcon: true,
        ChevronRightIcon: true,
        ImageIcon: true,
        SpinnerIcon: true,
      },
    },
  });

const rowByText = (wrapper: ReturnType<typeof mountSheet>, text: string) =>
  wrapper.findAll(".mgs-row").find((row) => row.text().includes(text));

describe("MobileGridSettingsSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gsHolder.isOwner = true;
    gsHolder.isStaff = true;
    gsHolder.isDarkMode = false;
    gsHolder.hasBackgroundImage = false;
    gsHolder.hasBackgroundColor = false;
    gsHolder.pendingTransfer = undefined;
  });

  it("renders the GRID ID header and the core settings rows", () => {
    const wrapper = mountSheet();
    expect(wrapper.find(".mgs-header").text()).toContain("grid-1");
    for (const label of [
      "Gravity",
      "Default Grid",
      "Publish Template",
      "Duplicate Grid",
      "Transfer Grid",
      "Delete Grid",
    ]) {
      expect(rowByText(wrapper, label)).toBeTruthy();
    }
  });

  it("renders the GRID THEME and GRID BACKGROUND sections", () => {
    const wrapper = mountSheet();
    const labels = wrapper.findAll(".mgs-section__label").map((n) => n.text());
    expect(labels).toContain("GRID THEME");
    expect(labels).toContain("GRID BACKGROUND");
    expect(wrapper.findAll(".mgs-theme-card")).toHaveLength(2);
    expect(wrapper.findAll(".mgs-bg-tile")).toHaveLength(3);
  });

  it("marks the light theme card selected when the grid is not dark", () => {
    const wrapper = mountSheet();
    expect(
      wrapper.find(".mgs-theme-card--light").classes(),
    ).toContain("is-selected");
    expect(
      wrapper.find(".mgs-theme-card--dark").classes(),
    ).not.toContain("is-selected");
  });

  it("selects the Default background tile when no image or color is set", () => {
    const wrapper = mountSheet();
    expect(
      wrapper.find(".mgs-bg-tile--default").classes(),
    ).toContain("is-selected");
  });

  it("resets to the default background, clearing image and color", async () => {
    gsHolder.hasBackgroundImage = true;
    gsHolder.hasBackgroundColor = true;
    const wrapper = mountSheet();
    await wrapper.get(".mgs-bg-tile--default").trigger("click");
    expect(gsHolder.removeBackgroundImage).toHaveBeenCalledTimes(1);
    expect(gsHolder.removeBackgroundColor).toHaveBeenCalledTimes(1);
  });

  it("emits open-color when the color tile is tapped (bar owns the /HEX picker)", async () => {
    const wrapper = mountSheet();
    await wrapper.get(".mgs-bg-tile--color").trigger("click");
    expect(wrapper.emitted("open-color")).toHaveLength(1);
  });

  it("filters the rows live from the query prop", async () => {
    const wrapper = mountSheet();
    await wrapper.setProps({ query: "gravity" });

    expect(rowByText(wrapper, "Gravity")).toBeTruthy();
    expect(rowByText(wrapper, "Delete Grid")).toBeUndefined();
    // The theme/background sections are filtered out for an unrelated query.
    expect(wrapper.find(".mgs-theme").exists()).toBe(false);
    expect(wrapper.find(".mgs-bg").exists()).toBe(false);
    // The GRID ID header is fixed — never filtered out.
    expect(wrapper.find(".mgs-header").exists()).toBe(true);
  });

  it("copies the link and closes when the copy button is tapped", async () => {
    const wrapper = mountSheet();
    await wrapper.get(".mgs-copy").trigger("click");
    expect(gsHolder.copyGridLink).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("duplicates (full) and closes on success", async () => {
    const wrapper = mountSheet();
    await rowByText(wrapper, "Duplicate Grid")?.trigger("click");
    expect(gsHolder.duplicateGrid).toHaveBeenCalledWith("full");
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("requests delete (opening the confirm modal) when Delete Grid is tapped", async () => {
    const wrapper = mountSheet();
    await rowByText(wrapper, "Delete Grid")?.trigger("click");
    expect(gsHolder.requestDelete).toHaveBeenCalledTimes(1);
  });

  it("opens the transfer modal when Transfer Grid is tapped", async () => {
    const wrapper = mountSheet();
    await rowByText(wrapper, "Transfer Grid")?.trigger("click");
    expect(gsHolder.openTransferModal).toHaveBeenCalledTimes(1);
  });

  it("keeps the staff debug tools collapsed by default and reveals them on tap", async () => {
    const wrapper = mountSheet();
    // The Debug header is present (staff), but its tools are hidden until expanded.
    expect(rowByText(wrapper, "Debug")).toBeTruthy();
    expect(rowByText(wrapper, "Metadata")).toBeUndefined();

    await rowByText(wrapper, "Debug")?.trigger("click");
    expect(rowByText(wrapper, "Metadata")).toBeTruthy();
    expect(rowByText(wrapper, "Verbose Metadata")).toBeTruthy();
  });

  it("auto-expands the debug tools while a query is active", () => {
    const wrapper = mountSheet("metadata");
    expect(rowByText(wrapper, "Verbose Metadata")).toBeTruthy();
  });

  it("hides the entire Debug section from non-staff", () => {
    gsHolder.isStaff = false;
    const wrapper = mountSheet();
    expect(rowByText(wrapper, "Debug")).toBeUndefined();
    expect(rowByText(wrapper, "Metadata")).toBeUndefined();
  });

  it("never surfaces Pixel Racers on mobile (desktop-only easter egg)", async () => {
    const wrapper = mountSheet();
    await rowByText(wrapper, "Debug")?.trigger("click");
    expect(rowByText(wrapper, "Pixel Racers")).toBeUndefined();
  });

  it("refreshes the default-grid flag on mount", () => {
    mountSheet();
    expect(gsHolder.refreshDefaultGrid).toHaveBeenCalledTimes(1);
  });

  it("hides owner-only rows for non-owners but keeps the GRID ID header", () => {
    gsHolder.isOwner = false;
    const wrapper = mountSheet();
    expect(wrapper.find(".mgs-header").text()).toContain("grid-1");
    expect(rowByText(wrapper, "Delete Grid")).toBeUndefined();
  });
});
