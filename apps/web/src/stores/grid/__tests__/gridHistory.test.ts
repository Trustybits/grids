import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Snapshot } from "@/undo/UndoTypes";
import { useGridHistoryStore } from "../gridHistory";

const historyHarness = vi.hoisted(() => ({
  codecs: [] as Array<{
    replaceBlobUrl: ReturnType<typeof vi.fn>;
  }>,
  instances: [] as Array<{
    onChanged?: () => void;
    pushSnapshot: ReturnType<typeof vi.fn>;
    undo: ReturnType<typeof vi.fn>;
    redo: ReturnType<typeof vi.fn>;
    undoRedoUntil: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    replaceBlobUrl: ReturnType<typeof vi.fn>;
    canUndo: ReturnType<typeof vi.fn>;
    canRedo: ReturnType<typeof vi.fn>;
    getLastActionLabel: ReturnType<typeof vi.fn>;
    getNextRedoActionLabel: ReturnType<typeof vi.fn>;
    getStacks: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("@/undo/GridSnapshotCodec", () => ({
  GridSnapshotCodec: class {
    replaceBlobUrl = vi.fn();

    constructor() {
      historyHarness.codecs.push(this);
    }
  },
}));

vi.mock("@/undo/UndoRedoManager", () => ({
  UndoRedoManager: class {
    onChanged?: () => void;
    pushSnapshot = vi.fn(() => this.onChanged?.());
    undo = vi.fn(() => null);
    redo = vi.fn(() => null);
    undoRedoUntil = vi.fn(() => null);
    clear = vi.fn(() => this.onChanged?.());
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
    historyHarness.codecs.length = 0;
    historyHarness.instances.length = 0;
    setActivePinia(createPinia());
  });

  it("starts without a manager and with empty transaction defaults", () => {
    const store = useGridHistoryStore();

    expect(historyHarness.codecs).toHaveLength(1);
    expect(historyHarness.instances).toHaveLength(0);
    expect(store.manager).toBeNull();
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
    store.initializeManager();
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
    store.initializeManager();
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

  it("replaces blob URLs in the manager and every owned snapshot", () => {
    const store = useGridHistoryStore();
    store.initializeManager();
    const manager = historyHarness.instances[0];
    const codec = historyHarness.codecs[0];
    const stable = makeSnapshot("Stable");
    const edit = makeSnapshot("Edit");
    const move = makeSnapshot("Move");
    const resize = makeSnapshot("Resize");
    store.setStableSnapshot(stable);
    store.beginEdit("tile-1", edit);
    store.beginMove(move);
    store.beginResize(resize);

    store.replaceBlobUrl(
      "tile-1",
      "https://example.com/file",
      "item-1",
    );

    expect(manager.replaceBlobUrl).toHaveBeenCalledWith(
      "tile-1",
      "https://example.com/file",
      "item-1",
    );
    expect(codec.replaceBlobUrl.mock.calls).toEqual([
      [stable, "tile-1", "https://example.com/file", "item-1"],
      [edit, "tile-1", "https://example.com/file", "item-1"],
      [move, "tile-1", "https://example.com/file", "item-1"],
      [resize, "tile-1", "https://example.com/file", "item-1"],
    ]);

    store.replaceBlobUrl(
      "tile-2",
      "https://example.com/image",
    );

    expect(manager.replaceBlobUrl).toHaveBeenLastCalledWith(
      "tile-2",
      "https://example.com/image",
    );
  });

  it("owns stable, edit, move, and resize transaction state", () => {
    const store = useGridHistoryStore();
    const stable = makeSnapshot("Stable");
    const edit = makeSnapshot("Edit");
    const move = makeSnapshot("Move");
    const resize = makeSnapshot("Resize");

    store.setStableSnapshot(stable);
    expect(store.beginEdit("tile-1", edit)).toBe(true);
    expect(
      store.beginEdit("tile-2", makeSnapshot("Ignored")),
    ).toBe(false);
    expect(store.beginMove(move)).toBe(true);
    expect(store.beginMove(makeSnapshot("Ignored move"))).toBe(false);
    expect(store.beginResize(resize)).toBe(true);
    expect(
      store.beginResize(makeSnapshot("Ignored resize")),
    ).toBe(false);

    expect(store.stableSnapshot).toEqual(stable);
    expect(store.editingTileId).toBe("tile-1");
    expect(store.pendingEditSnapshot).toEqual(edit);
    expect(store.pendingMoveSnapshot).toEqual(move);
    expect(store.pendingResizeSnapshot).toEqual(resize);

    expect(store.isEditing("tile-1")).toBe(true);
    expect(store.isEditing("tile-2")).toBe(false);
    expect(store.takeEditSnapshot()).toEqual(edit);
    expect(store.takeMoveSnapshot()).toEqual(move);
    expect(store.takeResizeSnapshot()).toEqual(resize);

    expect(store.editingTileId).toBeNull();
    expect(store.pendingEditSnapshot).toBeNull();
    expect(store.pendingMoveSnapshot).toBeNull();
    expect(store.pendingResizeSnapshot).toBeNull();
    expect(store.stableSnapshot).toEqual(stable);
    expect(store.takeEditSnapshot()).toBeNull();
    expect(store.takeMoveSnapshot()).toBeNull();
    expect(store.takeResizeSnapshot()).toBeNull();
  });

  it("reset clears the manager and every history field", () => {
    const store = useGridHistoryStore();
    store.initializeManager();
    const originalManager = store.manager;
    store.setStableSnapshot(makeSnapshot("Stable"));
    store.beginEdit("tile-1", makeSnapshot("Edit"));
    store.beginMove(makeSnapshot("Move"));
    store.beginResize(makeSnapshot("Resize"));
    store.pushSnapshot(makeSnapshot());

    store.reset();

    expect(historyHarness.instances).toHaveLength(1);
    expect(originalManager?.clear).toHaveBeenCalledTimes(1);
    expect(store.manager).toBeNull();
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

    first.initializeManager();
    second.initializeManager();
    first.setStableSnapshot(makeSnapshot("First"));
    first.beginEdit("tile-1", makeSnapshot("Edit"));
    first.beginMove(makeSnapshot("Move"));
    first.beginResize(makeSnapshot("Resize"));

    expect(first.manager).not.toBe(second.manager);
    expect(second.stableSnapshot).toBeNull();
    expect(second.editingTileId).toBeNull();
    expect(second.pendingEditSnapshot).toBeNull();
    expect(second.pendingMoveSnapshot).toBeNull();
    expect(second.pendingResizeSnapshot).toBeNull();
  });
});
