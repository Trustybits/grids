import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Snapshot } from "@/undo/UndoTypes";
import { useGridHistoryStore } from "../gridHistory";

const historyHarness = vi.hoisted(() => ({
  instances: [] as Array<{
    onChanged?: () => void;
    pushSnapshot: ReturnType<typeof vi.fn>;
    undo: ReturnType<typeof vi.fn>;
    redo: ReturnType<typeof vi.fn>;
    undoRedoUntil: ReturnType<typeof vi.fn>;
    replaceBlobUrl: ReturnType<typeof vi.fn>;
    canUndo: ReturnType<typeof vi.fn>;
    canRedo: ReturnType<typeof vi.fn>;
    getLastActionLabel: ReturnType<typeof vi.fn>;
    getNextRedoActionLabel: ReturnType<typeof vi.fn>;
    getStacks: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@/undo/UndoRedoManager", () => ({
  UndoRedoManager: class {
    onChanged?: () => void;
    pushSnapshot = vi.fn(() => this.onChanged?.());
    undo = vi.fn(() => null);
    redo = vi.fn(() => null);
    undoRedoUntil = vi.fn(() => null);
    replaceBlobUrl = vi.fn();
    canUndo = vi.fn(() => false);
    canRedo = vi.fn(() => false);
    getLastActionLabel = vi.fn(() => null);
    getNextRedoActionLabel = vi.fn(() => null);
    getStacks = vi.fn(() => ({ undoStack: [], redoStack: [] }));

    constructor(onChanged?: () => void) {
      this.onChanged = onChanged;
      historyHarness.instances.push(this);
    }
  },
}));

function makeSnapshot(actionLabel = "Edit"): Snapshot {
  return {
    tiles: [],
    overrides: {},
    verticalCompact: true,
    themeId: "dark",
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    forcedBreakpoint: "lg",
    actionLabel,
  };
}

describe("gridHistory store", () => {
  beforeEach(() => {
    historyHarness.instances.length = 0;
    setActivePinia(createPinia());
  });

  it("creates per-store history state with empty transaction defaults", () => {
    const store = useGridHistoryStore();

    expect(historyHarness.instances).toHaveLength(1);
    expect(store.stackVersion).toBe(0);
    expect(store.stableSnapshot).toBeNull();
    expect(store.pendingEditSnapshot).toBeNull();
    expect(store.pendingMoveSnapshot).toBeNull();
    expect(store.pendingResizeSnapshot).toBeNull();
    expect(store.editingTileId).toBeNull();
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
    expect(store.undoActionLabel).toBeNull();
    expect(store.redoActionLabel).toBeNull();
    expect(store.undoRedoStacks).toEqual({
      undoStack: [],
      redoStack: [],
    });
  });

  it("delegates stack operations and exposes their return values", () => {
    const store = useGridHistoryStore();
    const manager = historyHarness.instances[0];
    const current = makeSnapshot("Current");
    const target = makeSnapshot("Target");
    manager.undo.mockReturnValue(target);
    manager.redo.mockReturnValue(target);
    manager.undoRedoUntil.mockReturnValue(target);

    store.pushSnapshot(current);

    expect(manager.pushSnapshot).toHaveBeenCalledWith(current);
    expect(store.stackVersion).toBe(1);
    expect(store.undo(current)).toBe(target);
    expect(manager.undo).toHaveBeenCalledWith(current);
    expect(store.redo(current)).toBe(target);
    expect(manager.redo).toHaveBeenCalledWith(current);
    expect(store.undoRedoUntil(7, current)).toBe(target);
    expect(manager.undoRedoUntil).toHaveBeenCalledWith(7, current);
  });

  it("invalidates every stack-derived getter when the manager changes", () => {
    const store = useGridHistoryStore();
    const manager = historyHarness.instances[0];

    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
    expect(store.undoActionLabel).toBeNull();
    expect(store.redoActionLabel).toBeNull();
    expect(store.undoRedoStacks).toEqual({
      undoStack: [],
      redoStack: [],
    });

    manager.canUndo.mockReturnValue(true);
    manager.canRedo.mockReturnValue(true);
    manager.getLastActionLabel.mockReturnValue("Undo edit");
    manager.getNextRedoActionLabel.mockReturnValue("Redo edit");
    manager.getStacks.mockReturnValue({
      undoStack: [
        { actionLabel: "Undo edit", timestamp: 1, snapshotId: 1 },
      ],
      redoStack: [
        { actionLabel: "Redo edit", timestamp: 2, snapshotId: 2 },
      ],
    });

    manager.onChanged?.();

    expect(store.stackVersion).toBe(1);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(true);
    expect(store.undoActionLabel).toBe("Undo edit");
    expect(store.redoActionLabel).toBe("Redo edit");
    expect(store.undoRedoStacks).toEqual({
      undoStack: [
        { actionLabel: "Undo edit", timestamp: 1, snapshotId: 1 },
      ],
      redoStack: [
        { actionLabel: "Redo edit", timestamp: 2, snapshotId: 2 },
      ],
    });
  });

  it("delegates stack URL replacement without touching snapshot fields", () => {
    const store = useGridHistoryStore();
    const manager = historyHarness.instances[0];

    store.replaceStackBlobUrl(
      "tile-1",
      "https://example.com/file",
      "item-1",
    );

    expect(manager.replaceBlobUrl).toHaveBeenCalledWith(
      "tile-1",
      "https://example.com/file",
      "item-1",
    );

    store.replaceStackBlobUrl(
      "tile-2",
      "https://example.com/image",
    );

    expect(manager.replaceBlobUrl).toHaveBeenLastCalledWith(
      "tile-2",
      "https://example.com/image",
      undefined,
    );
  });

  it("owns stable, edit, move, and resize transaction state", () => {
    const store = useGridHistoryStore();
    const stable = makeSnapshot("Stable");
    const edit = makeSnapshot("Edit");
    const move = makeSnapshot("Move");
    const resize = makeSnapshot("Resize");

    store.setStableSnapshot(stable);
    store.beginEdit("tile-1", edit);
    store.beginEdit("tile-2", makeSnapshot("Ignored"));
    store.setPendingMoveSnapshot(move);
    store.setPendingResizeSnapshot(resize);

    expect(store.stableSnapshot).toEqual(stable);
    expect(store.editingTileId).toBe("tile-1");
    expect(store.pendingEditSnapshot).toEqual(edit);
    expect(store.pendingMoveSnapshot).toEqual(move);
    expect(store.pendingResizeSnapshot).toEqual(resize);

    store.clearTransactions();

    expect(store.editingTileId).toBeNull();
    expect(store.pendingEditSnapshot).toBeNull();
    expect(store.pendingMoveSnapshot).toBeNull();
    expect(store.pendingResizeSnapshot).toBeNull();
    expect(store.stableSnapshot).toEqual(stable);
  });

  it("reset replaces the manager and clears every history field", () => {
    const store = useGridHistoryStore();
    const originalManager = store.manager;
    store.setStableSnapshot(makeSnapshot("Stable"));
    store.beginEdit("tile-1", makeSnapshot("Edit"));
    store.setPendingMoveSnapshot(makeSnapshot("Move"));
    store.setPendingResizeSnapshot(makeSnapshot("Resize"));
    store.pushSnapshot(makeSnapshot());

    store.reset();

    expect(historyHarness.instances).toHaveLength(2);
    expect(store.manager).not.toBe(originalManager);
    expect(store.stackVersion).toBe(0);
    expect(store.stableSnapshot).toBeNull();
    expect(store.editingTileId).toBeNull();
    expect(store.pendingEditSnapshot).toBeNull();
    expect(store.pendingMoveSnapshot).toBeNull();
    expect(store.pendingResizeSnapshot).toBeNull();
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
    expect(store.undoActionLabel).toBeNull();
    expect(store.redoActionLabel).toBeNull();
    expect(store.undoRedoStacks).toEqual({
      undoStack: [],
      redoStack: [],
    });
  });

  it("does not share managers or transactions between Pinia instances", () => {
    const firstPinia = createPinia();
    const secondPinia = createPinia();
    const first = useGridHistoryStore(firstPinia);
    const second = useGridHistoryStore(secondPinia);

    first.setStableSnapshot(makeSnapshot("First"));
    first.beginEdit("tile-1", makeSnapshot("Edit"));

    expect(first.manager).not.toBe(second.manager);
    expect(second.stableSnapshot).toBeNull();
    expect(second.editingTileId).toBeNull();
    expect(second.pendingEditSnapshot).toBeNull();
  });
});
