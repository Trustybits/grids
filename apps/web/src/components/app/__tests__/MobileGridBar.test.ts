import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { ref } from "vue";
import { ContentType } from "@grids/contracts/types";

const Icon = { template: "<span class='icon' />" };

// Module scope rather than `vi.hoisted`, because `ref` is not available that
// early. The mock factory below only runs when the component is imported inside
// a test, by which point this is initialized.
const isPreviewActive = ref(false);

const holder = vi.hoisted(() => ({
  createTile: vi.fn(() => "tile-1"),
  submitCommand: vi.fn(async () => null),
  uploadFileOptimistic: vi.fn(),
  uploadDocumentsOptimistic: vi.fn(),
  addToast: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
  setBackgroundColor: vi.fn(),
  previewBackgroundColor: vi.fn(),
  linkBackgroundImage: vi.fn(),
  loadSavedColors: vi.fn(async () => undefined),
  addSavedColor: vi.fn(async () => undefined),
  enterPreview: vi.fn(),
  closeEdit: vi.fn(),
  types: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/composables/useTileCreation", () => ({
  useTileCreation: () => ({
    tileTypes: { value: holder.types },
    filterTileTypes: () => holder.types,
    matchCommandPrefix: (text: string) => {
      const parts = /^(\S+)\s+([\s\S]*)$/.exec(text);
      if (!parts) return null;
      const token = parts[1].toLowerCase();
      const descriptor = holder.types.find(
        (type) =>
          type.kind === "command" &&
          (type.id === token || String(type.label).toLowerCase() === token),
      );
      return descriptor ? { type: descriptor.id, rest: parts[2] } : null;
    },
    createTile: holder.createTile,
    submitCommand: holder.submitCommand,
  }),
}));

vi.mock("@/composables/useFileUpload", () => ({
  useFileUpload: () => ({
    uploadFileOptimistic: holder.uploadFileOptimistic,
    uploadDocumentsOptimistic: holder.uploadDocumentsOptimistic,
  }),
}));

vi.mock("@/stores/toast", () => ({
  useToastStore: () => ({ addToast: holder.addToast }),
}));

vi.mock("@/composables/useGridSettings", () => ({
  useGridSettings: () => ({
    backgroundColor: { value: "" },
    setBackgroundColor: holder.setBackgroundColor,
    previewBackgroundColor: holder.previewBackgroundColor,
    linkBackgroundImage: holder.linkBackgroundImage,
  }),
}));

vi.mock("@/composables/useSavedColors", () => ({
  useSavedColors: () => ({
    savedColors: { value: [] as string[] },
    load: holder.loadSavedColors,
    addColor: holder.addSavedColor,
  }),
}));

vi.mock("@/components/app/MobileGridSettingsSheet.vue", () => ({
  default: {
    props: ["query"],
    emits: ["close", "open-color", "open-image"],
    template:
      "<div class='grid-settings-sheet-stub' :data-query='query'>" +
      "<button class='open-color-stub' @click=\"$emit('open-color')\" />" +
      "<button class='open-image-stub' @click=\"$emit('open-image')\" /></div>",
  },
}));

vi.mock("@/components/app/MobileColorPicker.vue", () => ({
  default: {
    name: "MobileColorPicker",
    props: ["modelValue", "swatches"],
    emits: ["update:modelValue", "preview", "commit"],
    template:
      "<div class='color-picker-stub' :data-swatches='swatches.length' />",
  },
}));

vi.mock("@/components/app/MobileImageSwapSheet.vue", () => ({
  default: {
    name: "MobileImageSwapSheet",
    template: "<div class='image-swap-stub' />",
  },
}));

vi.mock("@/composables/useGridPreview", () => ({
  useGridPreview: () => ({
    isPreviewActive,
    enterPreview: holder.enterPreview,
  }),
}));

// Tile editing is entered from a tile, not from this bar, so the bar's side is
// driven here by moving the edit target the way an activated tile would.
const editTileId = ref<string | null>(null);
const editTile = ref<Record<string, unknown> | null>(null);
const editQuery = ref("");

vi.mock("@/composables/useMobileTileEdit", () => ({
  useMobileTileEdit: () => ({
    editTileId,
    editTile,
    closeEdit: holder.closeEdit,
    query: editQuery,
  }),
}));

vi.mock("@/components/app/MobileTileEditSheet.vue", () => ({
  default: {
    name: "MobileTileEditSheet",
    props: ["tile"],
    template: "<div class='tile-edit-stub' :data-tile='tile.i' />",
  },
}));

const mountBar = async () => {
  const { default: MobileGridBar } = await import("../MobileGridBar.vue");
  return mount(MobileGridBar, { attachTo: document.body });
};

const flush = async (wrapper: { vm: { $nextTick: () => Promise<unknown> } }) => {
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
};

/**
 * Carousel cards carry no visible name — the command chip is what names the
 * centered type — so they are located by their accessible label.
 */
const cardNamed = (
  wrapper: Awaited<ReturnType<typeof mountBar>>,
  name: string,
) =>
  wrapper
    .findAll(".tile-carousel__card")
    .find((card) => card.attributes("aria-label") === name);

// The bar keeps document-level Escape and tap-outside listeners while mounted,
// so wrappers left behind would keep answering later tests' events.
enableAutoUnmount(afterEach);

describe("MobileGridBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPreviewActive.value = false;
    editTileId.value = null;
    editTile.value = null;
    editQuery.value = "";
    holder.types = [
      {
        id: "chat",
        label: "Chat",
        icon: Icon,
        keywords: ["chat"],
        kind: "create",
        contentType: ContentType.CHAT,
      },
      { id: "link", label: "Link", icon: Icon, keywords: ["link"], kind: "command" },
      {
        id: "map",
        label: "Map",
        icon: Icon,
        keywords: ["map"],
        kind: "command",
        contentType: ContentType.MAP,
      },
    ];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: holder.writeText },
      configurable: true,
    });
  });

  it("shows the four default commands", async () => {
    const wrapper = await mountBar();
    expect(wrapper.find('[aria-label="Add a tile"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Grid settings"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Preview"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Share"]').exists()).toBe(true);
  });

  it("enters preview when Preview is tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Preview"]').trigger("click");
    expect(holder.enterPreview).toHaveBeenCalledTimes(1);
  });

  it("slides out of view while previewing", async () => {
    const wrapper = await mountBar();
    expect(wrapper.classes()).not.toContain("mgb--preview");

    isPreviewActive.value = true;
    await flush(wrapper);

    expect(wrapper.classes()).toContain("mgb--preview");
  });

  it("collapses an open sheet when preview starts", async () => {
    // The bar slides away either way, but a sheet left open would still be open
    // when preview closes and the bar slides back up.
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(true);

    isPreviewActive.value = true;
    await flush(wrapper);

    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(false);
  });

  it("morphs into settings mode (/GRID input + rising sheet) when Grid settings is tapped", async () => {
    const wrapper = await mountBar();
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(false);

    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);

    // The sheet rises and the pill morphs into the /GRID command input,
    // mirroring the Add-a-tile pattern.
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(true);
    expect(wrapper.get(".mci-chip").text()).toBe("/GRID");
    expect(wrapper.find('[aria-label="Close grid settings"]').exists()).toBe(true);
    // Default commands are hidden while settings is open.
    expect(wrapper.find('[aria-label="Share"]').exists()).toBe(false);
  });

  it("closes settings mode via the far-right close button", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);

    await wrapper.get('[aria-label="Close grid settings"]').trigger("click");
    await flush(wrapper);

    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(false);
    expect(wrapper.find('[aria-label="Grid settings"]').exists()).toBe(true);
  });

  it("morphs into add mode when Add a tile is tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    expect(wrapper.find('[aria-label="Close add a tile"]').exists()).toBe(true);
    expect(wrapper.find(".mci").exists()).toBe(true);
    expect(wrapper.find(".tile-carousel").exists()).toBe(true);
    expect(wrapper.find('[aria-label="Share"]').exists()).toBe(false);
  });

  it("creates a tile and closes when a create-type card is tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    await wrapper.get(".tile-carousel__card").trigger("click");
    await flush(wrapper);

    expect(holder.createTile).toHaveBeenCalledWith(ContentType.CHAT);
    expect(wrapper.find('[aria-label="Add a tile"]').exists()).toBe(true);
  });

  it("keeps a static /TILE chip and closes via the far-right close button", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/TILE");

    await wrapper.get('[aria-label="Close add a tile"]').trigger("click");
    await flush(wrapper);
    expect(wrapper.find('[aria-label="Add a tile"]').exists()).toBe(true);
    expect(wrapper.find(".mci").exists()).toBe(false);
  });

  it("pins the type in the chip and submits the location after tapping Map", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/TILE");

    await cardNamed(wrapper, "Map")?.trigger("click");
    await flush(wrapper);
    // The Map card focuses the input rather than creating immediately, and the
    // chip prefix now reflects the pinned type.
    expect(holder.createTile).not.toHaveBeenCalled();
    expect(wrapper.get(".mci-chip").text()).toBe("/MAP");

    const input = wrapper.get(".mci-input");
    await input.setValue("Paris");
    await input.trigger("keydown", { key: "Enter" });
    await flush(wrapper);

    // Creation is routed through the composable with the pinned type.
    expect(holder.submitCommand).toHaveBeenCalledWith("Paris", "map");
  });

  it("keeps the type pinned when the centered card is tapped again", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    // First tap brings Map to the center, which pins it.
    await cardNamed(wrapper, "Map")?.trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/MAP");

    // A second tap commits the centered card rather than toggling it off — the
    // chip now tracks the center, so there is no un-centered state to fall to.
    await cardNamed(wrapper, "Map")?.trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/MAP");
    expect(holder.createTile).not.toHaveBeenCalled();
  });

  it("tracks the centered card in the chip as the carousel moves", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/TILE");

    // Moving one card along lands on Link, and the chip follows the center.
    await wrapper.get(".tile-carousel__track").trigger("keydown", {
      key: "ArrowRight",
    });
    await flush(wrapper);

    expect(wrapper.get(".mci-chip").text()).toBe("/LINK");
    expect(
      wrapper.get(".tile-carousel__card--selected").attributes("aria-label"),
    ).toBe("Link");
  });

  it("prompts to press enter for a centered create-type card, and adds it", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    // Chat is centered on open but not yet pinned, so step away and back.
    const track = wrapper.get(".tile-carousel__track");
    await track.trigger("keydown", { key: "ArrowRight" });
    await track.trigger("keydown", { key: "ArrowLeft" });
    await flush(wrapper);

    expect(wrapper.get(".mci-chip").text()).toBe("/CHAT");
    const input = wrapper.get(".mci-input");
    expect(input.attributes("placeholder")).toBe("Press enter to add a Chat tile");

    await input.trigger("keydown", { key: "Enter" });
    await flush(wrapper);
    expect(holder.submitCommand).toHaveBeenCalledWith("", "chat");
  });

  it("keeps the carousel unfiltered with the type highlighted after selecting a command card", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    await cardNamed(wrapper, "Map")?.trigger("click");
    await flush(wrapper);

    const input = wrapper.get(".mci-input");
    await input.setValue("something that matches nothing");
    await flush(wrapper);

    const cards = wrapper.findAll(".tile-carousel__card");
    expect(cards).toHaveLength(holder.types.length);
    const selected = wrapper.find(".tile-carousel__card--selected");
    expect(selected.exists()).toBe(true);
    expect(selected.attributes("aria-label")).toBe("Map");
  });

  it("pins the type from an inline prefix: typing 'map ' becomes /MAP with the rest as content", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    const input = wrapper.get(".mci-input");
    await input.setValue("map japan");
    await flush(wrapper);

    // The prefix is consumed: chip pins to /MAP and only the content remains.
    expect(wrapper.get(".mci-chip").text()).toBe("/MAP");
    expect((input.element as HTMLInputElement).value).toBe("japan");

    await input.trigger("keydown", { key: "Enter" });
    await flush(wrapper);
    expect(holder.submitCommand).toHaveBeenCalledWith("japan", "map");
  });

  it("un-pins the type (chip → /TILE) after two backspaces on an empty field", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    await cardNamed(wrapper, "Map")?.trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/MAP");

    const input = wrapper.get(".mci-input");
    await input.trigger("keydown", { key: "Backspace" });
    await input.trigger("keydown", { key: "Backspace" });
    await flush(wrapper);

    // Still in add mode, but the type is cleared back to the generic chip.
    expect(wrapper.find(".mci").exists()).toBe(true);
    expect(wrapper.get(".mci-chip").text()).toBe("/TILE");
    expect(wrapper.find(".tile-carousel__card--selected").exists()).toBe(false);
  });

  it("morphs into /HEX color mode when the settings sheet requests it, and closes back to settings", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);

    // The settings sheet's color tile asks the bar to open the color picker.
    await wrapper.get(".open-color-stub").trigger("click");
    await flush(wrapper);

    expect(wrapper.find(".color-picker-stub").exists()).toBe(true);
    expect(wrapper.get(".mgb-hex__chip").text()).toBe("/HEX");
    expect(wrapper.find('[aria-label="Save color"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Close color picker"]').exists()).toBe(true);
    // The settings sheet is replaced by the color sheet while picking.
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(false);

    // Closing the color picker returns to the Grid Settings sheet (one level up).
    await wrapper.get('[aria-label="Close color picker"]').trigger("click");
    await flush(wrapper);
    expect(wrapper.find(".color-picker-stub").exists()).toBe(false);
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(true);
  });

  it("saves the working color via the Add button", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);
    await wrapper.get(".open-color-stub").trigger("click");
    await flush(wrapper);

    await wrapper.get('[aria-label="Save color"]').trigger("click");
    await flush(wrapper);
    expect(holder.addSavedColor).toHaveBeenCalledTimes(1);
  });

  it("applies color live while dragging and commits once on release", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);
    await wrapper.get(".open-color-stub").trigger("click");
    await flush(wrapper);

    const picker = wrapper.findComponent({ name: "MobileColorPicker" });
    // Dragging emits preview repeatedly — the grid updates live (history-free).
    picker.vm.$emit("preview", "#123456");
    picker.vm.$emit("preview", "#654321");
    await flush(wrapper);
    expect(holder.previewBackgroundColor).toHaveBeenCalledWith("#123456");
    expect(holder.previewBackgroundColor).toHaveBeenCalledWith("#654321");
    // No committed change yet.
    expect(holder.setBackgroundColor).not.toHaveBeenCalled();

    // Pointer-up commits exactly one history entry.
    picker.vm.$emit("commit", "#654321");
    await flush(wrapper);
    expect(holder.setBackgroundColor).toHaveBeenCalledTimes(1);
    expect(holder.setBackgroundColor).toHaveBeenCalledWith("#654321");
  });

  it("commits a typed hex to the grid background on Enter", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);
    await wrapper.get(".open-color-stub").trigger("click");
    await flush(wrapper);

    const input = wrapper.get(".mgb-hex__input");
    await input.setValue("00ff00");
    await input.trigger("keydown", { key: "Enter" });
    await flush(wrapper);

    expect(holder.setBackgroundColor).toHaveBeenCalledWith("#00FF00");
  });

  it("steps back up to /GRID after two Backspaces on an empty hex field", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);
    await wrapper.get(".open-color-stub").trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mgb-hex__chip").text()).toBe("/HEX");

    const input = wrapper.get(".mgb-hex__input");
    // Clear the field, then a single empty Backspace should NOT step up yet.
    await input.setValue("");
    await input.trigger("keydown", { key: "Backspace" });
    await flush(wrapper);
    expect(wrapper.find(".mgb-hex__chip").exists()).toBe(true);

    // The second consecutive empty Backspace steps up one level to /GRID.
    await input.trigger("keydown", { key: "Backspace" });
    await flush(wrapper);
    expect(wrapper.find(".mgb-hex").exists()).toBe(false);
    expect(wrapper.get(".mci-chip").text()).toBe("/GRID");
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(true);
  });

  it("morphs into /BACKGROUND image mode when the settings sheet requests it, and closes back to settings", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);

    // The settings sheet's active image tile asks the bar to open the swap sheet.
    await wrapper.get(".open-image-stub").trigger("click");
    await flush(wrapper);

    expect(wrapper.find(".image-swap-stub").exists()).toBe(true);
    expect(wrapper.get(".mgb-hex__chip").text()).toBe("/BACKGROUND");
    expect(
      wrapper.find('[aria-label="Close background image"]').exists(),
    ).toBe(true);
    // The settings sheet is replaced by the image sheet while swapping.
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(false);

    // Closing returns to the Grid Settings sheet (one level up).
    await wrapper.get('[aria-label="Close background image"]').trigger("click");
    await flush(wrapper);
    expect(wrapper.find(".image-swap-stub").exists()).toBe(false);
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(true);
  });

  it("links a pasted image URL on Enter and clears the field", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);
    await wrapper.get(".open-image-stub").trigger("click");
    await flush(wrapper);

    const input = wrapper.get(".mgb-hex__input");
    await input.setValue("https://cdn/pic.png");
    await input.trigger("keydown", { key: "Enter" });
    await flush(wrapper);

    expect(holder.linkBackgroundImage).toHaveBeenCalledWith(
      "https://cdn/pic.png",
    );
    // The field is cleared but the sheet stays open.
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.find(".image-swap-stub").exists()).toBe(true);
  });

  it("steps back up to /GRID after two Backspaces on an empty URL field", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Grid settings"]').trigger("click");
    await flush(wrapper);
    await wrapper.get(".open-image-stub").trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mgb-hex__chip").text()).toBe("/BACKGROUND");

    const input = wrapper.get(".mgb-hex__input");
    await input.setValue("");
    await input.trigger("keydown", { key: "Backspace" });
    await flush(wrapper);
    // One empty Backspace should not step up yet.
    expect(wrapper.find(".image-swap-stub").exists()).toBe(true);

    await input.trigger("keydown", { key: "Backspace" });
    await flush(wrapper);
    expect(wrapper.find(".image-swap-stub").exists()).toBe(false);
    expect(wrapper.get(".mci-chip").text()).toBe("/GRID");
    expect(wrapper.find(".grid-settings-sheet-stub").exists()).toBe(true);
  });

  describe("share icon", () => {
    const realUserAgent = navigator.userAgent;
    const setUserAgent = (value: string) => {
      Object.defineProperty(navigator, "userAgent", {
        value,
        configurable: true,
      });
    };

    afterEach(() => setUserAgent(realUserAgent));

    it("uses Apple's tray-and-arrow glyph on an Apple platform", async () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
      const wrapper = await mountBar();
      expect(wrapper.findComponent({ name: "ShareAppleIcon" }).exists()).toBe(true);
      expect(wrapper.findComponent({ name: "ShareDefaultIcon" }).exists()).toBe(
        false,
      );
    });

    it("uses the three-node glyph everywhere else", async () => {
      setUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
      const wrapper = await mountBar();
      expect(wrapper.findComponent({ name: "ShareDefaultIcon" }).exists()).toBe(
        true,
      );
      expect(wrapper.findComponent({ name: "ShareAppleIcon" }).exists()).toBe(
        false,
      );
    });
  });

  describe("keyboard inset", () => {
    const setVisualViewport = (height: number) => {
      Object.defineProperty(window, "visualViewport", {
        value: { height, offsetTop: 0, addEventListener() {}, removeEventListener() {} },
        configurable: true,
      });
    };

    afterEach(() => {
      Object.defineProperty(window, "visualViewport", {
        value: undefined,
        configurable: true,
      });
    });

    it("rests at the default gap when no keyboard is open", async () => {
      setVisualViewport(window.innerHeight);
      const wrapper = await mountBar();
      expect(wrapper.get(".mobile-grid-bar").attributes("style")).toContain(
        "bottom: var(--spacing-sm)",
      );
    });

    it("ignores a sub-pixel viewport gap rather than reading it as a keyboard", async () => {
      // A real measurement off a scaled device emulator, which used to land the
      // bar at `bottom: 2.99988px` instead of the intended 8px.
      setVisualViewport(window.innerHeight - 2.99988);
      const wrapper = await mountBar();
      expect(wrapper.get(".mobile-grid-bar").attributes("style")).toContain(
        "bottom: var(--spacing-sm)",
      );
    });

    it("rests flush on top of a real keyboard", async () => {
      setVisualViewport(window.innerHeight - 291.4);
      const wrapper = await mountBar();
      expect(wrapper.get(".mobile-grid-bar").attributes("style")).toContain(
        "bottom: 291px",
      );
    });
  });

  it("copies the grid link when Share is tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Share"]').trigger("click");
    expect(holder.writeText).toHaveBeenCalledWith(window.location.href);
  });

  describe("tile editing", () => {
    /** Stands in for a tile being tapped on the canvas. */
    const activateTile = async (
      wrapper: Awaited<ReturnType<typeof mountBar>>,
      tileId: string | null,
    ) => {
      editTileId.value = tileId;
      editTile.value = tileId ? { i: tileId } : null;
      await flush(wrapper);
    };

    it("morphs into the /EDIT input and raises the sheet when a tile is tapped", async () => {
      const wrapper = await mountBar();
      expect(wrapper.find(".tile-edit-stub").exists()).toBe(false);

      await activateTile(wrapper, "tile-1");

      expect(wrapper.get(".tile-edit-stub").attributes("data-tile")).toBe(
        "tile-1",
      );
      expect(wrapper.find('[aria-label="Filter tile controls"]').exists()).toBe(
        true,
      );
      // The default commands are gone; the pill is now the input.
      expect(wrapper.find('[aria-label="Add a tile"]').exists()).toBe(false);
    });

    it("returns to the default commands when the tile is deactivated", async () => {
      const wrapper = await mountBar();
      await activateTile(wrapper, "tile-1");
      await activateTile(wrapper, null);

      expect(wrapper.find(".tile-edit-stub").exists()).toBe(false);
      expect(wrapper.find('[aria-label="Add a tile"]').exists()).toBe(true);
    });

    it("follows the target straight across when another tile is tapped", async () => {
      const wrapper = await mountBar();
      await activateTile(wrapper, "tile-1");
      await activateTile(wrapper, "tile-2");

      expect(wrapper.get(".tile-edit-stub").attributes("data-tile")).toBe(
        "tile-2",
      );
    });

    it("closes the sheet from the input's close button", async () => {
      const wrapper = await mountBar();
      await activateTile(wrapper, "tile-1");
      await wrapper.get('[aria-label="Close tile editing"]').trigger("click");

      // Deactivating the tile is the composable's job — the bar only asks.
      expect(holder.closeEdit).toHaveBeenCalledTimes(1);
    });

    it("closes the sheet on Escape", async () => {
      const wrapper = await mountBar();
      await activateTile(wrapper, "tile-1");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flush(wrapper);

      expect(holder.closeEdit).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });

    it("keeps the sheet open on a tap outside, unlike the other modes", async () => {
      const wrapper = await mountBar();
      await activateTile(wrapper, "tile-1");
      // jsdom has no PointerEvent constructor; the handler only reads `target`.
      document.body.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true }),
      );
      await flush(wrapper);

      // A tap outside is the tile's own deactivation gesture; dismissing here
      // too would race it and close the sheet the tap was meant to move.
      expect(holder.closeEdit).not.toHaveBeenCalled();
      expect(wrapper.find(".tile-edit-stub").exists()).toBe(true);
      wrapper.unmount();
    });
  });
});
