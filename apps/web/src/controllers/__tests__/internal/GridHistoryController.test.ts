import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Breakpoint, Grid } from "@grids/contracts/types";
import { GridHistoryController } from "../../internal/GridHistoryController";
import {
  createHarness,
  makeGrid,
  makeSnapshot,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridHistoryController — captures/applies undo snapshots through the
 * history store and snapshot codec, coordinating forced-breakpoint transitions,
 * theme application, and save scheduling via injected collaborators.
 */

type SetForcedBreakpoint = (
  breakpoint: Breakpoint | null,
  grid: Grid | null,
  resolvedUrls: Readonly<Record<string, string>>,
  resolvedDocumentItemUrls: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >,
) => void;

type ScheduleSave = (
  resolvedUrls?: Record<string, string>,
  resolvedDocumentItemUrls?: Record<string, Record<string, string>>,
) => void;

describe("GridHistoryController", () => {
  let h: InternalHarness;
  let setForcedBreakpoint: Mock<SetForcedBreakpoint>;
  let waitForLayoutReady: Mock<(breakpoint: Breakpoint) => Promise<void>>;
  let commitGestureGeometry: Mock<() => void>;
  let scheduleSave: Mock<ScheduleSave>;
  let controller: GridHistoryController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    setForcedBreakpoint = vi.fn<SetForcedBreakpoint>();
    waitForLayoutReady = vi.fn<(breakpoint: Breakpoint) => Promise<void>>(
      async () => undefined,
    );
    commitGestureGeometry = vi.fn<() => void>();
    scheduleSave = vi.fn<ScheduleSave>();
    controller = new GridHistoryController(
      h.stores,
      h.dependencies,
      setForcedBreakpoint,
      waitForLayoutReady,
      commitGestureGeometry,
      scheduleSave,
    );
    h.stores.history.initializeManager();
  });

  function seedGrid() {
    const grid = makeGrid();
    h.stores.session.setCurrentGrid(grid);
    return grid;
  }

  describe("captureSnapshot", () => {
    it("returns null when there is no current grid", () => {
      expect(controller.captureSnapshot("x")).toBeNull();
    });

    it("captures at the forced breakpoint when one is set", () => {
      seedGrid();
      h.stores.viewport.setForcedBreakpoint("sm");
      const capture = vi.spyOn(h.dependencies.snapshotCodec, "capture");

      controller.captureSnapshot("Label");

      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ breakpoint: "sm", actionLabel: "Label" }),
      );
    });

    it("falls back to the active breakpoint with no forced breakpoint", () => {
      seedGrid();
      h.stores.viewport.setActiveBreakpoint("md");
      const capture = vi.spyOn(h.dependencies.snapshotCodec, "capture");

      controller.captureSnapshot("Label");

      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ breakpoint: "md" }),
      );
    });

    it("defaults the resolved url maps from the uploads store", () => {
      seedGrid();
      h.stores.uploads.setResolvedUrl("tile-1", "https://cdn/img.png");
      h.stores.uploads.setResolvedDocumentItemUrl(
        "tile-doc",
        "item-1",
        "https://cdn/doc.pdf",
      );
      const capture = vi.spyOn(h.dependencies.snapshotCodec, "capture");

      controller.captureSnapshot("Label");

      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedUrls: { "tile-1": "https://cdn/img.png" },
          resolvedDocumentItemUrls: {
            "tile-doc": { "item-1": "https://cdn/doc.pdf" },
          },
        }),
      );
    });
  });

  describe("pushUndoSnapshot", () => {
    it("pushes a snapshot and refreshes the stable snapshot", () => {
      seedGrid();
      const push = vi.spyOn(h.stores.history, "pushSnapshot");

      controller.pushUndoSnapshot("Edit");

      expect(push).toHaveBeenCalledTimes(1);
      expect(h.stores.history.stableSnapshot).not.toBeNull();
    });

    it("does nothing when no snapshot can be captured", () => {
      // No grid → captureSnapshot returns null.
      const push = vi.spyOn(h.stores.history, "pushSnapshot");
      controller.pushUndoSnapshot("Edit");
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("undo / redo / undoRedoUntil guards", () => {
    it("undo does nothing without a current snapshot", async () => {
      const undo = vi.spyOn(h.stores.history, "undo");
      await controller.undo();
      expect(undo).not.toHaveBeenCalled();
    });

    it("undo does nothing when the store has nothing to undo", async () => {
      seedGrid();
      await controller.undo();
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("redo does nothing without a current snapshot", async () => {
      const redo = vi.spyOn(h.stores.history, "redo");
      await controller.redo();
      expect(redo).not.toHaveBeenCalled();
    });

    it("undoRedoUntil does nothing without a current snapshot", async () => {
      const jump = vi.spyOn(h.stores.history, "undoRedoUntil");
      await controller.undoRedoUntil(1);
      expect(jump).not.toHaveBeenCalled();
    });

    it("undo applies the snapshot the store returns", async () => {
      seedGrid();
      const target = makeSnapshot({ themeId: "theme-a" });
      vi.spyOn(h.stores.history, "undo").mockReturnValue(target);
      const apply = vi.spyOn(h.dependencies.snapshotCodec, "apply");

      await controller.undo();

      expect(apply).toHaveBeenCalledTimes(1);
      expect(scheduleSave).toHaveBeenCalled();
    });

    it("redo applies the snapshot the store returns", async () => {
      seedGrid();
      const target = makeSnapshot({ themeId: "theme-a" });
      vi.spyOn(h.stores.history, "redo").mockReturnValue(target);
      const apply = vi.spyOn(h.dependencies.snapshotCodec, "apply");

      await controller.redo();

      expect(apply).toHaveBeenCalledTimes(1);
      expect(scheduleSave).toHaveBeenCalled();
    });

    it("undoRedoUntil forwards the target id and applies the result", async () => {
      seedGrid();
      const target = makeSnapshot({ themeId: "theme-a" });
      const jump = vi
        .spyOn(h.stores.history, "undoRedoUntil")
        .mockReturnValue(target);
      const apply = vi.spyOn(h.dependencies.snapshotCodec, "apply");

      await controller.undoRedoUntil(7);

      expect(jump).toHaveBeenCalledWith(7, expect.anything());
      expect(apply).toHaveBeenCalledTimes(1);
    });
  });

  describe("applySnapshot", () => {
    it("returns early without a grid", async () => {
      const apply = vi.spyOn(h.dependencies.snapshotCodec, "apply");
      await controller.applySnapshot(makeSnapshot());
      expect(apply).not.toHaveBeenCalled();
    });

    it("applies a same-breakpoint snapshot without a forced transition", async () => {
      seedGrid();
      const apply = vi.spyOn(h.dependencies.snapshotCodec, "apply");

      await controller.applySnapshot(makeSnapshot({ forcedBreakpoint: "lg" }));

      expect(setForcedBreakpoint).not.toHaveBeenCalled();
      expect(waitForLayoutReady).not.toHaveBeenCalled();
      expect(apply).toHaveBeenCalledTimes(1);
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(h.stores.history.stableSnapshot).not.toBeNull();
    });

    it("transitions the forced breakpoint and waits for the delay and layout", async () => {
      const grid = seedGrid();
      h.stores.viewport.setForcedBreakpoint("lg");
      const apply = vi.spyOn(h.dependencies.snapshotCodec, "apply");
      const before = h.stores.history.stackVersion;

      await controller.applySnapshot(makeSnapshot({ forcedBreakpoint: "sm" }));

      expect(setForcedBreakpoint).toHaveBeenCalledWith(
        "sm",
        grid,
        expect.anything(),
        expect.anything(),
      );
      expect(h.dependencies.delay).toHaveBeenCalledWith(500);
      expect(waitForLayoutReady).toHaveBeenCalledWith("sm");
      // The post-transition steps still run after the awaited Promise.all.
      expect(apply).toHaveBeenCalledTimes(1);
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(h.stores.history.stackVersion).toBe(before + 1);
    });

    it("applies the theme only when the snapshot theme differs", async () => {
      const grid = seedGrid();
      grid.themeId = "theme-a";
      const setTheme = vi.spyOn(h.stores.theme, "setTheme");

      await controller.applySnapshot(makeSnapshot({ themeId: "theme-a" }));
      expect(setTheme).not.toHaveBeenCalled();

      // "theme-b" is not a registered theme, so the real theme store logs a
      // fallback warning. Silence it to keep the test output clean, but assert
      // it actually fired so we still cover the fallback path.
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await controller.applySnapshot(makeSnapshot({ themeId: "theme-b" }));
      expect(setTheme).toHaveBeenCalledWith("theme-b");
      expect(warnSpy).toHaveBeenCalledWith(
        'Theme "theme-b" not found, falling back to dark',
      );
      warnSpy.mockRestore();
    });

    it("bumps the history stack version after applying", async () => {
      seedGrid();
      const before = h.stores.history.stackVersion;

      await controller.applySnapshot(makeSnapshot({ forcedBreakpoint: "lg" }));

      expect(h.stores.history.stackVersion).toBe(before + 1);
    });

    it("forwards the resolved url maps to scheduleSave", async () => {
      seedGrid();
      h.stores.uploads.setResolvedUrl("tile-1", "https://cdn/img.png");
      h.stores.uploads.setResolvedDocumentItemUrl(
        "tile-doc",
        "item-1",
        "https://cdn/doc.pdf",
      );

      await controller.applySnapshot(makeSnapshot({ forcedBreakpoint: "lg" }));

      expect(scheduleSave).toHaveBeenCalledWith(
        { "tile-1": "https://cdn/img.png" },
        { "tile-doc": { "item-1": "https://cdn/doc.pdf" } },
      );
    });
  });

  describe("edit transactions", () => {
    it("beginEditing records the pending snapshot and refreshes stable state", () => {
      seedGrid();
      controller.beginEditing("tile-1");
      expect(h.stores.history.editingTileId).toBe("tile-1");
      expect(h.stores.history.stableSnapshot).not.toBeNull();
    });

    it("beginEditing while already editing does not refresh again", () => {
      seedGrid();
      h.stores.history.beginEdit("tile-0", makeSnapshot());
      const setStable = vi.spyOn(h.stores.history, "setStableSnapshot");
      controller.beginEditing("tile-1");
      expect(setStable).not.toHaveBeenCalled();
      expect(h.stores.history.editingTileId).toBe("tile-0");
    });

    it("commitEditing pushes the pending snapshot when content changed", () => {
      seedGrid();
      controller.beginEditing("tile-1");
      // Mutate snapshot-captured state so the committed snapshot differs from
      // the pending one (grid name is not part of the snapshot).
      h.stores.session.currentGrid!.verticalCompact = false;
      const push = vi.spyOn(h.stores.history, "pushSnapshot");

      controller.commitEditing();

      expect(push).toHaveBeenCalledTimes(1);
      // commitEditing schedules a save with no url maps (unlike applySnapshot).
      expect(scheduleSave).toHaveBeenCalledTimes(1);
      expect(scheduleSave).toHaveBeenCalledWith();
    });

    it("commitEditing is a no-op when nothing changed", () => {
      seedGrid();
      controller.beginEditing("tile-1");
      const push = vi.spyOn(h.stores.history, "pushSnapshot");

      controller.commitEditing();

      expect(push).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("commitEditing does nothing without a pending edit snapshot", () => {
      seedGrid();
      const push = vi.spyOn(h.stores.history, "pushSnapshot");
      controller.commitEditing();
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("move / resize gestures", () => {
    it("commitMove pushes the pending snapshot and commits geometry", () => {
      seedGrid();
      controller.beginMove();
      const push = vi.spyOn(h.stores.history, "pushSnapshot");

      controller.commitMove();

      expect(push).toHaveBeenCalledTimes(1);
      expect(commitGestureGeometry).toHaveBeenCalledTimes(1);
      expect(h.stores.history.stableSnapshot).not.toBeNull();
    });

    it("commitMove without a pending snapshot does nothing", () => {
      seedGrid();
      controller.commitMove();
      expect(commitGestureGeometry).not.toHaveBeenCalled();
    });

    it("commitResize pushes the pending snapshot and commits geometry", () => {
      seedGrid();
      controller.beginResize();
      const push = vi.spyOn(h.stores.history, "pushSnapshot");

      controller.commitResize();

      expect(push).toHaveBeenCalledTimes(1);
      expect(commitGestureGeometry).toHaveBeenCalledTimes(1);
      expect(h.stores.history.stableSnapshot).not.toBeNull();
    });

    it("commitResize without a pending snapshot does nothing", () => {
      seedGrid();
      controller.commitResize();
      expect(commitGestureGeometry).not.toHaveBeenCalled();
    });
  });
});
