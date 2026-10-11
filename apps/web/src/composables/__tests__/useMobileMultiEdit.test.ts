import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { ContentType, type Tile } from "@grids/contracts/types";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useToastStore } from "@/stores/toast";

const m = vi.hoisted(() => ({
  begin: vi.fn(() => true),
  commit: vi.fn(),
  removeTile: vi.fn(),
  duplicateTile: vi.fn((id: string) => `${id}-copy`),
  removeTiles: vi.fn(),
  undo: vi.fn(),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => {
    const ui = useGridUiStore();
    return {
      enterMobileMultiSelect: () => ui.enterMobileMultiSelect(),
      toggleMobileMultiSelectTile: (id: string) =>
        ui.toggleMobileMultiSelectTile(id),
      clearMobileEditor: () => ui.clearMobileEditor(),
      undo: m.undo,
    };
  },
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => ({
    beginHistoryBatch: m.begin,
    commitHistoryBatch: m.commit,
    removeTile: m.removeTile,
    duplicateTile: m.duplicateTile,
  }),
}));

vi.mock("@/composables/useMobileExperience", () => ({
  useMobileExperience: () => ({ isUnifiedText: ref(true) }),
}));

vi.mock("@/composables/useGridEngineBridge", () => ({
  getGridEngineBridge: () => ({ removeTiles: m.removeTiles }),
}));

const tile = (i: string, type: ContentType, extra: object = {}): Tile =>
  ({
    i,
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    content: { type, text: "", src: "a.png", ...extra },
  }) as Tile;

const setup = async (tiles: Tile[], picks: string[]) => {
  const session = useGridSessionStore();
  session.currentGrid = { id: "g", tiles } as never;
  const ui = useGridUiStore();
  ui.setMobileEditTile(picks[0]);
  ui.enterMobileMultiSelect();
  for (const id of picks.slice(1)) ui.toggleMobileMultiSelectTile(id);
  const { useMobileMultiEdit } = await import("../useMobileMultiEdit");
  return { multi: useMobileMultiEdit(), ui };
};

describe("useMobileMultiEdit", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("lists the picks in order and only their shared, bulk-safe tools", async () => {
    const { multi } = await setup(
      [tile("t", ContentType.TEXT), tile("i", ContentType.IMAGE)],
      ["t", "i"],
    );
    expect(multi.tiles.value.map((t) => t.i)).toEqual(["t", "i"]);
    expect(multi.tools.value.map((t) => t.id)).toEqual([
      "fill", "link", "border", "duplicate", "delete",
    ]);
  });

  it("deletes every pick as one undo step, leaves multi-edit, offers Undo", async () => {
    const { multi, ui } = await setup(
      [tile("t", ContentType.TEXT), tile("i", ContentType.IMAGE)],
      ["t", "i"],
    );
    multi.removeAll();
    expect(m.begin).toHaveBeenCalledWith("Delete tiles");
    expect(m.removeTiles).toHaveBeenCalledWith(["t", "i"]);
    expect(m.commit).toHaveBeenCalledTimes(1);
    expect(ui.mobileMultiSelectIds).toBeNull();
    const toasts = useToastStore().toasts;
    const toast = toasts[toasts.length - 1];
    expect(toast?.message).toBe("2 tiles deleted");
    expect(toast?.action?.label).toBe("Undo");
  });

  it("duplicates every pick as one undo step and keeps the picks", async () => {
    const { multi, ui } = await setup(
      [tile("t", ContentType.TEXT), tile("i", ContentType.IMAGE)],
      ["t", "i"],
    );
    multi.duplicateAll();
    expect(m.begin).toHaveBeenCalledWith("Duplicate tiles");
    expect(m.duplicateTile).toHaveBeenCalledTimes(2);
    expect(m.commit).toHaveBeenCalledTimes(1);
    expect(ui.mobileMultiSelectIds).toEqual(["t", "i"]);
    const toasts = useToastStore().toasts;
    expect(toasts[toasts.length - 1]?.message).toBe("2 tiles duplicated");
  });

  it("unpicking the last tile leaves multi-edit", async () => {
    const { multi, ui } = await setup([tile("t", ContentType.TEXT)], ["t"]);
    multi.toggle("t");
    expect(ui.mobileMultiSelectIds).toBeNull();
    expect(multi.active.value).toBe(false);
  });
});
