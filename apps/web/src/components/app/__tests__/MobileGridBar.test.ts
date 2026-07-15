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

vi.mock("@/components/grid/GridSettings.vue", () => ({
  default: { template: "<div class='grid-settings-stub' />" },
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
    expect(wrapper.find(".grid-settings-stub").exists()).toBe(true);
    expect(wrapper.find('[aria-label="Preview"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Share"]').exists()).toBe(true);
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

  it("creates a map from the typed location after tapping the Map card", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Add a tile"]').trigger("click");
    await flush(wrapper);

    const mapCard = wrapper
      .findAll(".tile-carousel__card")
      .find((card) => card.text() === "Map");
    await mapCard?.trigger("click");
    await flush(wrapper);
    // The Map card focuses the input rather than creating immediately.
    expect(holder.createTile).not.toHaveBeenCalled();

    const input = wrapper.get(".mci-input");
    await input.setValue("Paris");
    await input.trigger("keydown", { key: "Enter" });
    await flush(wrapper);

    expect(holder.createTile).toHaveBeenCalledWith(ContentType.MAP, {
      searchQuery: "Paris",
    });
  });

  it("copies the grid link when Share is tapped", async () => {
    const wrapper = await mountBar();
    await wrapper.get('[aria-label="Share"]').trigger("click");
    expect(holder.writeText).toHaveBeenCalledWith(window.location.href);
  });
});
