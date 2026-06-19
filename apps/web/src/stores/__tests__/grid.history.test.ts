import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type ImageContent,
  type TextContent,
  type Tile,
} from "@grids/contracts/types";
import type { Snapshot } from "@/undo/UndoTypes";
import {
  createLoadedGridStore,
  gridHarness,
  makeGrid,
  makeTile,
  resetGridHarness,
} from "./gridTestHarness";

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    tiles: [makeTile()],
    overrides: {},
    verticalCompact: true,
    themeId: "theme-a",
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    forcedBreakpoint: "lg",
    actionLabel: "Snapshot",
    ...overrides,
  };
}

describe("grid store history orchestration", () => {
  beforeEach(() => {
    resetGridHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures a deep snapshot with resolved optimistic URLs", async () => {
    const media = makeTile({
      i: "media",
      content: {
        type: ContentType.IMAGE,
        src: "blob:media",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      } as ImageContent,
    });
    const document = makeTile({
      i: "document",
      content: {
        type: ContentType.DOCUMENT,
        items: [
          { id: "resolved", fileName: "one.pdf", url: "blob:one" },
          { id: "pending", fileName: "two.pdf", url: "blob:two" },
        ],
      } as DocumentsContent,
    });
    const grid = makeGrid({
      tiles: [media, document],
      overrides: {
        md: {
          media: { x: 1, y: 2, w: 3, h: 4 },
        },
      },
      verticalCompact: false,
      themeId: "theme-b",
      backgroundImageSrc: "background",
      backgroundEmbed: true,
      backgroundColor: "#123456",
      ogImageSrc: "https://cdn/og.png",
    });
    const store = await createLoadedGridStore(grid);
    store.forcedBreakpoint = "md";
    store.resolvedUrls.media = "https://cdn/media";
    store.resolvedDocumentItemUrls.document = {
      resolved: "https://cdn/one",
    };

    const snapshot = store.captureSnapshot("Before change");

    expect(snapshot).toEqual({
      tiles: [
        expect.objectContaining({
          i: "media",
          content: expect.objectContaining({ src: "https://cdn/media" }),
        }),
        expect.objectContaining({
          i: "document",
          content: expect.objectContaining({
            items: [
              expect.objectContaining({ url: "https://cdn/one" }),
              expect.objectContaining({ url: "blob:two" }),
            ],
          }),
        }),
      ],
      overrides: grid.overrides,
      verticalCompact: false,
      themeId: "theme-b",
      backgroundImageSrc: "background",
      backgroundEmbed: true,
      backgroundColor: "#123456",
      ogImageSrc: "https://cdn/og.png",
      forcedBreakpoint: "md",
      actionLabel: "Before change",
    });
    expect(snapshot?.tiles).not.toBe(store.currentGrid?.tiles);
    expect(snapshot?.tiles[0]?.content).not.toBe(
      store.currentGrid?.tiles[0]?.content,
    );
  });

  it("returns null when capturing without an active grid", async () => {
    const store = await createLoadedGridStore();
    store.currentGrid = null;

    expect(store.captureSnapshot("No grid")).toBeNull();
  });

  it("pushes pre-mutation snapshots and exposes history metadata getters", async () => {
    const store = await createLoadedGridStore();

    store.pushUndoSnapshot("Change one");

    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
    expect(store.undoActionLabel).toBe("Change one");
    expect(store.redoActionLabel).toBeNull();
    expect(store.undoRedoStacks.undoStack).toEqual([
      {
        actionLabel: "Change one",
        timestamp: 1,
        snapshotId: 1,
      },
    ]);
    expect(store.undoRedoVersion).toBeGreaterThan(0);
  });

  it("applies a same-breakpoint snapshot immediately and persists once", async () => {
    const store = await createLoadedGridStore();
    store.forcedBreakpoint = "lg";
    const replacementTile = makeTile({
      x: 7,
      content: {
        type: ContentType.TEXT,
        text: "Restored",
        font: "Inter",
        fontSize: 16,
        isBold: false,
        isItalic: false,
        textType: "paragraph",
        color: "#000000",
      } as TextContent,
    });

    const snapshot = makeSnapshot({
      tiles: [replacementTile],
      overrides: {
        md: {
          "tile-1": { x: 1, y: 1, w: 3, h: 3 },
        },
      },
      verticalCompact: false,
      themeId: "theme-b",
      backgroundImageSrc: "restored-background",
      backgroundEmbed: true,
      backgroundColor: "#abcdef",
      ogImageSrc: "restored-og-image",
      forcedBreakpoint: "lg",
    });

    await store.applySnapshot(snapshot);

    expect(store.currentGrid).toEqual(
      expect.objectContaining({
        tiles: [replacementTile],
        overrides: {
          md: {
            "tile-1": { x: 1, y: 1, w: 3, h: 3 },
          },
        },
        verticalCompact: false,
        themeId: "theme-b",
        backgroundImageSrc: "restored-background",
        backgroundEmbed: true,
        backgroundColor: "#abcdef",
        ogImageSrc: "restored-og-image",
      }),
    );
    expect(store.currentGrid?.tiles).not.toBe(snapshot.tiles);
    expect(store.currentGrid?.tiles[0]?.content).not.toBe(
      snapshot.tiles[0]?.content,
    );
    snapshot.tiles[0]!.caption = "Snapshot mutated after apply";
    expect(store.currentGrid?.tiles[0]?.caption).not.toBe(
      "Snapshot mutated after apply",
    );
    expect(gridHarness.themeStore.setTheme).toHaveBeenCalledWith("theme-b");
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
    expect(store.undoRedoVersion).toBeGreaterThan(0);
  });

  it("switches breakpoint immediately but waits 500 ms before applying history", async () => {
    vi.useFakeTimers();
    const store = await createLoadedGridStore();
    store.forcedBreakpoint = "lg";
    const snapshot = makeSnapshot({
      forcedBreakpoint: "sm",
      verticalCompact: false,
      tiles: [makeTile({ x: 9 })],
    });

    const applying = store.applySnapshot(snapshot);

    expect(store.forcedBreakpoint).toBe("sm");
    expect(store.currentGrid?.verticalCompact).toBe(true);
    expect(store.currentGrid?.tiles[0]?.x).toBe(0);
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(499);
    expect(store.currentGrid?.verticalCompact).toBe(true);
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await applying;

    expect(store.currentGrid?.verticalCompact).toBe(false);
    expect(store.currentGrid?.tiles[0]?.x).toBe(9);
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("preserves the 500 ms transition through cross-breakpoint undo and redo", async () => {
    vi.useFakeTimers();
    const store = await createLoadedGridStore();
    store.forcedBreakpoint = "lg";
    store.pushUndoSnapshot("Cross breakpoint edit");
    store.currentGrid!.tiles[0]!.caption = "After";
    store.forcedBreakpoint = "sm";
    gridHarness.gridService.queueSave.mockClear();

    const undoing = store.undo();

    expect(store.forcedBreakpoint).toBe("lg");
    expect(store.currentGrid?.tiles[0]?.caption).toBe("After");
    await vi.advanceTimersByTimeAsync(499);
    expect(store.currentGrid?.tiles[0]?.caption).toBe("After");
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await undoing;
    expect(store.currentGrid?.tiles[0]?.caption).toBe("");
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);

    const redoing = store.redo();

    expect(store.forcedBreakpoint).toBe("sm");
    expect(store.currentGrid?.tiles[0]?.caption).toBe("");
    await vi.advanceTimersByTimeAsync(499);
    expect(store.currentGrid?.tiles[0]?.caption).toBe("");
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await redoing;
    expect(store.currentGrid?.tiles[0]?.caption).toBe("After");
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(2);
  });

  it("undoes and redoes by capturing current state before applying history", async () => {
    const store = await createLoadedGridStore();
    store.forcedBreakpoint = "lg";
    store.pushUndoSnapshot("Change text");
    store.currentGrid!.tiles[0]!.caption = "After";
    gridHarness.gridService.queueSave.mockClear();

    await store.undo();

    expect(store.currentGrid?.tiles[0]?.caption).toBe("");
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(true);
    expect(store.redoActionLabel).toBe("Change text");
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);

    await store.redo();

    expect(store.currentGrid?.tiles[0]?.caption).toBe("After");
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(2);
  });

  it("restores the custom OG image through undo and redo", async () => {
    const store = await createLoadedGridStore(
      makeGrid({ ogImageSrc: "https://cdn.example/before.png" }),
    );
    store.forcedBreakpoint = "lg";
    store.pushUndoSnapshot("Change social share image");
    store.currentGrid!.ogImageSrc = "https://cdn.example/after.png";
    gridHarness.gridService.queueSave.mockClear();

    await store.undo();

    expect(store.currentGrid?.ogImageSrc).toBe(
      "https://cdn.example/before.png",
    );

    await store.redo();

    expect(store.currentGrid?.ogImageSrc).toBe(
      "https://cdn.example/after.png",
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(2);
  });

  it("applies the selected multi-step history result", async () => {
    const store = await createLoadedGridStore();
    store.forcedBreakpoint = "lg";
    store.currentGrid!.name = "Unchanged metadata";
    store.currentGrid!.tiles[0]!.caption = "one";
    store.pushUndoSnapshot("First");
    store.currentGrid!.tiles[0]!.caption = "two";
    store.pushUndoSnapshot("Second");
    store.currentGrid!.tiles[0]!.caption = "three";
    gridHarness.gridService.queueSave.mockClear();

    await store.undoRedoUntil(1);

    expect(gridHarness.undoManagers[0]?.undoRedoUntil).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        tiles: [
          expect.objectContaining({
            caption: "three",
          }),
        ],
      }),
    );
    expect(store.currentGrid?.tiles[0]?.caption).toBe("one");
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("records one edit history entry only when the transaction changed", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];

    store.beginEditing("tile-1");
    store.beginEditing("another-tile");
    store.commitEditing();
    expect(manager?.pushSnapshot).not.toHaveBeenCalled();

    store.beginEditing("tile-1");
    store.currentGrid!.tiles[0]!.caption = "Changed";
    store.commitEditing();

    expect(manager?.pushSnapshot).toHaveBeenCalledTimes(1);
    expect(manager?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        actionLabel: "Edit tile",
        tiles: [expect.objectContaining({ caption: "" })],
      }),
    );
  });

  it("records one desktop move transaction and persists once at commit", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];

    store.beginMove();
    store.beginMove();
    store.currentGrid!.tiles[0]!.x = 5;
    store.commitMove();

    expect(manager?.pushSnapshot).toHaveBeenCalledTimes(1);
    expect(manager?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        actionLabel: "Move tile",
        tiles: [expect.objectContaining({ x: 0 })],
      }),
    );
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("refreshes the stable snapshot used by the next move transaction", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0]!;
    store.currentGrid!.tiles[0]!.x = 3;
    store.refreshStableSnapshot();
    store.currentGrid!.tiles[0]!.x = 7;
    manager.pushSnapshot.mockClear();

    store.beginMove();
    store.commitMove();

    expect(manager.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        actionLabel: "Move tile",
        tiles: [expect.objectContaining({ x: 3 })],
      }),
    );
  });

  it("records one non-desktop resize transaction and captures rendered overrides", async () => {
    const store = await createLoadedGridStore();
    const manager = gridHarness.undoManagers[0];
    store.activeBreakpoint = "md";
    store.setDisplayPositions([
      { i: "tile-1", x: 1, y: 2, w: 4, h: 5 },
    ]);

    store.beginResize();
    store.beginResize();
    store.commitResize();

    expect(manager?.pushSnapshot).toHaveBeenCalledTimes(1);
    expect(manager?.pushSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ actionLabel: "Resize tile" }),
    );
    expect(store.currentGrid?.overrides?.md).toEqual({
      "tile-1": { x: 1, y: 2, w: 4, h: 5 },
    });
    expect(gridHarness.gridService.queueSave).toHaveBeenCalledTimes(1);
  });

  it("no-ops undo, redo, and snapshot application without required state", async () => {
    const store = await createLoadedGridStore();
    const originalTiles = store.currentGrid?.tiles;

    await store.undo();
    await store.redo();
    await store.undoRedoUntil(99);
    store.currentGrid = null;
    await store.applySnapshot(makeSnapshot());

    expect(originalTiles).toBeDefined();
    expect(gridHarness.gridService.queueSave).not.toHaveBeenCalled();
  });

  it("captures forced breakpoint context from the active breakpoint fallback", async () => {
    const store = await createLoadedGridStore();
    store.forcedBreakpoint = null;
    store.activeBreakpoint = "md";

    expect(store.captureSnapshot("Breakpoint")).toEqual(
      expect.objectContaining({ forcedBreakpoint: "md" }),
    );
  });

  it("does not share snapshot tile references with canonical state", async () => {
    const tile: Tile = makeTile();
    const store = await createLoadedGridStore(makeGrid({ tiles: [tile] }));

    const snapshot = store.captureSnapshot("Copy");
    snapshot!.tiles[0]!.caption = "Snapshot only";

    expect(store.currentGrid?.tiles[0]?.caption).toBe("");
  });
});
