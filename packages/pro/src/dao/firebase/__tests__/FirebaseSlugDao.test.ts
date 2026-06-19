/**
 * Unit tests for FirebaseSlugDao
 *
 * Covers:
 *  - getBySlug: lowercases the slug for the doc lookup, returns data / null
 *  - checkAvailability: checkSlugAvailability callable, unwraps data
 *  - claim: claimSlug callable, unwraps data
 *  - updateDefaultGrid: updateDefaultGrid callable with string and null gridId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { FirebaseSlugDao } from "../FirebaseSlugDao.js";
import type { Firestore } from "firebase/firestore";
import type { Functions } from "firebase/functions";

const fakeDb = {} as Firestore;
const fakeFunctions = {} as Functions;

function fakeSnapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

describe("FirebaseSlugDao", () => {
  let dao: FirebaseSlugDao;

  beforeEach(() => {
    dao = new FirebaseSlugDao(fakeDb, fakeFunctions);
  });

  // ── getBySlug ─────────────────────────────────────────────────────────────

  describe("getBySlug", () => {
    it("looks up the slug document using the lowercased slug", async () => {
      const data = { userId: "user-1" };
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(data) as any);

      const result = await dao.getBySlug("MySlug");

      expect(doc).toHaveBeenCalledWith(fakeDb, "slugs", "myslug");
      expect(getDoc).toHaveBeenCalledWith("docRef");
      expect(result).toEqual(data);
    });

    it("returns null when the slug document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(null) as any);

      const result = await dao.getBySlug("missing");
      expect(result).toBeNull();
    });
  });

  // ── checkAvailability ─────────────────────────────────────────────────────

  describe("checkAvailability", () => {
    it("calls the checkSlugAvailability callable and returns its data", async () => {
      const response = { available: true };
      const callable = vi.fn().mockResolvedValue({ data: response });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const result = await dao.checkAvailability("my-slug");

      expect(httpsCallable).toHaveBeenCalledWith(
        fakeFunctions,
        "checkSlugAvailability",
      );
      expect(callable).toHaveBeenCalledWith({ slug: "my-slug" });
      expect(result).toBe(response);
    });

    it("propagates callable errors", async () => {
      const callable = vi.fn().mockRejectedValue(new Error("unavailable"));
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await expect(dao.checkAvailability("x")).rejects.toThrow("unavailable");
    });
  });

  // ── claim ─────────────────────────────────────────────────────────────────

  describe("claim", () => {
    it("calls the claimSlug callable and returns its data", async () => {
      const response = { success: true, slug: "my-slug" };
      const callable = vi.fn().mockResolvedValue({ data: response });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const result = await dao.claim("my-slug");

      expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, "claimSlug");
      expect(callable).toHaveBeenCalledWith({ slug: "my-slug" });
      expect(result).toBe(response);
    });
  });

  // ── updateDefaultGrid ─────────────────────────────────────────────────────

  describe("updateDefaultGrid", () => {
    it("calls the updateDefaultGrid callable with the grid id", async () => {
      const callable = vi.fn().mockResolvedValue({ data: { success: true } });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const result = await dao.updateDefaultGrid("grid-1");

      expect(httpsCallable).toHaveBeenCalledWith(
        fakeFunctions,
        "updateDefaultGrid",
      );
      expect(callable).toHaveBeenCalledWith({ gridId: "grid-1" });
      expect(result).toEqual({ success: true });
    });

    it("passes null through to clear the default grid", async () => {
      const callable = vi.fn().mockResolvedValue({ data: { success: true } });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await dao.updateDefaultGrid(null);

      expect(callable).toHaveBeenCalledWith({ gridId: null });
    });
  });
});
