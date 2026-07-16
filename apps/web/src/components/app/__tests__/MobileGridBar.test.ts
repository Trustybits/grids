import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ContentType } from "@grids/contracts/types";

const Icon = { template: "<span class='icon' />" };

const holder = vi.hoisted(() => ({
  createTile: vi.fn(() => "tile-1"),
  submitCommand: vi.fn(async () => null),
  uploadFileOptimistic: vi.fn(),
  uploadDocumentsOptimistic: vi.fn(),
  addToast: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/components/app/MobileGridSettingsSheet.vue", () => ({
  default: {
    props: ["query"],
    template: "<div class='grid-settings-sheet-stub' :data-query='query' />",
  },
}));

vi.mock("@/components/grid/ViewControls.vue", () => ({
  default: { template: "<div class='view-controls-stub' />" },
}));

const mountBar = async () => {
  const { default: MobileGridBar } = await import("../MobileGridBar.vue");
  return mount(MobileGridBar, { attachTo: document.body });
};

const flush = async (wrapper: { vm: { $nextTick: () => Promise<unknown> } }) => {
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
};

describe("MobileGridBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const mapCard = wrapper
      .findAll(".tile-carousel__card")
      .find((card) => card.text() === "Map");
    await mapCard?.trigger("click");
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

  it("toggles the pinned type off (chip reverts to /TILE) when the card is re-tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    const findMap = () =>
      wrapper.findAll(".tile-carousel__card").find((c) => c.text() === "Map");

    await findMap()?.trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/MAP");

    await findMap()?.trigger("click");
    await flush(wrapper);
    expect(wrapper.get(".mci-chip").text()).toBe("/TILE");
    expect(wrapper.find(".tile-carousel__card--selected").exists()).toBe(false);
  });

  it("keeps the carousel unfiltered with the type highlighted after selecting a command card", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    const mapCard = wrapper
      .findAll(".tile-carousel__card")
      .find((card) => card.text() === "Map");
    await mapCard?.trigger("click");
    await flush(wrapper);

    const input = wrapper.get(".mci-input");
    await input.setValue("something that matches nothing");
    await flush(wrapper);

    const cards = wrapper.findAll(".tile-carousel__card");
    expect(cards).toHaveLength(holder.types.length);
    const selected = wrapper.find(".tile-carousel__card--selected");
    expect(selected.exists()).toBe(true);
    expect(selected.text()).toBe("Map");
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

    const mapCard = wrapper
      .findAll(".tile-carousel__card")
      .find((card) => card.text() === "Map");
    await mapCard?.trigger("click");
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

  it("copies the grid link when Share is tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Share"]').trigger("click");
    expect(holder.writeText).toHaveBeenCalledWith(window.location.href);
  });
});
