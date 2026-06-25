import { beforeEach, describe, expect, it, vi } from "vitest";
import { GridViewportController } from "../../internal/GridViewportController";
import { createHarness, makeGrid, type InternalHarness } from "./harness";

/**
 * Tests for GridViewportController — breakpoint state delegation, edit
 * permission gating by breakpoint rank, the stable-snapshot refresh on a
 * forced breakpoint change, and the layout-readiness adapter lifecycle.
 */

describe("GridViewportController", () => {
  let h: InternalHarness;
  let controller: GridViewportController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    controller = new GridViewportController(h.stores, h.dependencies);
  });

  describe("canEdit", () => {
    it("denies a non-owner regardless of breakpoint", () => {
      expect(
        controller.canEdit({
          isOwner: false,
          forcedBreakpoint: null,
          viewportBreakpoint: "lg",
        }),
      ).toBe(false);
    });

    it("allows an owner with no forced breakpoint", () => {
      expect(
        controller.canEdit({
          isOwner: true,
          forcedBreakpoint: null,
          viewportBreakpoint: "sm",
        }),
      ).toBe(true);
    });

    it("allows editing when the forced breakpoint is at or below the viewport rank", () => {
      // sm has the lowest rank; viewing at lg means the forced view fits.
      expect(
        controller.canEdit({
          isOwner: true,
          forcedBreakpoint: "sm",
          viewportBreakpoint: "lg",
        }),
      ).toBe(true);
      expect(
        controller.canEdit({
          isOwner: true,
          forcedBreakpoint: "lg",
          viewportBreakpoint: "lg",
        }),
      ).toBe(true);
    });

    it("denies editing when the forced breakpoint outranks the viewport", () => {
      expect(
        controller.canEdit({
          isOwner: true,
          forcedBreakpoint: "lg",
          viewportBreakpoint: "sm",
        }),
      ).toBe(false);
    });

    it("ranks the md breakpoint between sm and lg", () => {
      // md fits inside an lg viewport but not an sm one.
      expect(
        controller.canEdit({
          isOwner: true,
          forcedBreakpoint: "md",
          viewportBreakpoint: "lg",
        }),
      ).toBe(true);
      expect(
        controller.canEdit({
          isOwner: true,
          forcedBreakpoint: "md",
          viewportBreakpoint: "sm",
        }),
      ).toBe(false);
    });
  });

  it("delegates active/viewport breakpoint setters to the store", () => {
    controller.setActiveBreakpoint("md");
    controller.setViewportBreakpoint("sm");
    expect(h.stores.viewport.activeBreakpoint).toBe("md");
    expect(h.stores.viewport.viewportBreakpoint).toBe("sm");
  });

  it("delegates display positions to the store", () => {
    const positions = [{ i: "a", x: 1, y: 2, w: 3, h: 4 }];
    controller.setDisplayPositions(positions);
    expect(h.stores.viewport.displayPositions).toEqual(positions);
  });

  describe("setForcedBreakpoint", () => {
    it("clears the stable snapshot when there is no grid", () => {
      h.stores.history.setStableSnapshot({} as never);
      controller.setForcedBreakpoint("sm", null);
      expect(h.stores.viewport.forcedBreakpoint).toBe("sm");
      expect(h.stores.history.stableSnapshot).toBeNull();
    });

    it("captures a stable snapshot at the forced breakpoint when a grid exists", () => {
      const grid = makeGrid();
      const capture = vi.spyOn(h.dependencies.snapshotCodec, "capture");

      controller.setForcedBreakpoint("sm", grid);

      expect(h.stores.viewport.forcedBreakpoint).toBe("sm");
      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ grid, breakpoint: "sm", actionLabel: "" }),
      );
      expect(h.stores.history.stableSnapshot).not.toBeNull();
    });

    it("falls back to the active breakpoint when the forced breakpoint is null", () => {
      const grid = makeGrid();
      h.stores.viewport.setActiveBreakpoint("md");
      const capture = vi.spyOn(h.dependencies.snapshotCodec, "capture");

      controller.setForcedBreakpoint(null, grid);

      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ breakpoint: "md" }),
      );
    });

    it("defaults grid and url maps from the stores when omitted", () => {
      const grid = makeGrid();
      h.stores.session.setCurrentGrid(grid);
      h.stores.uploads.setResolvedUrl("tile-1", "https://cdn/x");
      h.stores.uploads.setResolvedDocumentItemUrl(
        "tile-doc",
        "item-1",
        "https://cdn/doc",
      );
      const capture = vi.spyOn(h.dependencies.snapshotCodec, "capture");

      controller.setForcedBreakpoint("sm");

      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({
          grid,
          resolvedUrls: { "tile-1": "https://cdn/x" },
          resolvedDocumentItemUrls: {
            "tile-doc": { "item-1": "https://cdn/doc" },
          },
        }),
      );
    });

    it("uses explicit url maps over the store defaults when provided", () => {
      const grid = makeGrid();
      h.stores.session.setCurrentGrid(grid);
      // Store holds one set of resolved urls...
      h.stores.uploads.setResolvedUrl("tile-1", "https://cdn/store");
      const capture = vi.spyOn(h.dependencies.snapshotCodec, "capture");

      // ...but explicit arguments must take precedence.
      controller.setForcedBreakpoint(
        "sm",
        grid,
        { "tile-2": "https://cdn/explicit" },
        { "tile-3": { "item-9": "https://cdn/explicit-doc" } },
      );

      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedUrls: { "tile-2": "https://cdn/explicit" },
          resolvedDocumentItemUrls: {
            "tile-3": { "item-9": "https://cdn/explicit-doc" },
          },
        }),
      );
    });
  });

  it("delegates breakpoint position queries to the store", () => {
    const grid = makeGrid({
      overrides: { sm: { "tile-1": { x: 1, y: 2, w: 3, h: 4 } } },
    });
    expect(controller.getBreakpointPositions(grid, "sm")).toEqual({
      "tile-1": { x: 1, y: 2, w: 3, h: 4 },
    });
    expect(controller.hasBreakpointOverride(grid, "sm")).toBe(true);
    expect(controller.hasBreakpointOverride(grid, "md")).toBe(false);
  });

  describe("layout readiness adapter", () => {
    it("resolves immediately when no adapter is registered", async () => {
      await expect(
        controller.waitForLayoutReady("sm"),
      ).resolves.toBeUndefined();
    });

    it("routes waitForLayoutReady to the registered adapter", async () => {
      const waitForLayoutReady = vi.fn(async () => undefined);
      controller.registerLayoutReadinessAdapter({ waitForLayoutReady });

      await controller.waitForLayoutReady("md");

      expect(waitForLayoutReady).toHaveBeenCalledWith("md");
    });

    it("returns the adapter's own promise rather than a fresh one", () => {
      const adapterPromise = Promise.resolve();
      controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: vi.fn(() => adapterPromise),
      });

      expect(controller.waitForLayoutReady("md")).toBe(adapterPromise);
    });

    it("lets a newer adapter supersede an older one", async () => {
      const stale = vi.fn(async () => undefined);
      const current = vi.fn(async () => undefined);
      controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: stale,
      });
      controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: current,
      });

      await controller.waitForLayoutReady("sm");

      expect(stale).not.toHaveBeenCalled();
      expect(current).toHaveBeenCalledWith("sm");
    });

    it("only clears the adapter if its own dispose runs and it is still current", async () => {
      const first = vi.fn(async () => undefined);
      const second = vi.fn(async () => undefined);
      const disposeFirst = controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: first,
      });
      controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: second,
      });

      // Disposing the stale registration must not detach the current adapter.
      disposeFirst();
      await controller.waitForLayoutReady("sm");
      expect(second).toHaveBeenCalledWith("sm");
    });

    it("detaches the adapter when its own dispose runs", async () => {
      const wait = vi.fn(async () => undefined);
      const dispose = controller.registerLayoutReadinessAdapter({
        waitForLayoutReady: wait,
      });
      dispose();

      await controller.waitForLayoutReady("sm");

      expect(wait).not.toHaveBeenCalled();
    });
  });
});
