/**
 * Unit tests for FirebaseRoadmapDao
 *
 * Covers:
 *  - listDatabases: calls the listNotionDatabases callable with gridId/tileId
 *    and unwraps result.data.databases
 *  - fetchRoadmap: calls the fetchNotionRoadmap callable; includes queryFilters,
 *    includes databaseIdOverride only when truthy (omitted when undefined or
 *    empty string), unwraps result.data, propagates errors
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { FirebaseRoadmapDao } from "../FirebaseRoadmapDao.js";
import type { Functions } from "firebase/functions";

const fakeFunctions = {} as Functions;

describe("FirebaseRoadmapDao", () => {
  let dao: FirebaseRoadmapDao;

  beforeEach(() => {
    dao = new FirebaseRoadmapDao(fakeFunctions);
  });

  // ── listDatabases ─────────────────────────────────────────────────────────

  describe("listDatabases", () => {
    it("calls listNotionDatabases with gridId/tileId and returns the databases array", async () => {
      const databases = [{ id: "db-1", title: "Roadmap" }];
      const callable = vi.fn().mockResolvedValue({ data: { databases } });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const result = await dao.listDatabases("grid-1", "tile-1");

      expect(httpsCallable).toHaveBeenCalledWith(
        fakeFunctions,
        "listNotionDatabases",
      );
      expect(callable).toHaveBeenCalledWith({ gridId: "grid-1", tileId: "tile-1" });
      expect(result).toBe(databases);
    });

    it("propagates callable errors", async () => {
      const callable = vi.fn().mockRejectedValue(new Error("not connected"));
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await expect(dao.listDatabases("g", "t")).rejects.toThrow("not connected");
    });
  });

  // ── fetchRoadmap ──────────────────────────────────────────────────────────

  describe("fetchRoadmap", () => {
    it("calls fetchNotionRoadmap with gridId, tileId, and queryFilters", async () => {
      const roadmap = { items: [], databaseId: "db-1" };
      const callable = vi.fn().mockResolvedValue({ data: roadmap });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const filters = [{ property: "Status", value: "Planned" }] as any;
      const result = await dao.fetchRoadmap("grid-1", "tile-1", filters);

      expect(httpsCallable).toHaveBeenCalledWith(
        fakeFunctions,
        "fetchNotionRoadmap",
      );
      expect(callable).toHaveBeenCalledWith({
        gridId: "grid-1",
        tileId: "tile-1",
        queryFilters: filters,
      });
      expect(result).toBe(roadmap);
    });

    it("includes databaseIdOverride in the payload when provided", async () => {
      const callable = vi.fn().mockResolvedValue({ data: {} });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await dao.fetchRoadmap("grid-1", "tile-1", undefined, "db-override");

      expect(callable).toHaveBeenCalledWith({
        gridId: "grid-1",
        tileId: "tile-1",
        queryFilters: undefined,
        databaseIdOverride: "db-override",
      });
    });

    it("omits databaseIdOverride when it is undefined", async () => {
      const callable = vi.fn().mockResolvedValue({ data: {} });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await dao.fetchRoadmap("grid-1", "tile-1");

      expect(callable.mock.calls[0][0]).not.toHaveProperty("databaseIdOverride");
    });

    it("omits databaseIdOverride when it is an empty string", async () => {
      const callable = vi.fn().mockResolvedValue({ data: {} });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await dao.fetchRoadmap("grid-1", "tile-1", undefined, "");

      expect(callable.mock.calls[0][0]).not.toHaveProperty("databaseIdOverride");
    });

    it("propagates callable errors", async () => {
      const callable = vi.fn().mockRejectedValue(new Error("rate limited"));
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await expect(dao.fetchRoadmap("g", "t")).rejects.toThrow("rate limited");
    });
  });
});
