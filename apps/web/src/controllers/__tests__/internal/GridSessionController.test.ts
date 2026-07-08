import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Grid } from "@grids/contracts/types";
import { GridSessionController } from "../../internal/GridSessionController";
import {
  createHarness,
  deferred,
  makeGrid,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridSessionController — owns loading a grid into the focused
 * session, the reset ordering of session-dependent stores, and the
 * generation-based guards that discard stale load responses.
 */

describe("GridSessionController", () => {
  let h: InternalHarness;
  let refreshStableSnapshot: Mock<() => void>;
  let flushChatCleanup: Mock<() => void>;
  let controller: GridSessionController;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    h = createHarness();
    refreshStableSnapshot = vi.fn<() => void>();
    flushChatCleanup = vi.fn<() => void>();
    controller = new GridSessionController(
      h.stores,
      h.dependencies,
      refreshStableSnapshot,
      flushChatCleanup,
    );
    vi.mocked(h.gridService.fetchGrid).mockResolvedValue(makeGrid());
    vi.mocked(h.gridService.touchLastOpenedAt).mockResolvedValue(undefined);
    vi.mocked(h.gridService.saveRecentGridIds).mockResolvedValue(undefined);
  });

  describe("resetSessionDependents", () => {
    it("resets dependent stores then the session in a fixed order", () => {
      const order: string[] = [];
      vi.spyOn(h.stores.history, "reset").mockImplementation(() => {
        order.push("history");
      });
      vi.spyOn(h.stores.viewport, "reset").mockImplementation(() => {
        order.push("viewport");
      });
      vi.spyOn(h.stores.uploads, "reset").mockImplementation(() => {
        order.push("uploads");
      });
      vi.spyOn(h.stores.ui, "resetSessionState").mockImplementation(() => {
        order.push("ui");
      });
      vi.spyOn(h.stores.session, "reset").mockImplementation(() => {
        order.push("session");
      });

      controller.resetSessionDependents();

      expect(order).toEqual([
        "history",
        "viewport",
        "uploads",
        "ui",
        "session",
      ]);
    });

    it("flushes pending chat cleanup before the history stack is reset", () => {
      const order: string[] = [];
      flushChatCleanup.mockImplementation(() => {
        order.push("flush");
      });
      vi.spyOn(h.stores.history, "reset").mockImplementation(() => {
        order.push("history-reset");
      });

      controller.resetSessionDependents();

      // The flush must read the outgoing grid's stacks before they are cleared.
      expect(order).toEqual(["flush", "history-reset"]);
    });
  });

  describe("loadGrid", () => {
    it("loads an owned grid and sets focused session state", async () => {
      const grid = makeGrid({ id: "g2", userId: "user-1" });
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(grid);
      // Spy proves loadGrid explicitly calls setDemoGrid(false) rather than the
      // false value coming only from the session reset default.
      const setDemoGrid = vi.spyOn(h.stores.session, "setDemoGrid");

      await controller.loadGrid("g2");

      expect(setDemoGrid).toHaveBeenCalledWith(false);

      expect(h.stores.session.currentGrid).toEqual(grid);
      expect(h.stores.session.isOwner).toBe(true);
      expect(h.stores.session.isDemoGrid).toBe(false);
      expect(h.stores.session.isLoading).toBe(false);
      expect(h.stores.session.loadError).toBeNull();
      expect(h.stores.ui.showMetaData).toBe(true);
      expect(h.stores.ui.showMetaDataVerbose).toBe(false);
      expect(refreshStableSnapshot).toHaveBeenCalledTimes(1);
    });

    it("touches last-opened and records recents for the loaded grid", async () => {
      const grid = makeGrid({ id: "g2" });
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(grid);
      h.stores.collection.setGrids([makeGrid({ id: "g2" })]);

      await controller.loadGrid("g2");

      expect(h.stores.collection.recentGridIds).toEqual(["g2"]);
      expect(h.gridService.saveRecentGridIds).toHaveBeenCalledWith("user-1", [
        "g2",
      ]);
      expect(h.gridService.touchLastOpenedAt).toHaveBeenCalledWith("g2");
      expect(h.stores.collection.grids[0]?.lastOpenedAt).toEqual(
        new Date("2026-06-22T12:00:00Z"),
      );
    });

    it("flows non-default metadata preferences into the ui store", async () => {
      vi.mocked(h.dependencies.readMetadataPreferences).mockReturnValue({
        showMetaData: false,
        showMetaDataVerbose: true,
      });
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ id: "g2" }),
      );

      await controller.loadGrid("g2");

      expect(h.stores.ui.showMetaData).toBe(false);
      expect(h.stores.ui.showMetaDataVerbose).toBe(true);
    });

    it("completes successfully even when persisting recents rejects", async () => {
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ id: "g2" }),
      );
      vi.mocked(h.gridService.saveRecentGridIds).mockRejectedValueOnce(
        new Error("boom"),
      );

      await expect(controller.loadGrid("g2")).resolves.toBeUndefined();

      expect(h.stores.session.currentGrid?.id).toBe("g2");
      expect(h.stores.session.loadError).toBeNull();
    });

    it("marks a foreign grid as not owned", async () => {
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ userId: "other" }),
      );
      await controller.loadGrid("g1");
      expect(h.stores.session.isOwner).toBe(false);
    });

    it("does not persist recents when there is no authenticated user", async () => {
      h.getCurrentUserId.mockReturnValue(null);
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ id: "g2" }),
      );

      await controller.loadGrid("g2");

      expect(h.stores.session.isOwner).toBe(false);
      expect(h.gridService.saveRecentGridIds).not.toHaveBeenCalled();
    });

    it("records the error and clears loading when fetch rejects", async () => {
      h.stores.session.setLoadError("previous");
      vi.mocked(h.gridService.fetchGrid).mockRejectedValueOnce(
        new Error("boom"),
      );

      const loading = controller.loadGrid("g1");
      // Error state is cleared synchronously before the request resolves.
      expect(h.stores.session.loadError).toBeNull();
      await loading;

      expect(h.stores.session.currentGrid).toBeNull();
      expect(h.stores.session.loadError).toBe("Failed to load grid.");
      expect(h.stores.session.isLoading).toBe(false);
      expect(h.gridService.touchLastOpenedAt).not.toHaveBeenCalled();
    });

    it("clears dependent state immediately and shows loading before resolving", async () => {
      const request = deferred<Grid>();
      vi.mocked(h.gridService.fetchGrid).mockReturnValueOnce(
        request.promise,
      );
      h.stores.session.setCurrentGrid(makeGrid({ id: "old" }));
      h.stores.viewport.setForcedBreakpoint("sm");

      const loading = controller.loadGrid("new");

      expect(h.stores.session.currentGrid).toBeNull();
      expect(h.stores.session.isLoading).toBe(true);
      expect(h.stores.viewport.forcedBreakpoint).toBeNull();
      expect(h.stores.history.manager).not.toBeNull();

      request.resolve(makeGrid({ id: "new" }));
      await loading;
      expect(h.stores.session.currentGrid?.id).toBe("new");
    });

    it("ignores an obsolete load whose response resolves while a newer load is pending", async () => {
      const oldRequest = deferred<Grid>();
      const newRequest = deferred<Grid>();
      vi.mocked(h.gridService.fetchGrid)
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(newRequest.promise);

      const oldLoad = controller.loadGrid("old");
      const newLoad = controller.loadGrid("new");

      oldRequest.resolve(makeGrid({ id: "old" }));
      await oldLoad;

      // The obsolete response must not commit a grid or persist recents.
      expect(h.stores.session.currentGrid).toBeNull();
      expect(h.stores.session.isLoading).toBe(true);
      expect(h.gridService.touchLastOpenedAt).not.toHaveBeenCalled();

      newRequest.resolve(makeGrid({ id: "new" }));
      await newLoad;

      expect(h.stores.session.currentGrid?.id).toBe("new");
      expect(h.stores.session.isLoading).toBe(false);
    });

    it("ignores an obsolete failure while a newer load is pending", async () => {
      const oldRequest = deferred<Grid>();
      const newRequest = deferred<Grid>();
      vi.mocked(h.gridService.fetchGrid)
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(newRequest.promise);

      const oldLoad = controller.loadGrid("old");
      const newLoad = controller.loadGrid("new");

      oldRequest.reject(new Error("stale failure"));
      await oldLoad;

      // The stale rejection must not surface as a load error, and because the
      // generation no longer matches, the finally guard leaves loading on.
      expect(h.stores.session.loadError).toBeNull();
      expect(h.stores.session.isLoading).toBe(true);

      newRequest.resolve(makeGrid({ id: "new" }));
      await newLoad;
      expect(h.stores.session.currentGrid?.id).toBe("new");
    });
  });

  describe("resyncIfStale", () => {
    it("does nothing when there is no active grid", async () => {
      await controller.resyncIfStale();
      expect(h.gridService.fetchGrid).not.toHaveBeenCalled();
      expect(h.stores.session.isResyncing).toBe(false);
    });

    it("does nothing while a full load is already in progress", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 2 }));
      h.stores.session.setLoading(true);

      await controller.resyncIfStale();

      expect(h.gridService.fetchGrid).not.toHaveBeenCalled();
    });

    it("is a no-op when the stored rev still matches the loaded copy", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 3 }));
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ id: "g1", rev: 3, name: "Server Name" }),
      );

      await controller.resyncIfStale();

      expect(h.gridService.fetchGrid).toHaveBeenCalledWith("g1");
      // The local copy is untouched and no overlay was shown.
      expect(h.stores.session.currentGrid?.name).toBe("Grid");
      expect(h.stores.session.isResyncing).toBe(false);
      expect(refreshStableSnapshot).not.toHaveBeenCalled();
    });

    it("reloads to the latest grid when the stored rev has advanced", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 3 }));
      const latest = makeGrid({ id: "g1", rev: 5, name: "Newer" });
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(latest);

      await controller.resyncIfStale();

      expect(h.stores.session.currentGrid).toEqual(latest);
      expect(h.stores.session.isOwner).toBe(true);
      // The overlay is lowered once the reload settles.
      expect(h.stores.session.isResyncing).toBe(false);
      expect(refreshStableSnapshot).toHaveBeenCalledTimes(1);
      // A passive resync must not re-fire analytics / lastOpened side effects.
      expect(h.gridService.touchLastOpenedAt).not.toHaveBeenCalled();
      expect(h.gridService.saveRecentGridIds).not.toHaveBeenCalled();
    });

    it("preserves the measured and forced breakpoint across a reload", async () => {
      // The physical viewport did not change while the tab was backgrounded, so
      // a passive reload must not reset the breakpoint back to the "lg" default
      // (which would render the grid at the wrong breakpoint and break editing).
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 3 }));
      h.stores.viewport.setViewportBreakpoint("md");
      h.stores.viewport.setActiveBreakpoint("md");
      h.stores.viewport.setForcedBreakpoint("sm");
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ id: "g1", rev: 5 }),
      );

      await controller.resyncIfStale();

      expect(h.stores.session.currentGrid?.rev).toBe(5);
      expect(h.stores.viewport.viewportBreakpoint).toBe("md");
      expect(h.stores.viewport.activeBreakpoint).toBe("md");
      expect(h.stores.viewport.forcedBreakpoint).toBe("sm");
    });

    it("treats a missing rev on either side as rev 0", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1" }));
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ id: "g1", name: "Server Name" }),
      );

      await controller.resyncIfStale();

      // Both revs read as 0, so nothing reloads.
      expect(h.stores.session.currentGrid?.name).toBe("Grid");
      expect(refreshStableSnapshot).not.toHaveBeenCalled();
    });

    it("collapses overlapping reactivation checks into a single fetch", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 1 }));
      const request = deferred<Grid>();
      vi.mocked(h.gridService.fetchGrid).mockReturnValueOnce(request.promise);

      const first = controller.resyncIfStale();
      const second = controller.resyncIfStale();

      request.resolve(makeGrid({ id: "g1", rev: 1 }));
      await Promise.all([first, second]);

      expect(h.gridService.fetchGrid).toHaveBeenCalledTimes(1);
    });

    it("discards the reload when the session changes while fetching", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 1 }));
      const request = deferred<Grid>();
      vi.mocked(h.gridService.fetchGrid).mockReturnValueOnce(request.promise);

      const pending = controller.resyncIfStale();
      // A navigation swaps the active grid mid-flight, bumping the generation.
      h.stores.session.setCurrentGrid(makeGrid({ id: "g2", rev: 9 }));

      request.resolve(makeGrid({ id: "g1", rev: 7 }));
      await pending;

      expect(h.stores.session.currentGrid?.id).toBe("g2");
      expect(h.stores.session.isResyncing).toBe(false);
      expect(refreshStableSnapshot).not.toHaveBeenCalled();
    });

    it("aborts the commit when the session changes during the overlay paint frame", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 1 }));
      vi.mocked(h.gridService.fetchGrid).mockResolvedValueOnce(
        makeGrid({ id: "g1", rev: 7 }),
      );
      // The overlay is painted via delay(0); a navigation lands in that gap and
      // bumps the generation, so the reload must be discarded before commit.
      vi.mocked(h.dependencies.delay).mockImplementationOnce(async () => {
        h.stores.session.setCurrentGrid(makeGrid({ id: "g2", rev: 9 }));
      });

      await controller.resyncIfStale();

      expect(h.stores.session.currentGrid?.id).toBe("g2");
      expect(h.stores.session.isResyncing).toBe(false);
      expect(refreshStableSnapshot).not.toHaveBeenCalled();
    });

    it("leaves the session intact when the staleness fetch rejects", async () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1", rev: 3 }));
      vi.mocked(h.gridService.fetchGrid).mockRejectedValueOnce(
        new Error("offline"),
      );

      await expect(controller.resyncIfStale()).resolves.toBeUndefined();

      expect(h.stores.session.currentGrid?.rev).toBe(3);
      expect(h.stores.session.isResyncing).toBe(false);
    });
  });

  describe("clearSession / clearSessionIfGridDeleted", () => {
    it("clearSession resets all session-dependent state", () => {
      h.stores.session.setCurrentGrid(makeGrid());
      h.stores.history.initializeManager();

      controller.clearSession();

      expect(h.stores.session.currentGrid).toBeNull();
      expect(h.stores.history.manager).toBeNull();
    });

    it("clearSessionIfGridDeleted clears only when the id matches the active grid", () => {
      h.stores.session.setCurrentGrid(makeGrid({ id: "g1" }));

      controller.clearSessionIfGridDeleted("other");
      expect(h.stores.session.currentGrid?.id).toBe("g1");

      controller.clearSessionIfGridDeleted("g1");
      expect(h.stores.session.currentGrid).toBeNull();
    });

    it("clearSessionIfGridDeleted is a no-op when there is no active grid", () => {
      const reset = vi.spyOn(h.stores.session, "reset");
      controller.clearSessionIfGridDeleted("g1");
      expect(reset).not.toHaveBeenCalled();
    });
  });
});
