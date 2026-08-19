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
  activateImageBackground: vi.fn(),
  activateColorBackground: vi.fn(),
  activateDefaultBackground: vi.fn(),
  isOwner: true,
  isStaff: true,
  isDarkMode: false,
  hasBackgroundImage: false,
  hasBackgroundColor: false,
  backgroundImageSrc: "",
  // Which retained background source is active: 'image' | 'color' | 'default'.
  activeBg: "default" as "image" | "color" | "default",
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
    backgroundImageSrc: ref(gsHolder.backgroundImageSrc),
    isImageBackgroundActive: ref(gsHolder.activeBg === "image"),
    isColorBackgroundActive: ref(gsHolder.activeBg === "color"),
    isDefaultBackgroundActive: ref(gsHolder.activeBg === "default"),
    activateImageBackground: gsHolder.activateImageBackground,
    activateColorBackground: gsHolder.activateColorBackground,
    activateDefaultBackground: gsHolder.activateDefaultBackground,
    uploadBackgroundImage: gsHolder.uploadBackgroundImage,
    setBackgroundColor: gsHolder.setBackgroundColor,
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
        SpinnerIcon: true,
      },
    },
  });

const rowByText = (wrapper: ReturnType<typeof mountSheet>, text: string) =>
  wrapper.findAll(".mgs-row").find((row) => row.text().includes(text));

// A segment button inside the named `.mgs-segment` group (theme / background),
// found by its visible label. Throws if absent so callers get a definite handle.
const segButton = (
  wrapper: ReturnType<typeof mountSheet>,
  group: string,
  text: string,
) => {
  const btn = wrapper
    .findAll(`.mgs-segment[aria-label="${group}"] .mgs-segment__btn`)
    .find((candidate) => candidate.text() === text);
  if (!btn) throw new Error(`segment button not found: ${group} / ${text}`);
  return btn;
};

describe("MobileGridSettingsSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gsHolder.isOwner = true;
    gsHolder.isStaff = true;
    gsHolder.isDarkMode = false;
    gsHolder.hasBackgroundImage = false;
    gsHolder.hasBackgroundColor = false;
    gsHolder.backgroundImageSrc = "";
    gsHolder.activeBg = "default";
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
    expect(
      wrapper
        .get('.mgs-segment[aria-label="Grid theme"]')
        .findAll(".mgs-segment__btn"),
    ).toHaveLength(2);
    expect(
      wrapper
        .get('.mgs-segment[aria-label="Grid background"]')
        .findAll(".mgs-segment__btn"),
    ).toHaveLength(3);
  });

  it("marks the Light theme segment active when the grid is not dark", () => {
    const wrapper = mountSheet();
    expect(segButton(wrapper, "Grid theme", "Light").classes()).toContain(
      "is-active",
    );
    expect(
      segButton(wrapper, "Grid theme", "Dark").classes(),
    ).not.toContain("is-active");
  });

  it("marks the Default background segment active when no image or color is set", () => {
    const wrapper = mountSheet();
    expect(
      segButton(wrapper, "Grid background", "Default").classes(),
    ).toContain("is-active");
  });

  it("activates the default background without discarding image or color", async () => {
    gsHolder.hasBackgroundImage = true;
    gsHolder.hasBackgroundColor = true;
    gsHolder.activeBg = "color";
    const wrapper = mountSheet();
    await segButton(wrapper, "Grid background", "Default").trigger("click");
    expect(gsHolder.activateDefaultBackground).toHaveBeenCalledTimes(1);
  });

  it("marks the Image segment active when an image background is set", () => {
    gsHolder.hasBackgroundImage = true;
    gsHolder.activeBg = "image";
    const wrapper = mountSheet();
    expect(
      segButton(wrapper, "Grid background", "Image").classes(),
    ).toContain("is-active");
  });

  it("re-activates a retained image when its (inactive) segment is tapped", async () => {
    gsHolder.hasBackgroundImage = true;
    gsHolder.activeBg = "color";
    const wrapper = mountSheet();
    await segButton(wrapper, "Grid background", "Image").trigger("click");
    expect(gsHolder.activateImageBackground).toHaveBeenCalledTimes(1);
  });

  it("emits open-image when the active image segment is tapped again", async () => {
    gsHolder.hasBackgroundImage = true;
    gsHolder.activeBg = "image";
    const wrapper = mountSheet();
    await segButton(wrapper, "Grid background", "Image").trigger("click");
    expect(wrapper.emitted("open-image")).toHaveLength(1);
    expect(gsHolder.activateImageBackground).not.toHaveBeenCalled();
  });

  it("emits open-color when the color segment is tapped with no color yet", async () => {
    const wrapper = mountSheet();
    await segButton(wrapper, "Grid background", "Color").trigger("click");
    expect(wrapper.emitted("open-color")).toHaveLength(1);
  });

  it("re-activates a retained color when its (inactive) segment is tapped", async () => {
    gsHolder.hasBackgroundColor = true;
    gsHolder.activeBg = "image";
    const wrapper = mountSheet();
    await segButton(wrapper, "Grid background", "Color").trigger("click");
    expect(gsHolder.activateColorBackground).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("open-color")).toBeUndefined();
  });

  it("opens the /HEX picker when the active color segment is tapped again", async () => {
    gsHolder.hasBackgroundColor = true;
    gsHolder.activeBg = "color";
    const wrapper = mountSheet();
    await segButton(wrapper, "Grid background", "Color").trigger("click");
    expect(wrapper.emitted("open-color")).toHaveLength(1);
    expect(gsHolder.activateColorBackground).not.toHaveBeenCalled();
  });

  it("filters the rows live from the query prop", async () => {
    const wrapper = mountSheet();
    await wrapper.setProps({ query: "gravity" });

    expect(rowByText(wrapper, "Gravity")).toBeTruthy();
    expect(rowByText(wrapper, "Delete Grid")).toBeUndefined();
    // The theme/background segments are filtered out for an unrelated query.
    expect(
      wrapper.find('.mgs-segment[aria-label="Grid theme"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('.mgs-segment[aria-label="Grid background"]').exists(),
    ).toBe(false);
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
