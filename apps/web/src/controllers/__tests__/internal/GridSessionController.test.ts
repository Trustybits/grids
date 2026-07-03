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
