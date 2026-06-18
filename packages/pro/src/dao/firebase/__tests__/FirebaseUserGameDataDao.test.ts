/**
 * Unit tests for FirebaseUserGameDataDao
 *
 * Covers:
 *  - getById: mapping (defaults for displayName/totalClicks, Date passthrough,
 *    Timestamp-like toDate, fallback to "now"), missing doc → null
 *  - create: setDoc with createdAt/updatedAt serverTimestamps
 *  - update: updateDoc with updatedAt serverTimestamp
 *  - incrementFields: increment() per field plus updatedAt
 *  - incrementClicksTransaction: missing doc throws DOCUMENT_NOT_FOUND;
 *    new-day reset; same-day accumulation; 100-click daily cap (at-cap allowed,
 *    over-cap rejected without an update)
 *  - subscribe: data/null callback, errors logged without invoking callback
 *  - getLeaderboard / subscribeToLeaderboard: ordered+limited query, mapping,
 *    error path passes an empty list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { FirebaseUserGameDataDao } from "../FirebaseUserGameDataDao.js";
import type { Firestore } from "firebase/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeDb = {} as Firestore;

function fakeSnapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

/** Build a fake QuerySnapshot supporting forEach with doc ids. */
function fakeQuerySnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const wrapped = docs.map((d) => ({ id: d.id, data: () => d.data }));
  return {
    forEach: (cb: (d: { id: string; data: () => unknown }) => void) =>
      wrapped.forEach(cb),
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirebaseUserGameDataDao", () => {
  let dao: FirebaseUserGameDataDao;

  beforeEach(() => {
    dao = new FirebaseUserGameDataDao(fakeDb);
  });

  // ── getById ──────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("maps an existing document, converting Timestamp-like dates via toDate()", async () => {
      const created = new Date("2026-01-01T00:00:00Z");
      const updated = new Date("2026-06-01T00:00:00Z");
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(
        fakeSnapshot({
          displayName: "Alice",
          totalClicks: 42,
          createdAt: { toDate: () => created },
          updatedAt: updated, // already a Date — passed through
          dailyClicks: 5,
          lastClickDate: "2026-06-01",
          passiveBoost: 1.5,
          totalPassiveClicks: 100,
        }) as any,
      );

      const result = await dao.getById("user-1");

      expect(doc).toHaveBeenCalledWith(fakeDb, "userGameData", "user-1");
      expect(result).toEqual({
        userId: "user-1",
        displayName: "Alice",
        totalClicks: 42,
        createdAt: created,
        updatedAt: updated,
        dailyClicks: 5,
        lastClickDate: "2026-06-01",
        passiveBoost: 1.5,
        totalPassiveClicks: 100,
      });
    });

    it("defaults displayName to '' and totalClicks to 0, and falls back to 'now' for missing dates", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
      try {
        vi.mocked(doc).mockReturnValue("docRef" as any);
        vi.mocked(getDoc).mockResolvedValue(fakeSnapshot({}) as any);

        const result = await dao.getById("user-1");

        expect(result).toMatchObject({
          userId: "user-1",
          displayName: "",
          totalClicks: 0,
          createdAt: new Date("2026-06-11T10:00:00Z"),
          updatedAt: new Date("2026-06-11T10:00:00Z"),
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns null when the document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(null) as any);

      expect(await dao.getById("missing")).toBeNull();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("writes the data with createdAt and updatedAt server timestamps", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(serverTimestamp).mockReturnValue("SERVER_TS" as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await dao.create("user-1", { displayName: "Alice", totalClicks: 0 });

      expect(doc).toHaveBeenCalledWith(fakeDb, "userGameData", "user-1");
      expect(setDoc).toHaveBeenCalledWith("docRef", {
        displayName: "Alice",
        totalClicks: 0,
        createdAt: "SERVER_TS",
        updatedAt: "SERVER_TS",
      });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates the data with a fresh updatedAt server timestamp", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(serverTimestamp).mockReturnValue("SERVER_TS" as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await dao.update("user-1", { displayName: "Bob" });

      expect(updateDoc).toHaveBeenCalledWith("docRef", {
        displayName: "Bob",
        updatedAt: "SERVER_TS",
      });
    });
  });

  // ── incrementFields ───────────────────────────────────────────────────────

  describe("incrementFields", () => {
    it("applies increment() to each field and stamps updatedAt", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(serverTimestamp).mockReturnValue("SERVER_TS" as any);
      vi.mocked(increment).mockImplementation((n: number) => ({ __inc: n }) as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await dao.incrementFields("user-1", { totalClicks: 3, totalPassiveClicks: 7 });

      expect(increment).toHaveBeenCalledWith(3);
      expect(increment).toHaveBeenCalledWith(7);
      expect(updateDoc).toHaveBeenCalledWith("docRef", {
        updatedAt: "SERVER_TS",
        totalClicks: { __inc: 3 },
        totalPassiveClicks: { __inc: 7 },
      });
    });

    it("updates only updatedAt when given no fields", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(serverTimestamp).mockReturnValue("SERVER_TS" as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await dao.incrementFields("user-1", {});

      expect(updateDoc).toHaveBeenCalledWith("docRef", { updatedAt: "SERVER_TS" });
    });
  });

  // ── incrementClicksTransaction ────────────────────────────────────────────

  describe("incrementClicksTransaction", () => {
    const TODAY = "2026-06-11";
    const YESTERDAY = "2026-06-10";
    let transaction: { get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
      transaction = { get: vi.fn(), update: vi.fn() };
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(serverTimestamp).mockReturnValue("SERVER_TS" as any);
      vi.mocked(increment).mockImplementation((n: number) => ({ __inc: n }) as any);
      vi.mocked(runTransaction).mockImplementation(
        (_db: any, updateFn: any) => updateFn(transaction) as any,
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("throws DOCUMENT_NOT_FOUND when the user document does not exist", async () => {
      transaction.get.mockResolvedValue(fakeSnapshot(null));

      await expect(dao.incrementClicksTransaction("user-1", 1)).rejects.toThrow(
        "DOCUMENT_NOT_FOUND",
      );
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it("resets dailyClicks to the amount on a new day", async () => {
      transaction.get.mockResolvedValue(
        fakeSnapshot({ lastClickDate: YESTERDAY, dailyClicks: 99 }),
      );

      const result = await dao.incrementClicksTransaction("user-1", 5);

      expect(result).toBe(true);
      expect(transaction.update).toHaveBeenCalledWith("docRef", {
        totalClicks: { __inc: 5 },
        updatedAt: "SERVER_TS",
        lastClickDate: TODAY,
        dailyClicks: 5,
      });
    });

    it("treats a document without lastClickDate as a new day", async () => {
      transaction.get.mockResolvedValue(fakeSnapshot({}));

      const result = await dao.incrementClicksTransaction("user-1", 2);

      expect(result).toBe(true);
      expect(transaction.update).toHaveBeenCalledWith(
        "docRef",
        expect.objectContaining({ dailyClicks: 2, lastClickDate: TODAY }),
      );
    });

    it("increments dailyClicks on the same day while under the cap", async () => {
      transaction.get.mockResolvedValue(
        fakeSnapshot({ lastClickDate: TODAY, dailyClicks: 50 }),
      );

      const result = await dao.incrementClicksTransaction("user-1", 10);

      expect(result).toBe(true);
      expect(transaction.update).toHaveBeenCalledWith("docRef", {
        totalClicks: { __inc: 10 },
        updatedAt: "SERVER_TS",
        lastClickDate: TODAY,
        dailyClicks: { __inc: 10 },
      });
    });

    it("allows reaching exactly the 100-click daily cap", async () => {
      transaction.get.mockResolvedValue(
        fakeSnapshot({ lastClickDate: TODAY, dailyClicks: 95 }),
      );

      const result = await dao.incrementClicksTransaction("user-1", 5);

      expect(result).toBe(true);
      expect(transaction.update).toHaveBeenCalled();
    });

    it("returns false without updating when the increment would exceed the daily cap", async () => {
      transaction.get.mockResolvedValue(
        fakeSnapshot({ lastClickDate: TODAY, dailyClicks: 96 }),
      );

      const result = await dao.incrementClicksTransaction("user-1", 5);

      expect(result).toBe(false);
      expect(transaction.update).not.toHaveBeenCalled();
    });

    // Documents current behavior: the cap is only enforced for same-day
    // increments, so a single new-day call larger than the cap is accepted.
    // Flagged in the test report as a potential source-code issue.
    it("currently allows a single new-day increment larger than the daily cap", async () => {
      transaction.get.mockResolvedValue(
        fakeSnapshot({ lastClickDate: YESTERDAY, dailyClicks: 0 }),
      );

      const result = await dao.incrementClicksTransaction("user-1", 150);

      expect(result).toBe(true);
      expect(transaction.update).toHaveBeenCalledWith(
        "docRef",
        expect.objectContaining({ dailyClicks: 150 }),
      );
    });
  });

  // ── subscribe ─────────────────────────────────────────────────────────────

  describe("subscribe", () => {
    it("invokes the callback with mapped data when the document exists", () => {
      const callback = vi.fn();
      const created = new Date("2026-01-01T00:00:00Z");
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_ref: any, onNext: any, _onErr: any) => {
          onNext(
            fakeSnapshot({
              displayName: "Alice",
              totalClicks: 10,
              createdAt: created,
              updatedAt: created,
            }),
          );
          return vi.fn();
        },
      );

      dao.subscribe("user-1", callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          displayName: "Alice",
          totalClicks: 10,
        }),
      );
    });

    it("invokes the callback with null when the document does not exist", () => {
      const callback = vi.fn();
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockImplementation((_ref: any, onNext: any) => {
        onNext(fakeSnapshot(null));
        return vi.fn();
      });

      dao.subscribe("user-1", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("logs subscription errors without invoking the callback", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const callback = vi.fn();
        vi.mocked(doc).mockReturnValue("docRef" as any);
        vi.mocked(onSnapshot).mockImplementation(
          (_ref: any, _onNext: any, onErr: any) => {
            onErr(new Error("boom"));
            return vi.fn();
          },
        );

        dao.subscribe("user-1", callback);

        expect(warnSpy).toHaveBeenCalled();
        expect(callback).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      expect(dao.subscribe("user-1", vi.fn())).toBe(unsubFn);
    });
  });

  // ── getLeaderboard ────────────────────────────────────────────────────────

  describe("getLeaderboard", () => {
    it("queries top N by totalClicks descending and maps entries", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(orderBy).mockReturnValue("orderByClause" as any);
      vi.mocked(limit).mockReturnValue("limitClause" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(
        fakeQuerySnapshot([
          { id: "u1", data: { displayName: "Alice", totalClicks: 100 } },
          { id: "u2", data: {} },
        ]) as any,
      );

      const result = await dao.getLeaderboard(10);

      expect(collection).toHaveBeenCalledWith(fakeDb, "userGameData");
      expect(orderBy).toHaveBeenCalledWith("totalClicks", "desc");
      expect(limit).toHaveBeenCalledWith(10);
      expect(query).toHaveBeenCalledWith("colRef", "orderByClause", "limitClause");
      expect(result).toEqual([
        { userId: "u1", displayName: "Alice", totalClicks: 100 },
        { userId: "u2", displayName: "", totalClicks: 0 },
      ]);
    });

    it("returns an empty array when there are no entries", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(fakeQuerySnapshot([]) as any);

      expect(await dao.getLeaderboard(5)).toEqual([]);
    });
  });

  // ── subscribeToLeaderboard ────────────────────────────────────────────────

  describe("subscribeToLeaderboard", () => {
    it("invokes the callback with mapped entries", () => {
      const callback = vi.fn();
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_q: any, onNext: any, _onErr: any) => {
          onNext(
            fakeQuerySnapshot([
              { id: "u1", data: { displayName: "Alice", totalClicks: 9 } },
            ]),
          );
          return vi.fn();
        },
      );

      dao.subscribeToLeaderboard(3, callback);

      expect(callback).toHaveBeenCalledWith([
        { userId: "u1", displayName: "Alice", totalClicks: 9 },
      ]);
    });

    it("logs errors and invokes the callback with an empty list", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const callback = vi.fn();
        vi.mocked(collection).mockReturnValue("colRef" as any);
        vi.mocked(query).mockReturnValue("queryRef" as any);
        vi.mocked(onSnapshot).mockImplementation(
          (_q: any, _onNext: any, onErr: any) => {
            onErr(new Error("boom"));
            return vi.fn();
          },
        );

        dao.subscribeToLeaderboard(3, callback);

        expect(warnSpy).toHaveBeenCalled();
        expect(callback).toHaveBeenCalledWith([]);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      expect(dao.subscribeToLeaderboard(3, vi.fn())).toBe(unsubFn);
    });
  });
});
