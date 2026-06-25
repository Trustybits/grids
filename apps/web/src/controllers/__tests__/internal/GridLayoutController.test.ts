import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { GridLayoutItem } from "@/types/GridLayout";
import { GridLayoutController } from "../../internal/GridLayoutController";
import {
  createHarness,
  makeGrid,
  makeLinkTile,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridLayoutController — commits drag/resize geometry into the grid
 * model, syncing desktop ("lg") positions directly onto tiles and writing
 * per-breakpoint overrides for smaller breakpoints.
 */

describe("GridLayoutController", () => {
  let h: InternalHarness;
  let canEdit: Mock<() => boolean>;
  let pushUndoSnapshot: Mock<(actionLabel: string) => void>;
  let scheduleSave: Mock<() => void>;
  let controller: GridLayoutController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    canEdit = vi.fn<() => boolean>(() => true);
    pushUndoSnapshot = vi.fn<(actionLabel: string) => void>();
    scheduleSave = vi.fn<() => void>();
    controller = new GridLayoutController(
      h.stores,
      h.dependencies,
      canEdit,
      pushUndoSnapshot,
      scheduleSave,
    );
  });

  it("getViewportGridY reads the injected measurement", () => {
    vi.mocked(h.dependencies.measureViewportGridRow).mockReturnValue(7);
    expect(controller.getViewportGridY()).toBe(7);
  });

  describe("commitGestureGeometry", () => {
    it("syncs desktop positions onto tiles at the lg breakpoint", () => {
      const grid = makeGrid({
        tiles: [makeLinkTile({ i: "t1", x: 0, y: 0, w: 2, h: 2 })],
      });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("lg");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 3, y: 4, w: 5, h: 6 },
      ]);

      controller.commitGestureGeometry();

      expect(grid.tiles[0]).toMatchObject({ x: 3, y: 4, w: 5, h: 6 });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("captures a breakpoint override at a non-lg breakpoint", () => {
      const grid = makeGrid({
        tiles: [makeLinkTile({ i: "t1" })],
        overrides: {},
      });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("sm");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 1, y: 2, w: 3, h: 4 },
      ]);

      controller.commitGestureGeometry();

      expect(grid.overrides?.sm).toEqual({
        t1: { x: 1, y: 2, w: 3, h: 4 },
      });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("schedules a save even with no grid or no display positions", () => {
      controller.commitGestureGeometry();
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("commitRenderedDesktopLayout", () => {
    it("does nothing without a grid", () => {
      controller.commitRenderedDesktopLayout([
        { i: "t1", x: 1, y: 1, w: 1, h: 1 },
      ]);
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("does nothing when editing is not permitted", () => {
      h.stores.session.setCurrentGrid(makeGrid());
      canEdit.mockReturnValue(false);
      controller.commitRenderedDesktopLayout([
        { i: "t1", x: 1, y: 1, w: 1, h: 1 },
      ]);
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("syncs positions at lg and schedules a save", () => {
      const grid = makeGrid({ tiles: [makeLinkTile({ i: "t1" })] });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("lg");

      controller.commitRenderedDesktopLayout([
        { i: "t1", x: 8, y: 9, w: 2, h: 2 },
      ]);

      expect(grid.tiles[0]).toMatchObject({ x: 8, y: 9 });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("schedules a save but does not sync at a non-lg breakpoint", () => {
      const grid = makeGrid({ tiles: [makeLinkTile({ i: "t1", x: 0 })] });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("md");

      controller.commitRenderedDesktopLayout([
        { i: "t1", x: 8, y: 9, w: 2, h: 2 },
      ]);

      expect(grid.tiles[0]?.x).toBe(0);
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("defaults the layout argument to the store display positions", () => {
      const grid = makeGrid({ tiles: [makeLinkTile({ i: "t1" })] });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("lg");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 5, y: 5, w: 2, h: 2 },
      ]);

      controller.commitRenderedDesktopLayout();

      expect(grid.tiles[0]).toMatchObject({ x: 5, y: 5 });
    });
  });

  describe("commitCompactedLayout", () => {
    it("syncs the compacted layout onto tiles at the lg breakpoint", () => {
      const grid = makeGrid({ tiles: [makeLinkTile({ i: "t1" })] });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("lg");

      controller.commitCompactedLayout([{ i: "t1", x: 2, y: 3, w: 2, h: 2 }]);

      expect(grid.tiles[0]).toMatchObject({ x: 2, y: 3 });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("writes compacted positions to overrides at a non-lg breakpoint", () => {
      const grid = makeGrid({ tiles: [makeLinkTile({ i: "t1", x: 0, y: 0 })] });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("md");

      controller.commitCompactedLayout([{ i: "t1", x: 1, y: 2, w: 2, h: 2 }]);

      // Canonical tile (lg) position is untouched; the override carries it.
      expect(grid.tiles[0]).toMatchObject({ x: 0, y: 0 });
      expect(grid.overrides?.md?.t1).toEqual({ x: 1, y: 2, w: 2, h: 2 });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("is a no-op without a grid or without edit permission", () => {
      controller.commitCompactedLayout([{ i: "t1", x: 2, y: 3, w: 2, h: 2 }]);
      h.stores.session.setCurrentGrid(makeGrid());
      canEdit.mockReturnValue(false);
      controller.commitCompactedLayout([{ i: "t1", x: 2, y: 3, w: 2, h: 2 }]);
      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe("updateBreakpointOverride", () => {
    it("saves after capturing a non-lg override", () => {
      const grid = makeGrid({ tiles: [makeLinkTile({ i: "t1" })] });
      h.stores.session.setCurrentGrid(grid);
      h.stores.viewport.setActiveBreakpoint("sm");
      h.stores.viewport.setDisplayPositions([
        { i: "t1", x: 1, y: 1, w: 2, h: 2 },
      ]);

      controller.updateBreakpointOverride();

      expect(grid.overrides?.sm?.t1).toEqual({ x: 1, y: 1, w: 2, h: 2 });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("does not save at the lg breakpoint (no override captured)", () => {
      h.stores.session.setCurrentGrid(makeGrid());
      h.stores.viewport.setActiveBreakpoint("lg");
      controller.updateBreakpointOverride();
      expect(scheduleSave).not.toHaveBeenCalled();
    });
  });

  describe("saveBreakpointPositions", () => {
    it("writes the override map for a non-lg breakpoint", () => {
      const grid = makeGrid();
      h.stores.session.setCurrentGrid(grid);
      const tiles: GridLayoutItem[] = [{ i: "t1", x: 1, y: 2, w: 3, h: 4 }];

      controller.saveBreakpointPositions("md", tiles);

      expect(grid.overrides?.md).toEqual({
        t1: { x: 1, y: 2, w: 3, h: 4 },
      });
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("ignores the lg breakpoint", () => {
      h.stores.session.setCurrentGrid(makeGrid());
      controller.saveBreakpointPositions("lg", [
        { i: "t1", x: 1, y: 2, w: 3, h: 4 },
      ]);
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("does nothing without a grid", () => {
      controller.saveBreakpointPositions("sm", []);
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("initializes the overrides object when the grid has none", () => {
      const grid = makeGrid({ overrides: undefined });
      h.stores.session.setCurrentGrid(grid);

      controller.saveBreakpointPositions("md", [
        { i: "t1", x: 1, y: 2, w: 3, h: 4 },
      ]);

      expect(grid.overrides).toEqual({
        md: { t1: { x: 1, y: 2, w: 3, h: 4 } },
      });
    });
  });

  describe("resetBreakpoint", () => {
    it("captures history, deletes the override, and saves", () => {
      const grid = makeGrid({
        overrides: { sm: { t1: { x: 1, y: 1, w: 1, h: 1 } } },
      });
      h.stores.session.setCurrentGrid(grid);

      controller.resetBreakpoint("sm");

      expect(pushUndoSnapshot).toHaveBeenCalledWith("Reset breakpoint grid");
      expect(grid.overrides?.sm).toBeUndefined();
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("ignores the lg breakpoint", () => {
      h.stores.session.setCurrentGrid(makeGrid());
      controller.resetBreakpoint("lg");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("does nothing without a grid", () => {
      controller.resetBreakpoint("sm");
      expect(pushUndoSnapshot).not.toHaveBeenCalled();
    });
  });
});
