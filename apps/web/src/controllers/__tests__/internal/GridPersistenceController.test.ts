import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GridPersistenceController } from "../../internal/GridPersistenceController";
import {
  createHarness,
  deferred,
  makeGrid,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridPersistenceController — schedules and flushes saves through the
 * injected persistence scheduler, tracks save status on the session store, and
 * ignores results whose scope no longer matches the active session.
 */

describe("GridPersistenceController", () => {
  let h: InternalHarness;
  let canSave: Mock<() => boolean>;
  let flushChatCleanup: Mock<() => void>;
  let controller: GridPersistenceController;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    h = createHarness();
    canSave = vi.fn<() => boolean>(() => true);
    flushChatCleanup = vi.fn<() => void>();
    controller = new GridPersistenceController(
      h.stores,
      h.dependencies,
      canSave,
      flushChatCleanup,
    );
  });

  function seedSavableGrid() {
    h.stores.session.setCurrentGrid(makeGrid({ id: "grid-1" }));
    h.stores.session.setOwner(true);
  }

  describe("scheduleSave", () => {
    it("warns and does nothing when there is no current grid", () => {
      controller.scheduleSave();
      expect(console.warn).toHaveBeenCalledWith("No grid to save.");
      expect(h.persistenceScheduler.schedule).not.toHaveBeenCalled();
    });

    it("does nothing when saving is not permitted", () => {
      seedSavableGrid();
      canSave.mockReturnValue(false);

      controller.scheduleSave();

      expect(h.persistenceScheduler.schedule).not.toHaveBeenCalled();
      expect(h.stores.session.persistenceStatus).toBe("idle");
    });

    it("schedules a snapshot and transitions status saving → idle", async () => {
      seedSavableGrid();
      const generation = h.stores.session.sessionGeneration;

      controller.scheduleSave();

      expect(h.persistenceScheduler.schedule).toHaveBeenCalledTimes(1);
      expect(h.persistenceScheduler.schedule).toHaveBeenCalledWith(
        { gridId: "grid-1", sessionGeneration: generation },
        expect.objectContaining({ id: "grid-1" }),
      );
      expect(h.stores.session.persistenceStatus).toBe("saving");

      await Promise.resolve();
      await Promise.resolve();

      expect(h.stores.session.persistenceStatus).toBe("idle");
      expect(h.stores.session.persistenceError).toBeNull();
    });

    it("passes explicit resolved url maps into the snapshot builder", () => {
      h.stores.session.setCurrentGrid(
        makeGrid({
          id: "grid-1",
          tiles: [
            {
              i: "t1",
              x: 0,
              y: 0,
              w: 2,
              h: 2,
              caption: "",
              content: { type: "image", src: "blob:x" } as never,
            },
          ],
        }),
      );
      h.stores.session.setOwner(true);

      controller.scheduleSave({ t1: "https://cdn/x" }, {});

      expect(h.persistenceScheduler.schedule).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tiles: [
            expect.objectContaining({
              content: expect.objectContaining({ src: "https://cdn/x" }),
            }),
          ],
        }),
      );
    });

    it("reports an error when the scheduler throws synchronously", () => {
      seedSavableGrid();
      vi.mocked(h.persistenceScheduler.schedule).mockImplementationOnce(
        () => {
          throw new Error("schedule failed");
        },
      );

      controller.scheduleSave();

      expect(h.stores.session.persistenceError).toBe("Failed to save grid.");
      expect(h.stores.session.persistenceStatus).toBe("error");
    });

    it("does not flip a superseded session to saving", () => {
      seedSavableGrid();
      // enqueueSave captures the scope and sets status to "pending" before
      // calling schedule. The active session changes inside schedule, so the
      // scope no longer matches and status must not be promoted to "saving".
      vi.mocked(h.persistenceScheduler.schedule).mockImplementationOnce(
        () => {
          h.stores.session.setCurrentGrid(makeGrid({ id: "grid-2" }));
        },
      );

      controller.scheduleSave();

      // The scheduler still queued the (now-stale) snapshot, but the status was
      // never promoted to "saving" because the scope no longer matches. The new
      // session's setCurrentGrid leaves status at its reset value of "idle".
      expect(h.persistenceScheduler.schedule).toHaveBeenCalledTimes(1);
      expect(h.stores.session.persistenceStatus).not.toBe("saving");
    });

    it("ignores a stale flush failure after the session changes", async () => {
      const flushGate = deferred<void>();
      vi.mocked(h.persistenceScheduler.flush).mockReturnValueOnce(
        flushGate.promise,
      );
      h.stores.session.setCurrentGrid(makeGrid({ id: "old-grid" }));
      h.stores.session.setOwner(true);

      controller.scheduleSave();
      h.stores.session.setCurrentGrid(makeGrid({ id: "new-grid" }));
      flushGate.reject(new Error("stale save failed"));
      await Promise.resolve();
      await Promise.resolve();

      expect(h.stores.session.currentGrid?.id).toBe("new-grid");
      expect(h.stores.session.persistenceError).toBeNull();
    });

    it("records an error when the background flush fails for the active scope", async () => {
      seedSavableGrid();
      vi.mocked(h.persistenceScheduler.flush).mockRejectedValueOnce(
        new Error("flush failed"),
      );

      // The scope still matches the active session, so the fire-and-forget
      // flush failure surfaces on the store even though scheduleSave swallows
      // the rethrow.
      controller.scheduleSave();
      await Promise.resolve();
      await Promise.resolve();

      expect(h.stores.session.persistenceError).toBe("Failed to save grid.");
    });
  });

  describe("chat-cleanup GC tick", () => {
    it("runs the GC tick after a successful flush for the active scope", async () => {
      seedSavableGrid();

      await controller.saveGrid();

      expect(flushChatCleanup).toHaveBeenCalledTimes(1);
    });

    it("does not run the GC tick when the flushed scope is stale", async () => {
      const flushGate = deferred<void>();
      vi.mocked(h.persistenceScheduler.flush).mockReturnValueOnce(
        flushGate.promise,
      );
      h.stores.session.setCurrentGrid(makeGrid({ id: "old-grid" }));
      h.stores.session.setOwner(true);

      controller.scheduleSave();
      // Session moves on before the flush resolves → scope no longer matches.
      h.stores.session.setCurrentGrid(makeGrid({ id: "new-grid" }));
      flushGate.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(flushChatCleanup).not.toHaveBeenCalled();
    });

    it("does not run the GC tick when the flush fails", async () => {
      seedSavableGrid();
      vi.mocked(h.persistenceScheduler.flush).mockRejectedValueOnce(
        new Error("flush failed"),
      );

      await controller.saveGrid();

      expect(flushChatCleanup).not.toHaveBeenCalled();
    });
  });

  describe("flushSaves", () => {
    it("does nothing when there is no persistence scope", async () => {
      await controller.flushSaves();
      expect(h.persistenceScheduler.flush).not.toHaveBeenCalled();
    });

    it("flushes the active scope and settles status to idle", async () => {
      seedSavableGrid();
      const scope = h.stores.session.getPersistenceScope();

      await controller.flushSaves();

      expect(h.persistenceScheduler.flush).toHaveBeenCalledWith(scope);
      expect(h.stores.session.persistenceStatus).toBe("idle");
      expect(h.stores.session.persistenceError).toBeNull();
    });

    it("reports an error and rethrows when flush rejects for the active scope", async () => {
      seedSavableGrid();
      vi.mocked(h.persistenceScheduler.flush).mockRejectedValueOnce(
        new Error("flush failed"),
      );

      await expect(controller.flushSaves()).rejects.toThrow("flush failed");
      expect(h.stores.session.persistenceError).toBe("Failed to save grid.");
    });
  });

  describe("saveGrid", () => {
    it("enqueues and flushes a save synchronously awaitable", async () => {
      seedSavableGrid();

      await controller.saveGrid();

      expect(h.persistenceScheduler.schedule).toHaveBeenCalledTimes(1);
      expect(h.persistenceScheduler.flush).toHaveBeenCalledTimes(1);
      expect(h.stores.session.persistenceStatus).toBe("idle");
    });

    it("returns without flushing when there is nothing to enqueue", async () => {
      // No current grid → enqueueSave returns null.
      await controller.saveGrid();
      expect(h.persistenceScheduler.flush).not.toHaveBeenCalled();
    });

    it("swallows flush errors but still records them in the store", async () => {
      seedSavableGrid();
      vi.mocked(h.persistenceScheduler.flush).mockRejectedValueOnce(
        new Error("flush failed"),
      );

      await expect(controller.saveGrid()).resolves.toBeUndefined();
      expect(h.stores.session.persistenceError).toBe("Failed to save grid.");
    });
  });
});
