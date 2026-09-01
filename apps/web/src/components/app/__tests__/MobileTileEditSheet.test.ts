import { beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { reactive, ref, shallowRef } from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";
import type { ToolbarButton, ToolbarContext } from "@/types/TileToolbar";
import MobileTileEditSheet from "../MobileTileEditSheet.vue";

const IconStub = { template: "<span class='icon' />" };

const actions = vi.hoisted(() => ({
  bold: vi.fn(),
  border: vi.fn(),
  resize: vi.fn(),
  duplicate: vi.fn(),
  copyToClipboard: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  toggleBold: vi.fn(),
  handleFontChange: vi.fn(),
  handleFontSizeChange: vi.fn(),
  handleTextAlignChange: vi.fn(),
}));

const capabilities = vi.hoisted(() => ({
  hasLink: false,
  hasCopyable: false,
  hasDownload: false,
}));

const gridView = reactive({ canEdit: true, displayPositions: [] as unknown[] });

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => gridView,
}));

// The live text component the tile exposes; bold/italic/font controls act
// through it rather than writing content directly.
const childComponent = ref<Record<string, unknown> | null>({
  isBoldActive: false,
  toggleBold: actions.toggleBold,
  getCurrentFont: () => "Inter",
  getCurrentFontSize: () => "Medium",
  handleFontChange: actions.handleFontChange,
  handleFontSizeChange: actions.handleFontSizeChange,
  handleTextAlignChange: actions.handleTextAlignChange,
});

const query = ref("");
// Shallow, like the composable: the handle is a bag of the tile's own refs, and
// a deep ref would unwrap them and break the link back to the tile.
const handle = shallowRef<Record<string, unknown> | null>(null);

vi.mock("@/composables/useMobileTileEdit", () => ({
  useMobileTileEdit: () => ({ query, handle }),
}));

vi.mock("@/composables/useTileActions", () => ({
  useTileActions: () => ({
    resolvedTileUrl: ref("https://example.com/"),
    hasLink: ref(capabilities.hasLink),
    hasCopyable: ref(capabilities.hasCopyable),
    hasDownload: ref(capabilities.hasDownload),
    duplicate: actions.duplicate,
    copyToClipboard: actions.copyToClipboard,
    download: actions.download,
  }),
}));

vi.mock("@/registries/tileRegistry", () => ({
  getTileDefinition: () => ({
    label: "Text",
    actions: { copyContent: (content: { text?: string }) => content.text ?? "" },
  }),
}));

// A trimmed stand-in for the real text tile's toolbar: one resize preset, a
// border toggle, and the overflow menu the sheet flattens.
const TOOLBAR: ToolbarButton[] = [
  {
    id: "resize-2x2",
    icon: IconStub,
    title: "Resize to 2 by 2",
    group: "resize",
    isActive: () => true,
    action: actions.resize,
  },
  {
    id: "border-toggle",
    icon: IconStub,
    title: "Toggle border",
    group: "appearance",
    isActive: (ctx: ToolbarContext) => ctx.tile.borderEnabled !== false,
    action: actions.border,
  },
  {
    id: "text-align",
    icon: IconStub,
    title: "Text align",
    group: "appearance",
    action: vi.fn(),
  },
  {
    id: "more-menu",
    icon: IconStub,
    title: "More",
    group: "actions",
    action: vi.fn(),
    menuItems: [
      { id: "font-family", tooltip: "Change Font", action: vi.fn() },
      { id: "font-size", tooltip: "Change Font Size", action: vi.fn() },
      { id: "bold-toggle", icon: IconStub, tooltip: "Bold", action: actions.bold },
      {
        id: "tile-link",
        icon: IconStub,
        tooltip: "Add a Link",
        action: vi.fn(),
      },
    ],
  },
];

vi.mock("@/registries/tileToolbar", () => ({
  getTileToolbarButtons: () => TOOLBAR,
}));

function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: "",
    content: { type: ContentType.TEXT, text: "Hello there" },
    ...overrides,
  } as Tile;
}

const mountSheet = (tile: Tile = makeTile()) =>
  mount(MobileTileEditSheet, { props: { tile } });

/** Visible section headings, in order. */
const sections = (wrapper: ReturnType<typeof mountSheet>) =>
  wrapper.findAll(".mte-section__label").map((node) => node.text());

/** Registry-driven and built-in rows alike, by their visible label. */
const rows = (wrapper: ReturnType<typeof mountSheet>) =>
  wrapper.findAll(".mte-row__label").map((node) => node.text());

enableAutoUnmount(afterEach);

describe("MobileTileEditSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.value = "";
    gridView.canEdit = true;
    gridView.displayPositions = [];
    capabilities.hasLink = false;
    capabilities.hasCopyable = false;
    capabilities.hasDownload = false;
    childComponent.value = {
      isBoldActive: false,
      toggleBold: actions.toggleBold,
      getCurrentFont: () => "Inter",
      getCurrentFontSize: () => "Medium",
      handleFontChange: actions.handleFontChange,
      handleFontSizeChange: actions.handleFontSizeChange,
      handleTextAlignChange: actions.handleTextAlignChange,
    };
    handle.value = {
      childComponent,
      isEditing: ref(false),
      isExitingCropMode: ref(false),
      resizeTile: actions.resize,
      remove: actions.remove,
    };
  });

  it("groups registry buttons under the sheet's headings", () => {
    const wrapper = mountSheet();

    expect(sections(wrapper)).toEqual([
      "SIZE",
      "APPEARANCE",
      "TEXT",
      "LINK",
      "ACTIONS",
    ]);
  });

  it("names every row, including ones that are tooltip-only on desktop", () => {
    const wrapper = mountSheet();

    // "Bold" comes from a menu item that carries no label at all on desktop.
    expect(rows(wrapper)).toContain("Bold");
    expect(rows(wrapper)).toContain("Add a Link");
  });

  it("renders resize presets as pressable buttons reflecting the active one", () => {
    const wrapper = mountSheet();
    const preset = wrapper.get(".mte-preset");

    expect(preset.attributes("aria-label")).toBe("Resize to 2 by 2");
    expect(preset.attributes("aria-pressed")).toBe("true");
  });

  it("runs a registry action through the tile's context", async () => {
    const wrapper = mountSheet();
    await wrapper.get(".mte-preset").trigger("click");

    expect(actions.resize).toHaveBeenCalledTimes(1);
    // The context handed to the action carries the tile and the tile's own
    // Griddle-routed resize, not a detached copy.
    const ctx = actions.resize.mock.calls[0]![0] as ToolbarContext;
    expect(ctx.tile.i).toBe("tile-1");
    expect(ctx.resizeTile).toBe(actions.resize);
  });

  it("refuses registry actions on a read-only grid", async () => {
    gridView.canEdit = false;
    const wrapper = mountSheet();
    await wrapper.get(".mte-preset").trigger("click");

    expect(actions.resize).not.toHaveBeenCalled();
  });

  it("shows the border toggle's on state", () => {
    const wrapper = mountSheet();
    const border = wrapper
      .findAll("button.mte-row")
      .find((node) => node.text().includes("Toggle border"))!;

    expect(border.attributes("aria-pressed")).toBe("true");
    expect(border.text()).toContain("On");
  });

  it("routes the inline text controls through the tile's content component", async () => {
    const wrapper = mountSheet();

    await wrapper.get('[aria-label="Align center"]').trigger("click");
    expect(actions.handleTextAlignChange).toHaveBeenCalledWith("center");

    const fonts = wrapper.findAll(".mte-chip");
    expect(fonts[0]!.attributes("aria-pressed")).toBe("true");
    await fonts[1]!.trigger("click");
    expect(actions.handleFontChange).toHaveBeenCalledTimes(1);

    const sizes = wrapper.findAll(".mte-segment--text");
    await sizes[0]!.trigger("click");
    expect(actions.handleFontSizeChange).toHaveBeenCalledWith("Small");
  });

  it("offers only the tile actions the tile actually supports", async () => {
    const wrapper = mountSheet();
    expect(rows(wrapper)).toEqual(
      expect.arrayContaining(["Duplicate tile", "Delete tile"]),
    );
    expect(rows(wrapper)).not.toContain("Follow link");
    expect(rows(wrapper)).not.toContain("Copy to clipboard");
    expect(rows(wrapper)).not.toContain("Download");

    capabilities.hasLink = true;
    capabilities.hasCopyable = true;
    capabilities.hasDownload = true;
    const withAll = mountSheet();

    expect(rows(withAll)).toEqual(
      expect.arrayContaining(["Follow link", "Copy to clipboard", "Download"]),
    );
    expect(withAll.get("a.mte-row").attributes("href")).toBe(
      "https://example.com/",
    );
  });

  it("deletes through the tile so its exit animation still plays", async () => {
    const wrapper = mountSheet();
    const remove = wrapper
      .findAll("button.mte-row")
      .find((node) => node.text().includes("Delete tile"))!;
    await remove.trigger("click");

    expect(actions.remove).toHaveBeenCalledTimes(1);
  });

  it("narrows to matching rows as the /EDIT input is typed into", async () => {
    const wrapper = mountSheet();
    query.value = "bold";
    await wrapper.vm.$nextTick();

    expect(sections(wrapper)).toEqual(["TEXT"]);
    expect(rows(wrapper)).toEqual(["Bold"]);
  });

  it("matches an inline control on the word it shows, not its registry id", async () => {
    const wrapper = mountSheet();
    // "align" is nowhere in the row's label ("Text align" is the desktop title
    // for a panel opener); the sheet's own control is what has to be findable.
    query.value = "align";
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[aria-label="Text alignment"]').exists()).toBe(true);
  });

  it("says so when nothing matches", async () => {
    const wrapper = mountSheet();
    query.value = "zzzz";
    await wrapper.vm.$nextTick();

    expect(sections(wrapper)).toEqual([]);
    expect(wrapper.get(".mte-empty").text()).toContain("zzzz");
  });

  it("previews the footprint as rendered at the active breakpoint", async () => {
    // resizeTile writes a per-breakpoint override without touching tile.w/h,
    // so the base size would describe the desktop layout instead.
    gridView.displayPositions = [{ i: "tile-1", x: 0, y: 0, w: 4, h: 1 }];
    const wrapper = mountSheet();

    expect(wrapper.get(".mte-header__value").text()).toBe("4×1");
    expect(wrapper.get(".mte-preview__tile").attributes("style")).toContain(
      "aspect-ratio: 4 / 1",
    );
  });

  it("previews the tile's own text without mounting its content component", () => {
    const wrapper = mountSheet();

    expect(wrapper.get(".mte-preview__text").text()).toBe("Hello there");
    expect(wrapper.get(".mte-preview").attributes("aria-hidden")).toBe("true");
  });

  it("renders nothing from the registry once the tile deregisters", async () => {
    const wrapper = mountSheet();
    handle.value = null;
    await wrapper.vm.$nextTick();

    // Only the built-in action rows are left; nothing throws on the way there.
    expect(sections(wrapper)).toEqual(["ACTIONS"]);
    expect(rows(wrapper)).toEqual(["Duplicate tile", "Delete tile"]);
  });
});
