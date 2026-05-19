import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { UndoRedoManager } from "../UndoRedoManager";
import type { Snapshot } from "../UndoTypes";
import {
  ContentType,
  type DocumentsContent,
  type ImageContent,
  type LinkContent,
  type TileContent,
} from "../../types/TileContent";

const exampleSnapshot: Snapshot = {
  tiles: [
    {
      i: "tile-1",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      borderEnabled: false,
      caption: "",
      content: {
        type: ContentType.TEXT,
        text: "Hello world",
        font: "Inter",
        fontSize: 16,
        isBold: false,
        isItalic: false,
        textType: "paragraph",
        color: "#000000",
      } as TileContent,
    },
    {
      i: "tile-2",
      x: 2,
      y: 0,
      w: 4,
      h: 3,
      borderEnabled: true,
      caption: "My photo",
      content: {
        type: ContentType.IMAGE,
        src: "https://example.com/photo.jpg",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    },
    {
      i: "tile-3",
      x: 0,
      y: 2,
      w: 2,
      h: 1,
      caption: "",
      content: {
        type: ContentType.LINK,
        link: "https://github.com",
        metaTitle: "GitHub",
        metaDescription: "Dev platform",
      } as LinkContent,
    },
  ],
  overrides: {
    md: {
      "tile-1": { x: 0, y: 0, w: 3, h: 2 },
      "tile-2": { x: 3, y: 0, w: 3, h: 3 },
    },
    sm: {
      "tile-1": { x: 0, y: 0, w: 4, h: 2 },
      "tile-2": { x: 0, y: 2, w: 4, h: 3 },
      "tile-3": { x: 0, y: 5, w: 4, h: 1 },
    },
  },
  verticalCompact: true,
  themeId: "default",
  backgroundImageSrc: "",
  backgroundEmbed: false,
  backgroundColor: "",
  forcedBreakpoint: "lg",
  actionLabel: "Toggle gravity",
};

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return { ...exampleSnapshot, ...overrides };
}

describe("UndoRedoManager", () => {
  let undoRedoManager: UndoRedoManager;

  beforeAll(() => {
    undoRedoManager = new UndoRedoManager(() => {});
  });

  afterEach(() => {
    undoRedoManager.clear();
  });

  it("pushes a snapshot onto the undo stack", () => {
    undoRedoManager.pushSnapshot(exampleSnapshot);

    expect(undoRedoManager.canUndo()).toBe(true);
    expect(undoRedoManager.getLastActionLabel()).toBe(
      exampleSnapshot.actionLabel,
    );
  });

  it("clears the undo and redo stacks", () => {
    undoRedoManager.pushSnapshot(exampleSnapshot);

    undoRedoManager.clear();

    expect(undoRedoManager.canUndo()).toBe(false);
    expect(undoRedoManager.canRedo()).toBe(false);
    expect(undoRedoManager.getLastActionLabel()).toBeNull();
    expect(undoRedoManager.getNextRedoActionLabel()).toBeNull();
  });

  it("returns the snapshot to undo", () => {
    const currentSnapshot = makeSnapshot({
      verticalCompact: false,
      actionLabel: "dummy",
    });

    undoRedoManager.pushSnapshot(exampleSnapshot);
    const snapshotToApply = undoRedoManager.undo(currentSnapshot);

    expect(snapshotToApply).toStrictEqual(exampleSnapshot);
    expect(undoRedoManager.canRedo()).toBe(true);
    expect(undoRedoManager.canUndo()).toBe(false);
    expect(undoRedoManager.getNextRedoActionLabel()).toBe(
      exampleSnapshot.actionLabel,
    );
    expect(undoRedoManager.getLastActionLabel()).toBeNull();
  });

  it("returns the snapshot to redo", () => {
    const currentSnapshot = makeSnapshot({
      verticalCompact: false,
      actionLabel: "current",
    });

    undoRedoManager.pushSnapshot(exampleSnapshot);
    undoRedoManager.undo(currentSnapshot);
    const redoSnapshotToApply = undoRedoManager.redo(exampleSnapshot);

    expect(redoSnapshotToApply).toStrictEqual({
      ...currentSnapshot,
      actionLabel: exampleSnapshot.actionLabel,
    });
    expect(undoRedoManager.canUndo()).toBe(true);
    expect(undoRedoManager.canRedo()).toBe(false);
    expect(undoRedoManager.getLastActionLabel()).toBe(
      exampleSnapshot.actionLabel,
    );
    expect(undoRedoManager.getNextRedoActionLabel()).toBeNull();
  });

  it("calls the given onChanged callback", () => {
    const onChanged = vi.fn();
    const manager = new UndoRedoManager(onChanged);

    const snap1 = makeSnapshot({ actionLabel: "action 1" });
    const snap2 = makeSnapshot({
      verticalCompact: false,
      actionLabel: "action 2",
    });

    manager.pushSnapshot(snap1);
    expect(onChanged).toHaveBeenCalledTimes(1);

    manager.undo(snap2);
    expect(onChanged).toHaveBeenCalledTimes(2);

    manager.redo(snap1);
    expect(onChanged).toHaveBeenCalledTimes(3);

    manager.clear();
    expect(onChanged).toHaveBeenCalledTimes(4);
  });

  it("works with multiple layers of undo", () => {
    const snap1 = makeSnapshot({
      themeId: "theme-1",
      actionLabel: "Set theme 1",
    });
    const snap2 = makeSnapshot({
      themeId: "theme-2",
      actionLabel: "Set theme 2",
    });
    const snap3 = makeSnapshot({
      themeId: "theme-3",
      actionLabel: "Set theme 3",
    });
    const current = makeSnapshot({
      themeId: "theme-4",
      actionLabel: "current",
    });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.pushSnapshot(snap2);
    undoRedoManager.pushSnapshot(snap3);

    const undo1 = undoRedoManager.undo(current);
    expect(undo1).toStrictEqual(snap3);
    expect(undoRedoManager.getLastActionLabel()).toBe("Set theme 2");

    const undo2 = undoRedoManager.undo(snap3);
    expect(undo2).toStrictEqual(snap2);
    expect(undoRedoManager.getLastActionLabel()).toBe("Set theme 1");

    const undo3 = undoRedoManager.undo(snap2);
    expect(undo3).toStrictEqual(snap1);
    expect(undoRedoManager.canUndo()).toBe(false);
  });

  it("works with multiple layers of redo", () => {
    const snap1 = makeSnapshot({
      themeId: "theme-1",
      actionLabel: "Set theme 1",
    });
    const snap2 = makeSnapshot({
      themeId: "theme-2",
      actionLabel: "Set theme 2",
    });
    const snap3 = makeSnapshot({
      themeId: "theme-3",
      actionLabel: "Set theme 3",
    });
    const current = makeSnapshot({
      themeId: "theme-4",
      actionLabel: "current",
    });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.pushSnapshot(snap2);
    undoRedoManager.pushSnapshot(snap3);

    // Undo all three
    const afterUndo3 = undoRedoManager.undo(current)!;
    const afterUndo2 = undoRedoManager.undo(afterUndo3)!;
    const afterUndo1 = undoRedoManager.undo(afterUndo2)!;
    expect(undoRedoManager.canUndo()).toBe(false);
    expect(undoRedoManager.canRedo()).toBe(true);

    // Redo returns the state that was current when the corresponding undo happened
    const redo1 = undoRedoManager.redo(afterUndo1)!;
    expect(redo1.themeId).toBe("theme-2");
    expect(undoRedoManager.getNextRedoActionLabel()).toBe("Set theme 2");

    const redo2 = undoRedoManager.redo(redo1)!;
    expect(redo2.themeId).toBe("theme-3");
    expect(undoRedoManager.getNextRedoActionLabel()).toBe("Set theme 3");

    const redo3 = undoRedoManager.redo(redo2)!;
    expect(redo3.themeId).toBe("theme-4");
    expect(undoRedoManager.canRedo()).toBe(false);
  });

  it("does not accept duplicate layouts", () => {
    const snap = makeSnapshot({ actionLabel: "action" });
    const duplicateWithDifferentLabel = makeSnapshot({
      actionLabel: "different label",
    });

    undoRedoManager.pushSnapshot(snap);
    undoRedoManager.pushSnapshot(duplicateWithDifferentLabel);

    const current = makeSnapshot({
      verticalCompact: false,
      actionLabel: "current",
    });
    undoRedoManager.undo(current);
    expect(undoRedoManager.canUndo()).toBe(false);
  });

  it("returns null when undoing with empty stack", () => {
    const current = makeSnapshot({ actionLabel: "current" });
    expect(undoRedoManager.undo(current)).toBeNull();
    expect(undoRedoManager.canRedo()).toBe(false);
  });

  it("returns null when redoing with empty stack", () => {
    const current = makeSnapshot({ actionLabel: "current" });
    expect(undoRedoManager.redo(current)).toBeNull();
    expect(undoRedoManager.canUndo()).toBe(false);
  });

  it("clears the redo stack when a new snapshot is pushed", () => {
    const snap1 = makeSnapshot({
      themeId: "theme-1",
      actionLabel: "Set theme 1",
    });
    const snap2 = makeSnapshot({
      themeId: "theme-2",
      actionLabel: "Set theme 2",
    });
    const current = makeSnapshot({
      themeId: "theme-3",
      actionLabel: "current",
    });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.pushSnapshot(snap2);
    undoRedoManager.undo(current);
    expect(undoRedoManager.canRedo()).toBe(true);

    const newSnap = makeSnapshot({
      themeId: "theme-new",
      actionLabel: "New action",
    });
    undoRedoManager.pushSnapshot(newSnap);
    expect(undoRedoManager.canRedo()).toBe(false);
  });

  it("caps the undo stack at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: `theme-${i}`, actionLabel: `action ${i}` }),
      );
    }

    let undoCount = 0;
    let current = makeSnapshot({ themeId: "final", actionLabel: "current" });
    while (undoRedoManager.canUndo()) {
      current = undoRedoManager.undo(current)!;
      undoCount++;
    }
    expect(undoCount).toBe(20);

    // The oldest entries should have been evicted — first kept should be action 5
    expect(current.actionLabel).toBe("action 5");
  });

  it("works without an onChanged callback", () => {
    const manager = new UndoRedoManager();
    const snap = makeSnapshot({ actionLabel: "test" });

    expect(() => {
      manager.pushSnapshot(snap);
      manager.undo(
        makeSnapshot({ verticalCompact: false, actionLabel: "current" }),
      );
      manager.redo(snap);
      manager.clear();
    }).not.toThrow();
  });

  it("preserves the action label from the undone snapshot on the redo entry", () => {
    const snap = makeSnapshot({ actionLabel: "Move tile" });
    const current = makeSnapshot({
      verticalCompact: false,
      actionLabel: "current state",
    });

    undoRedoManager.pushSnapshot(snap);
    undoRedoManager.undo(current);

    expect(undoRedoManager.getNextRedoActionLabel()).toBe("Move tile");
  });

  it("does not call onChanged when a duplicate is rejected", () => {
    const onChanged = vi.fn();
    const manager = new UndoRedoManager(onChanged);

    const snap = makeSnapshot({ actionLabel: "action" });
    manager.pushSnapshot(snap);
    expect(onChanged).toHaveBeenCalledTimes(1);

    const duplicate = makeSnapshot({ actionLabel: "different label" });
    manager.pushSnapshot(duplicate);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("accepts non-consecutive duplicates since isDuplicate only checks the top of stack", () => {
    const snapA = makeSnapshot({ themeId: "A", actionLabel: "Set A" });
    const snapB = makeSnapshot({ themeId: "B", actionLabel: "Set B" });
    const snapA2 = makeSnapshot({ themeId: "A", actionLabel: "Set A again" });

    undoRedoManager.pushSnapshot(snapA);
    undoRedoManager.pushSnapshot(snapB);
    undoRedoManager.pushSnapshot(snapA2);

    const current = makeSnapshot({ themeId: "C", actionLabel: "current" });
    const undo1 = undoRedoManager.undo(current)!;
    expect(undo1.themeId).toBe("A");

    const undo2 = undoRedoManager.undo(undo1)!;
    expect(undo2.themeId).toBe("B");

    const undo3 = undoRedoManager.undo(undo2)!;
    expect(undo3.themeId).toBe("A");
    expect(undoRedoManager.canUndo()).toBe(false);
  });

  it("supports undo-redo-undo interleaving", () => {
    const snap1 = makeSnapshot({
      themeId: "theme-1",
      actionLabel: "Set theme 1",
    });
    const snap2 = makeSnapshot({
      themeId: "theme-2",
      actionLabel: "Set theme 2",
    });
    const current = makeSnapshot({
      themeId: "theme-3",
      actionLabel: "current",
    });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.pushSnapshot(snap2);

    const afterUndo = undoRedoManager.undo(current)!;
    expect(afterUndo.themeId).toBe("theme-2");

    const afterRedo = undoRedoManager.redo(afterUndo)!;
    expect(afterRedo.themeId).toBe("theme-3");

    const afterUndo2 = undoRedoManager.undo(afterRedo)!;
    expect(afterUndo2.themeId).toBe("theme-2");
    expect(undoRedoManager.canUndo()).toBe(true);
    expect(undoRedoManager.canRedo()).toBe(true);
  });

  it("clear resets redo stack after undos have been performed", () => {
    const snap = makeSnapshot({ actionLabel: "action" });
    const current = makeSnapshot({
      verticalCompact: false,
      actionLabel: "current",
    });

    undoRedoManager.pushSnapshot(snap);
    undoRedoManager.undo(current);
    expect(undoRedoManager.canRedo()).toBe(true);

    undoRedoManager.clear();
    expect(undoRedoManager.canRedo()).toBe(false);
    expect(undoRedoManager.getNextRedoActionLabel()).toBeNull();
  });

  it("getLastActionLabel returns the most recently pushed label", () => {
    undoRedoManager.pushSnapshot(
      makeSnapshot({ themeId: "A", actionLabel: "first" }),
    );
    undoRedoManager.pushSnapshot(
      makeSnapshot({ themeId: "B", actionLabel: "second" }),
    );
    undoRedoManager.pushSnapshot(
      makeSnapshot({ themeId: "C", actionLabel: "third" }),
    );

    expect(undoRedoManager.getLastActionLabel()).toBe("third");
  });

  it("getNextRedoActionLabel returns the most recently added redo entry", () => {
    const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
    const snap2 = makeSnapshot({ themeId: "B", actionLabel: "second" });
    const current = makeSnapshot({ themeId: "C", actionLabel: "current" });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.pushSnapshot(snap2);

    undoRedoManager.undo(current);
    undoRedoManager.undo(makeSnapshot({ themeId: "B", actionLabel: "mid" }));

    expect(undoRedoManager.getNextRedoActionLabel()).toBe("first");
  });

  it("peekAtUndo returns the top of the undo stack", () => {
    const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
    const snap2 = makeSnapshot({ themeId: "B", actionLabel: "second" });
    const current = makeSnapshot({ themeId: "C", actionLabel: "current" });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.pushSnapshot(snap2);

    expect(undoRedoManager.peekAtUndo()?.actionLabel).toBe("second");
    undoRedoManager.undo(current);
    expect(undoRedoManager.peekAtUndo()?.actionLabel).toBe("first");
  });

  it("peekAtUndo returns null when the stack is empty", () => {
    expect(undoRedoManager.peekAtUndo()).toBeNull();
  });

  it("peekAtUndo returns null after an undo", () => {
    const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
    const current = makeSnapshot({ themeId: "C", actionLabel: "current" });

    undoRedoManager.pushSnapshot(snap1);

    expect(undoRedoManager.peekAtUndo()?.actionLabel).toBe("first");
    undoRedoManager.undo(current);
    expect(undoRedoManager.peekAtUndo()).toBeNull();
  });

  it("peekAtRedo returns the top of the Redo Stack", () => {
    const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
    const snap2 = makeSnapshot({ themeId: "B", actionLabel: "second" });
    const current = makeSnapshot({ themeId: "C", actionLabel: "current" });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.pushSnapshot(snap2);

    const undo1 = undoRedoManager.undo(current)!;
    const undo2 = undoRedoManager.undo(undo1)!;

    expect(undoRedoManager.peekAtRedo()?.actionLabel).toBe(undo2.actionLabel);
    undoRedoManager.redo(undo2);
    expect(undoRedoManager.peekAtRedo()?.actionLabel).toBe(undo1.actionLabel);
  });

  it("peekAtRedo returns null when the stack is empty", () => {
    expect(undoRedoManager.peekAtRedo()).toBeNull();
  });

  it("peekAtRedo returns null after a redo", () => {
    const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
    const current = makeSnapshot({ themeId: "C", actionLabel: "current" });

    undoRedoManager.pushSnapshot(snap1);
    undoRedoManager.undo(current);
    undoRedoManager.redo(snap1);

    expect(undoRedoManager.peekAtRedo()).toBeNull();
  });

  describe("replaceBlobUrl", () => {
    function makeSnapshotWithImage(
      tileId: string,
      src: string,
      actionLabel: string,
    ): Snapshot {
      return makeSnapshot({
        tiles: [
          {
            i: tileId,
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            borderEnabled: false,
            caption: "",
            content: {
              type: ContentType.IMAGE,
              src,
              zoom: 1,
              offsetX: 0,
              offsetY: 0,
            } as ImageContent,
          },
        ],
        actionLabel,
      });
    }

    it("replaces a blob URL in the undo stack", () => {
      const snap = makeSnapshotWithImage(
        "tile-img",
        "blob:http://localhost/abc",
        "Add image",
      );
      undoRedoManager.pushSnapshot(snap);

      undoRedoManager.replaceBlobUrl(
        "tile-img",
        "https://storage.example.com/photo.jpg",
      );

      const peeked = undoRedoManager.peekAtUndo()!;
      expect((peeked.tiles[0].content as ImageContent).src).toBe(
        "https://storage.example.com/photo.jpg",
      );
    });

    it("replaces a document stack item blob URL when documentItemId is passed", () => {
      const docContent: DocumentsContent = {
        type: ContentType.DOCUMENT,
        items: [
          {
            id: "item-a",
            fileName: "a.pdf",
            url: "blob:http://localhost/doc",
          },
        ],
      };
      const snap = makeSnapshot({
        tiles: [
          {
            i: "tile-doc",
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            borderEnabled: false,
            caption: "",
            content: docContent,
          },
        ],
        actionLabel: "Add documents",
      });
      undoRedoManager.pushSnapshot(snap);

      undoRedoManager.replaceBlobUrl(
        "tile-doc",
        "https://storage.example.com/a.pdf",
        "item-a",
      );

      const peeked = undoRedoManager.peekAtUndo()!;
      const items = (peeked.tiles[0].content as DocumentsContent).items;
      expect(items[0].url).toBe("https://storage.example.com/a.pdf");
    });

    it("replaces a blob URL in the redo stack", () => {
      const snap = makeSnapshot({
        verticalCompact: false,
        actionLabel: "some action",
      });
      const currentWithBlob = makeSnapshotWithImage(
        "tile-img",
        "blob:http://localhost/abc",
        "current",
      );

      undoRedoManager.pushSnapshot(snap);
      undoRedoManager.undo(currentWithBlob);

      undoRedoManager.replaceBlobUrl(
        "tile-img",
        "https://storage.example.com/photo.jpg",
      );

      const peeked = undoRedoManager.peekAtRedo()!;
      expect((peeked.tiles[0].content as ImageContent).src).toBe(
        "https://storage.example.com/photo.jpg",
      );
    });

    it("replaces blob URLs in both stacks simultaneously", () => {
      const snap1 = makeSnapshotWithImage(
        "tile-img",
        "blob:http://localhost/abc",
        "First image action",
      );
      const snap2 = makeSnapshot({
        verticalCompact: false,
        actionLabel: "Second action",
      });
      const currentWithBlob = makeSnapshotWithImage(
        "tile-img",
        "blob:http://localhost/abc",
        "current",
      );

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.undo(currentWithBlob);

      undoRedoManager.replaceBlobUrl(
        "tile-img",
        "https://storage.example.com/photo.jpg",
      );

      const undoPeeked = undoRedoManager.peekAtUndo()!;
      expect((undoPeeked.tiles[0].content as ImageContent).src).toBe(
        "https://storage.example.com/photo.jpg",
      );

      const redoPeeked = undoRedoManager.peekAtRedo()!;
      expect((redoPeeked.tiles[0].content as ImageContent).src).toBe(
        "https://storage.example.com/photo.jpg",
      );
    });

    it("does not replace a non-blob URL", () => {
      const snap = makeSnapshotWithImage(
        "tile-img",
        "https://example.com/already-uploaded.jpg",
        "Add image",
      );
      undoRedoManager.pushSnapshot(snap);

      undoRedoManager.replaceBlobUrl(
        "tile-img",
        "https://storage.example.com/new.jpg",
      );

      const peeked = undoRedoManager.peekAtUndo()!;
      expect((peeked.tiles[0].content as ImageContent).src).toBe(
        "https://example.com/already-uploaded.jpg",
      );
    });

    it("does not modify tiles with non-matching IDs", () => {
      const snap = makeSnapshotWithImage(
        "tile-img",
        "blob:http://localhost/abc",
        "Add image",
      );
      undoRedoManager.pushSnapshot(snap);

      undoRedoManager.replaceBlobUrl(
        "different-tile",
        "https://storage.example.com/photo.jpg",
      );

      const peeked = undoRedoManager.peekAtUndo()!;
      expect((peeked.tiles[0].content as ImageContent).src).toBe(
        "blob:http://localhost/abc",
      );
    });

    it("handles tiles without a src field", () => {
      const snap = makeSnapshot({ actionLabel: "Add text tile" });
      undoRedoManager.pushSnapshot(snap);

      expect(() => {
        undoRedoManager.replaceBlobUrl(
          "tile-1",
          "https://storage.example.com/photo.jpg",
        );
      }).not.toThrow();

      const peeked = undoRedoManager.peekAtUndo()!;
      expect(peeked.tiles[0].content).not.toHaveProperty("src");
    });

    it("does not add a src property to a matching tile that lacks one", () => {
      const snap = makeSnapshot({
        tiles: [
          {
            i: "tile-text",
            x: 0,
            y: 0,
            w: 2,
            h: 2,
            borderEnabled: false,
            caption: "",
            content: {
              type: ContentType.TEXT,
              text: "Hello world",
              font: "Inter",
              fontSize: 16,
              isBold: false,
              isItalic: false,
              textType: "paragraph",
              color: "#000000",
            } as TileContent,
          },
        ],
        actionLabel: "Add text tile",
      });
      undoRedoManager.pushSnapshot(snap);

      undoRedoManager.replaceBlobUrl(
        "tile-text",
        "https://storage.example.com/photo.jpg",
      );

      const peeked = undoRedoManager.peekAtUndo()!;
      expect(peeked.tiles[0].content).not.toHaveProperty("src");
    });

    it("handles empty stacks without error", () => {
      expect(() => {
        undoRedoManager.replaceBlobUrl(
          "tile-img",
          "https://storage.example.com/photo.jpg",
        );
      }).not.toThrow();
    });
  });

  describe("snapshot metadata (snapshotId and timestamp)", () => {
    it("assigns unique snapshotIds to pushed snapshots", () => {
      const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
      const snap2 = makeSnapshot({ themeId: "B", actionLabel: "second" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);

      const stacks = undoRedoManager.getStacks();
      const ids = stacks.undoStack.map((s) => s.snapshotId);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it("assigns a timestamp to pushed snapshots", () => {
      const now = 1700000000000;
      vi.spyOn(Date, "now").mockReturnValue(now);

      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "A", actionLabel: "first" }),
      );

      const stacks = undoRedoManager.getStacks();
      expect(stacks.undoStack[0].timestamp).toBe(now);

      vi.restoreAllMocks();
    });

    it("strips snapshotId and timestamp from undo return value", () => {
      const snap = makeSnapshot({ actionLabel: "action" });
      const current = makeSnapshot({
        verticalCompact: false,
        actionLabel: "current",
      });

      undoRedoManager.pushSnapshot(snap);
      const result = undoRedoManager.undo(current)!;

      expect(result).not.toHaveProperty("snapshotId");
      expect(result).not.toHaveProperty("timestamp");
      expect(result).toStrictEqual(snap);
    });

    it("strips snapshotId and timestamp from redo return value", () => {
      const snap = makeSnapshot({ actionLabel: "action" });
      const current = makeSnapshot({
        verticalCompact: false,
        actionLabel: "current",
      });

      undoRedoManager.pushSnapshot(snap);
      undoRedoManager.undo(current);
      const result = undoRedoManager.redo(snap)!;

      expect(result).not.toHaveProperty("snapshotId");
      expect(result).not.toHaveProperty("timestamp");
    });

    it("preserves snapshotId and timestamp when moving between stacks via undo", () => {
      const snap = makeSnapshot({ themeId: "A", actionLabel: "action" });
      const current = makeSnapshot({
        themeId: "B",
        actionLabel: "current",
      });

      undoRedoManager.pushSnapshot(snap);
      const beforeUndo = undoRedoManager.getStacks();
      const originalId = beforeUndo.undoStack[0].snapshotId;
      const originalTimestamp = beforeUndo.undoStack[0].timestamp;

      undoRedoManager.undo(current);
      const afterUndo = undoRedoManager.getStacks();

      expect(afterUndo.redoStack[0].snapshotId).toBe(originalId);
      expect(afterUndo.redoStack[0].timestamp).toBe(originalTimestamp);
    });

    it("preserves snapshotId and timestamp when moving between stacks via redo", () => {
      const snap = makeSnapshot({ themeId: "A", actionLabel: "action" });
      const current = makeSnapshot({
        themeId: "B",
        actionLabel: "current",
      });

      undoRedoManager.pushSnapshot(snap);
      undoRedoManager.undo(current);

      const beforeRedo = undoRedoManager.getStacks();
      const redoId = beforeRedo.redoStack[0].snapshotId;
      const redoTimestamp = beforeRedo.redoStack[0].timestamp;

      undoRedoManager.redo(snap);
      const afterRedo = undoRedoManager.getStacks();

      expect(afterRedo.undoStack[0].snapshotId).toBe(redoId);
      expect(afterRedo.undoStack[0].timestamp).toBe(redoTimestamp);
    });

    it("increments snapshotId across pushes, not reusing IDs", () => {
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "A", actionLabel: "first" }),
      );
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "B", actionLabel: "second" }),
      );
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "C", actionLabel: "third" }),
      );

      const stacks = undoRedoManager.getStacks();
      const ids = stacks.undoStack.map((s) => s.snapshotId);
      expect(ids[0]).toBeLessThan(ids[1]);
      expect(ids[1]).toBeLessThan(ids[2]);
    });
  });

  describe("getStacks", () => {
    it("returns empty stacks initially", () => {
      const stacks = undoRedoManager.getStacks();
      expect(stacks.undoStack).toStrictEqual([]);
      expect(stacks.redoStack).toStrictEqual([]);
    });

    it("returns only actionLabel, timestamp, and snapshotId for each entry", () => {
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "A", actionLabel: "first" }),
      );

      const stacks = undoRedoManager.getStacks();
      const entry = stacks.undoStack[0];
      const keys = Object.keys(entry).sort();
      expect(keys).toStrictEqual(["actionLabel", "snapshotId", "timestamp"]);
    });

    it("reflects the undo stack after multiple pushes", () => {
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "A", actionLabel: "first" }),
      );
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "B", actionLabel: "second" }),
      );
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "C", actionLabel: "third" }),
      );

      const stacks = undoRedoManager.getStacks();
      expect(stacks.undoStack).toHaveLength(3);
      expect(stacks.undoStack.map((s) => s.actionLabel)).toStrictEqual([
        "first",
        "second",
        "third",
      ]);
      expect(stacks.redoStack).toHaveLength(0);
    });

    it("reflects both stacks after undo operations", () => {
      const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
      const snap2 = makeSnapshot({ themeId: "B", actionLabel: "second" });
      const current = makeSnapshot({ themeId: "C", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.undo(current);

      const stacks = undoRedoManager.getStacks();
      expect(stacks.undoStack).toHaveLength(1);
      expect(stacks.undoStack[0].actionLabel).toBe("first");
      expect(stacks.redoStack).toHaveLength(1);
      expect(stacks.redoStack[0].actionLabel).toBe("second");
    });

    it("returns empty stacks after clear", () => {
      undoRedoManager.pushSnapshot(
        makeSnapshot({ themeId: "A", actionLabel: "first" }),
      );
      undoRedoManager.clear();

      const stacks = undoRedoManager.getStacks();
      expect(stacks.undoStack).toStrictEqual([]);
      expect(stacks.redoStack).toStrictEqual([]);
    });

    it("does not expose tile data or other snapshot fields", () => {
      undoRedoManager.pushSnapshot(makeSnapshot({ actionLabel: "action" }));

      const stacks = undoRedoManager.getStacks();
      const entry = stacks.undoStack[0];
      expect(entry).not.toHaveProperty("tiles");
      expect(entry).not.toHaveProperty("overrides");
      expect(entry).not.toHaveProperty("themeId");
      expect(entry).not.toHaveProperty("verticalCompact");
      expect(entry).not.toHaveProperty("backgroundImageSrc");
      expect(entry).not.toHaveProperty("backgroundEmbed");
      expect(entry).not.toHaveProperty("forcedBreakpoint");
    });
  });

  describe("undoRedoUntil", () => {
    // Equivalence classes:
    // - snapshotId not found in either stack → null
    // - snapshotId found in undo stack (bulk undo): top, middle, bottom
    // - snapshotId found in redo stack (bulk redo): top, middle, bottom
    // - round-trip: bulk undo then bulk redo back to verify jumping through history
    // - stack integrity: after bulk undo, redo stack contains all skipped entries

    it("returns null when snapshotId is not found in either stack", () => {
      const snap1 = makeSnapshot({ themeId: "A", actionLabel: "first" });
      undoRedoManager.pushSnapshot(snap1);

      const current = makeSnapshot({ themeId: "B", actionLabel: "current" });
      const result = undoRedoManager.undoRedoUntil(9999, current);

      expect(result).toBeNull();
    });

    it("returns null when both stacks are empty", () => {
      const current = makeSnapshot({ themeId: "A", actionLabel: "current" });
      const result = undoRedoManager.undoRedoUntil(1, current);

      expect(result).toBeNull();
    });

    it("bulk undoes to the target snapshot in the middle of the undo stack", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const current = makeSnapshot({ themeId: "theme-4", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.pushSnapshot(snap3);

      const snap2Id = undoRedoManager.getStacks().undoStack[1].snapshotId;
      const result = undoRedoManager.undoRedoUntil(snap2Id, current);

      expect(result).not.toBeNull();
      expect(result!.themeId).toBe("theme-2");
    });

    it("bulk undoes to the bottom of the undo stack (undoes everything)", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const current = makeSnapshot({ themeId: "theme-4", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.pushSnapshot(snap3);

      const snap1Id = undoRedoManager.getStacks().undoStack[0].snapshotId;
      const result = undoRedoManager.undoRedoUntil(snap1Id, current);

      expect(result).not.toBeNull();
      expect(result!.themeId).toBe("theme-1");
      expect(undoRedoManager.canUndo()).toBe(false);
    });

    it("undoes only once when target is at the top of the undo stack", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const current = makeSnapshot({ themeId: "theme-3", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);

      const snap2Id = undoRedoManager.getStacks().undoStack[1].snapshotId;
      const result = undoRedoManager.undoRedoUntil(snap2Id, current);

      expect(result).not.toBeNull();
      expect(result!.themeId).toBe("theme-2");
      expect(undoRedoManager.canUndo()).toBe(true);
      expect(undoRedoManager.getLastActionLabel()).toBe("Set theme 1");
    });

    it("moves all skipped snapshots to the redo stack after bulk undo", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const snap4 = makeSnapshot({ themeId: "theme-4", actionLabel: "Set theme 4" });
      const current = makeSnapshot({ themeId: "theme-5", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.pushSnapshot(snap3);
      undoRedoManager.pushSnapshot(snap4);

      const snap2Id = undoRedoManager.getStacks().undoStack[1].snapshotId;
      undoRedoManager.undoRedoUntil(snap2Id, current);

      const stacks = undoRedoManager.getStacks();
      expect(stacks.undoStack).toHaveLength(1);
      expect(stacks.undoStack[0].actionLabel).toBe("Set theme 1");
      expect(stacks.redoStack).toHaveLength(3);
      expect(stacks.redoStack.map((s) => s.actionLabel)).toStrictEqual([
        "Set theme 4",
        "Set theme 3",
        "Set theme 2",
      ]);
    });

    it("bulk redoes to the target snapshot in the redo stack", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const current = makeSnapshot({ themeId: "theme-4", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.pushSnapshot(snap3);

      // Undo all three to populate the redo stack
      // Redo stack (bottom→top): [{theme-4, snap3Id}, {theme-3, snap2Id}, {theme-2, snap1Id}]
      const afterUndo3 = undoRedoManager.undo(current)!;
      const afterUndo2 = undoRedoManager.undo(afterUndo3)!;
      const afterUndo1 = undoRedoManager.undo(afterUndo2)!;
      expect(undoRedoManager.canUndo()).toBe(false);

      // Target snap2Id (index 1) — redo pops from top, so 2 redo calls
      // redo(theme-1) → returns theme-2; redo(theme-2) → returns theme-3
      const redoStacks = undoRedoManager.getStacks();
      const targetId = redoStacks.redoStack[1].snapshotId;

      const result = undoRedoManager.undoRedoUntil(targetId, afterUndo1);

      expect(result).not.toBeNull();
      expect(result!.themeId).toBe("theme-3");
    });

    it("redoes only once when target is at the top of the redo stack", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const current = makeSnapshot({ themeId: "theme-3", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);

      const afterUndo2 = undoRedoManager.undo(current)!;
      const afterUndo1 = undoRedoManager.undo(afterUndo2)!;

      const topRedoId = undoRedoManager.getStacks().redoStack[1].snapshotId;
      const result = undoRedoManager.undoRedoUntil(topRedoId, afterUndo1);

      expect(result).not.toBeNull();
      expect(result!.themeId).toBe("theme-2");
      expect(undoRedoManager.canRedo()).toBe(true);
    });

    it("bulk redoes to the bottom of the redo stack (redoes everything)", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const current = makeSnapshot({ themeId: "theme-4", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.pushSnapshot(snap3);

      const afterUndo3 = undoRedoManager.undo(current)!;
      const afterUndo2 = undoRedoManager.undo(afterUndo3)!;
      const afterUndo1 = undoRedoManager.undo(afterUndo2)!;

      // Target the bottom of the redo stack (first entry, index 0)
      const bottomRedoId = undoRedoManager.getStacks().redoStack[0].snapshotId;
      const result = undoRedoManager.undoRedoUntil(bottomRedoId, afterUndo1);

      expect(result).not.toBeNull();
      expect(result!.themeId).toBe("theme-4");
      expect(undoRedoManager.canRedo()).toBe(false);
    });

    it("round-trip: bulk undo to an old version, then bulk redo back to a recent version", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const snap4 = makeSnapshot({ themeId: "theme-4", actionLabel: "Set theme 4" });
      const current = makeSnapshot({ themeId: "theme-5", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.pushSnapshot(snap3);
      undoRedoManager.pushSnapshot(snap4);

      const stacks = undoRedoManager.getStacks();
      const snap1Id = stacks.undoStack[0].snapshotId;
      const snap3Id = stacks.undoStack[2].snapshotId;

      // Jump back to snap1 (undoes 4 entries)
      const jumped = undoRedoManager.undoRedoUntil(snap1Id, current)!;
      expect(jumped.themeId).toBe("theme-1");
      expect(undoRedoManager.canUndo()).toBe(false);
      expect(undoRedoManager.canRedo()).toBe(true);

      // Jump forward to snap3's redo entry (index 1 from bottom)
      // Redo stack after full undo (bottom→top):
      //   [{theme-5, snap4Id}, {theme-4, snap3Id}, {theme-3, snap2Id}, {theme-2, snap1Id}]
      // snap3Id is at index 1, count = 4-1 = 3 redos
      // redo(theme-1)→theme-2, redo(theme-2)→theme-3, redo(theme-3)→theme-4
      const jumpedForward = undoRedoManager.undoRedoUntil(snap3Id, jumped)!;
      expect(jumpedForward.themeId).toBe("theme-4");
      expect(undoRedoManager.canUndo()).toBe(true);
      expect(undoRedoManager.canRedo()).toBe(true);
    });

    it("round-trip: can jump back again after jumping forward", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const current = makeSnapshot({ themeId: "theme-4", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);
      undoRedoManager.pushSnapshot(snap3);

      const stacks = undoRedoManager.getStacks();
      const snap1Id = stacks.undoStack[0].snapshotId;
      const snap2Id = stacks.undoStack[1].snapshotId;

      // Jump back to snap1 (3 undos)
      const jumped = undoRedoManager.undoRedoUntil(snap1Id, current)!;
      expect(jumped.themeId).toBe("theme-1");

      // Jump forward to snap2's redo entry
      // Redo stack (bottom→top): [{theme-4, snap3Id}, {theme-3, snap2Id}, {theme-2, snap1Id}]
      // snap2Id is at index 1, count = 3-1 = 2 redos
      // redo(theme-1)→theme-2, redo(theme-2)→theme-3
      const jumpedForward = undoRedoManager.undoRedoUntil(snap2Id, jumped)!;
      expect(jumpedForward.themeId).toBe("theme-3");

      // Jump back to snap1 again
      const jumpedBack = undoRedoManager.undoRedoUntil(snap1Id, jumpedForward)!;
      expect(jumpedBack.themeId).toBe("theme-1");
      expect(undoRedoManager.canUndo()).toBe(false);
    });

    it("strips snapshotId and timestamp from the returned snapshot", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const current = makeSnapshot({ themeId: "theme-3", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);

      const snap1Id = undoRedoManager.getStacks().undoStack[0].snapshotId;
      const result = undoRedoManager.undoRedoUntil(snap1Id, current)!;

      expect(result).not.toHaveProperty("snapshotId");
      expect(result).not.toHaveProperty("timestamp");
    });

    it("calls onChanged for each intermediate undo step", () => {
      const onChanged = vi.fn();
      const manager = new UndoRedoManager(onChanged);

      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const snap3 = makeSnapshot({ themeId: "theme-3", actionLabel: "Set theme 3" });
      const current = makeSnapshot({ themeId: "theme-4", actionLabel: "current" });

      manager.pushSnapshot(snap1);
      manager.pushSnapshot(snap2);
      manager.pushSnapshot(snap3);
      onChanged.mockClear();

      const snap1Id = manager.getStacks().undoStack[0].snapshotId;
      manager.undoRedoUntil(snap1Id, current);

      // Should have been called 3 times (once per undo call)
      expect(onChanged).toHaveBeenCalledTimes(3);
    });

    it("does not modify the undo stack when target is in the redo stack", () => {
      const snap1 = makeSnapshot({ themeId: "theme-1", actionLabel: "Set theme 1" });
      const snap2 = makeSnapshot({ themeId: "theme-2", actionLabel: "Set theme 2" });
      const current = makeSnapshot({ themeId: "theme-3", actionLabel: "current" });

      undoRedoManager.pushSnapshot(snap1);
      undoRedoManager.pushSnapshot(snap2);

      // Undo both to move them to redo
      const afterUndo2 = undoRedoManager.undo(current)!;
      const afterUndo1 = undoRedoManager.undo(afterUndo2)!;
      expect(undoRedoManager.canUndo()).toBe(false);

      // Redo until the bottom entry (snap1's ID, which holds the current state from when snap1 was undone)
      const bottomRedoId = undoRedoManager.getStacks().redoStack[0].snapshotId;
      undoRedoManager.undoRedoUntil(bottomRedoId, afterUndo1);

      // All entries should now be on the undo stack
      expect(undoRedoManager.canUndo()).toBe(true);
      expect(undoRedoManager.canRedo()).toBe(false);
    });
  });
});
