import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { FirestoreBusinessStatsDao } from "../FirestoreBusinessStatsDao.js";
import type { Firestore } from "firebase/firestore";

vi.mock("firebase/firestore", () => {
  class FakeTimestamp {
    public seconds: number;
    public nanoseconds: number;
    public constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    public toDate(): Date {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
    }
  }
  return {
    Timestamp: FakeTimestamp,
    collection: vi.fn(),
    doc: vi.fn(),
    documentId: vi.fn(() => "__name__"),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn((...args: unknown[]) => ({ __where: args })),
  };
});

// Re-import the (mocked) Timestamp class so tests can construct instances
// that satisfy the `instanceof Timestamp` check inside the DAO.
import { Timestamp as MockedTimestamp } from "firebase/firestore";
const FakeTimestamp = MockedTimestamp as unknown as new (
  seconds: number,
  nanoseconds: number,
) => { toDate(): Date };

const fakeDb = {} as Firestore;

function fakeSnapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

function fakeQueryResult(docs: Array<Record<string, unknown>>) {
  return { docs: docs.map((d) => ({ data: () => d })) };
}

describe("FirestoreBusinessStatsDao", () => {
  let dao: FirestoreBusinessStatsDao;

  beforeEach(() => {
    dao = new FirestoreBusinessStatsDao(fakeDb);
  });

  // ── getAggregate ────────────────────────────────────────────────────────

  describe("getAggregate", () => {
    it("reads businessStats/global and maps full data", async () => {
      const updated = new FakeTimestamp(1700, 0);
      const data = {
        totalGridsCreated: 10,
        totalGridsDeleted: 2,
        activeGrids: 8,
        totalUsers: 100,
        totalLogins: 500,
        totalOwnerVisits: 42,
        tileAdds: { text: 5 },
        tileDeletes: { image: 1 },
        updatedAt: updated,
      };
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(data) as any);

      const result = await dao.getAggregate();

      expect(doc).toHaveBeenCalledWith(fakeDb, "businessStats", "global");
      expect(getDoc).toHaveBeenCalledWith("docRef");
      expect(result).toEqual({
        totalGridsCreated: 10,
        totalGridsDeleted: 2,
        activeGrids: 8,
        totalUsers: 100,
        totalLogins: 500,
        totalOwnerVisits: 42,
        tileAdds: { text: 5 },
        tileDeletes: { image: 1 },
        updatedAt: updated.toDate(),
      });
    });

    it("returns null when the aggregate document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(null) as any);

      const result = await dao.getAggregate();
      expect(result).toBeNull();
    });

    it("defaults missing numeric/object fields and uses epoch when updatedAt is not a Timestamp", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot({}) as any);

      const result = await dao.getAggregate();

      expect(result).toEqual({
        totalGridsCreated: 0,
        totalGridsDeleted: 0,
        activeGrids: 0,
        totalUsers: 0,
        totalLogins: 0,
        totalOwnerVisits: 0,
        tileAdds: {},
        tileDeletes: {},
        updatedAt: new Date(0),
      });
    });
  });

  // ── getDaily ────────────────────────────────────────────────────────────

  describe("getDaily", () => {
    it("reads the businessStats/daily__{date} document and includes the date field", async () => {
      const data = {
        totalGridsCreated: 1,
        date: "2026-05-07",
      };
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(data) as any);

      const result = await dao.getDaily("2026-05-07");

      expect(doc).toHaveBeenCalledWith(
        fakeDb,
        "businessStats",
        "daily__2026-05-07",
      );
      expect(result).toMatchObject({
        totalGridsCreated: 1,
        date: "2026-05-07",
      });
    });

    it("returns null when the daily document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(null) as any);

      const result = await dao.getDaily("2026-05-07");
      expect(result).toBeNull();
    });
  });

  // ── getDailyRange ───────────────────────────────────────────────────────

  describe("getDailyRange", () => {
    it("queries businessStats by documentId() between daily__start and daily__end", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(
        fakeQueryResult([
          { date: "2026-05-01", totalUsers: 10 },
          { date: "2026-05-02", totalUsers: 11 },
        ]) as any,
      );

      const result = await dao.getDailyRange("2026-05-01", "2026-05-02");

      expect(collection).toHaveBeenCalledWith(fakeDb, "businessStats");
      expect(documentId).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith("__name__", ">=", "daily__2026-05-01");
      expect(where).toHaveBeenCalledWith("__name__", "<=", "daily__2026-05-02");
      expect(query).toHaveBeenCalledWith(
        "colRef",
        expect.objectContaining({ __where: expect.any(Array) }),
        expect.objectContaining({ __where: expect.any(Array) }),
      );
      expect(getDocs).toHaveBeenCalledWith("queryRef");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ date: "2026-05-01", totalUsers: 10 });
      expect(result[1]).toMatchObject({ date: "2026-05-02", totalUsers: 11 });
    });

    it("returns an empty array when no documents match", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(fakeQueryResult([]) as any);

      const result = await dao.getDailyRange("2026-05-01", "2026-05-02");
      expect(result).toEqual([]);
    });
  });
});
