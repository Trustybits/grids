/**
 * Unit tests for FirebaseBadgeDao
 *
 * Covers:
 *  - getById: existing doc with earnedAt as Date / Timestamp-like / ISO string,
 *    entries dropped when earnedAt is missing, invalid, or unparseable,
 *    missing doc → null, empty doc → empty badges object
 *  - subscribe: callback receives normalized badges / null, unsubscribe passthrough
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { FirebaseBadgeDao } from "../FirebaseBadgeDao.js";
import type { Firestore } from "firebase/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeDb = {} as Firestore;

/** Build a fake Firestore DocumentSnapshot. */
function fakeSnapshot(data: Record<string, unknown>, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirebaseBadgeDao", () => {
  let dao: FirebaseBadgeDao;

  beforeEach(() => {
    dao = new FirebaseBadgeDao(fakeDb);
  });

  // ── getById ──────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("reads userBadges/{userId} and returns null when the document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot({}, false) as any);

      const result = await dao.getById("user-1");

      expect(doc).toHaveBeenCalledWith(fakeDb, "userBadges", "user-1");
      expect(getDoc).toHaveBeenCalledWith("docRef");
      expect(result).toBeNull();
    });

    it("returns an empty badges object for an existing empty document", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot({}) as any);

      const result = await dao.getById("user-1");
      expect(result).toEqual({});
    });

    it("keeps a badge whose earnedAt is a native Date", async () => {
      const earned = new Date("2026-01-15T00:00:00Z");
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(
        fakeSnapshot({ earlyAdopter: { earnedAt: earned } }) as any,
      );

      const result = await dao.getById("user-1");
      expect(result).toEqual({ earlyAdopter: { earnedAt: earned } });
    });

    it("converts a Firestore Timestamp-like earnedAt via toDate()", async () => {
      const asDate = new Date("2026-02-01T00:00:00Z");
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(
        fakeSnapshot({ supporter: { earnedAt: { toDate: () => asDate } } }) as any,
      );

      const result = await dao.getById("user-1");
      expect(result).toEqual({ supporter: { earnedAt: asDate } });
    });

    it("parses an ISO-string earnedAt into a Date", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(
        fakeSnapshot({ earlyAdopter: { earnedAt: "2026-03-01T12:00:00Z" } }) as any,
      );

      const result = await dao.getById("user-1");
      expect(result?.earlyAdopter?.earnedAt).toBeInstanceOf(Date);
      expect(result?.earlyAdopter?.earnedAt.toISOString()).toBe(
        "2026-03-01T12:00:00.000Z",
      );
    });

    it("drops entries whose earnedAt is an unparseable string", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(
        fakeSnapshot({ earlyAdopter: { earnedAt: "not-a-date" } }) as any,
      );

      const result = await dao.getById("user-1");
      expect(result).toEqual({});
    });

    it("drops entries with a missing or malformed earnedAt and keeps valid ones", async () => {
      const earned = new Date("2026-01-01T00:00:00Z");
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(
        fakeSnapshot({
          earlyAdopter: { earnedAt: earned },
          supporter: {},
          bogusNumeric: { earnedAt: 12345 },
          bogusNull: null,
        }) as any,
      );

      const result = await dao.getById("user-1");
      expect(result).toEqual({ earlyAdopter: { earnedAt: earned } });
    });
  });

  // ── subscribe ─────────────────────────────────────────────────────────────

  describe("subscribe", () => {
    it("invokes the callback with normalized badges when the document exists", () => {
      const earned = new Date("2026-01-01T00:00:00Z");
      const callback = vi.fn();

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockImplementation((_ref: any, handler: any) => {
        handler(
          fakeSnapshot({
            earlyAdopter: { earnedAt: earned },
            supporter: { earnedAt: "garbage" },
          }),
        );
        return vi.fn();
      });

      dao.subscribe("user-1", callback);

      expect(doc).toHaveBeenCalledWith(fakeDb, "userBadges", "user-1");
      expect(callback).toHaveBeenCalledWith({ earlyAdopter: { earnedAt: earned } });
    });

    it("invokes the callback with null when the document does not exist", () => {
      const callback = vi.fn();

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockImplementation((_ref: any, handler: any) => {
        handler(fakeSnapshot({}, false));
        return vi.fn();
      });

      dao.subscribe("user-1", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      const result = dao.subscribe("user-1", vi.fn());

      expect(result).toBe(unsubFn);
    });
  });
});
