import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { useGridUiStore } from "@/stores/grid/gridUi";
import type { MobileTileEditHandle } from "../useMobileTileEdit";

// The controller only routes the target id into the UI store here.
vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({
    setMobileEditTile: (id: string | null) =>
      useGridUiStore().setMobileEditTile(id),
  }),
}));

const makeHandle = (): MobileTileEditHandle => ({
  childComponent: ref(null),
  isEditing: ref(false),
  isExitingCropMode: ref(false),
  resizeTile: vi.fn(),
  remove: vi.fn(),
});

describe("useMobileTileEdit — handle belongs to its tile", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    // Module-level handle state: start every test closed.
    const { useMobileTileEdit } = await import("../useMobileTileEdit");
    useMobileTileEdit().closeEdit();
  });

  it("exposes the handle of the selected tile", async () => {
    const { useMobileTileEdit } = await import("../useMobileTileEdit");
    const edit = useMobileTileEdit();
    const handle = makeHandle();

    edit.openEdit("a", handle);

    expect(edit.handle.value).toBe(handle);
  });

  it("hides a stale handle once the selection moves without a tap", async () => {
    const { useMobileTileEdit } = await import("../useMobileTileEdit");
    const edit = useMobileTileEdit();
    const original = makeHandle();
    edit.openEdit("a", original);

    // A duplicate's copy is selected before it mounts: acting now must not
    // reach the original tile (its Delete would remove the wrong tile).
    useGridUiStore().setMobileEditTile("copy");
    expect(edit.handle.value).toBeNull();

    // Once the copy registers, its own handle is live.
    const copy = makeHandle();
    edit.openEdit("copy", copy);
    expect(edit.handle.value).toBe(copy);
  });

  it("clears the handle on close", async () => {
    const { useMobileTileEdit } = await import("../useMobileTileEdit");
    const edit = useMobileTileEdit();
    edit.openEdit("a", makeHandle());
    edit.closeEdit();
    expect(edit.handle.value).toBeNull();
    expect(edit.editTileId.value).toBeNull();
  });
});

describe("startTileTyping / stopTileTyping", () => {
  const withChild = (child: Record<string, unknown>): MobileTileEditHandle => ({
    ...makeHandle(),
    childComponent: ref(child as never),
  });

  it("opens a field tile on its title, otherwise starts like a tap", async () => {
    const { startTileTyping } = await import("../useMobileTileEdit");
    const startEditing = vi.fn();
    startTileTyping(withChild({ startEditing }));
    expect(startEditing).toHaveBeenCalledWith("title");

    const onShortClick = vi.fn();
    startTileTyping(withChild({ onShortClick }));
    expect(onShortClick).toHaveBeenCalledTimes(1);
  });

  it("stops through the tile's own exit, else its stopEditing", async () => {
    const { stopTileTyping } = await import("../useMobileTileEdit");
    const onExitClick = vi.fn();
    const stopEditing = vi.fn();
    stopTileTyping(withChild({ onExitClick, stopEditing }));
    expect(onExitClick).toHaveBeenCalledTimes(1);
    expect(stopEditing).not.toHaveBeenCalled();

    stopTileTyping(withChild({ stopEditing }));
    expect(stopEditing).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a live tile", async () => {
    const { startTileTyping, stopTileTyping } = await import(
      "../useMobileTileEdit"
    );
    expect(() => startTileTyping(null)).not.toThrow();
    expect(() => stopTileTyping(makeHandle())).not.toThrow();
  });
});
