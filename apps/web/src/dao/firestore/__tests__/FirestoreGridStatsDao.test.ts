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
import { FirestoreGridStatsDao } from "../FirestoreGridStatsDao";
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

describe("FirestoreGridStatsDao", () => {
  let dao: FirestoreGridStatsDao;

  beforeEach(() => {
    dao = new FirestoreGridStatsDao(fakeDb);
  });

  // ── getAggregate ────────────────────────────────────────────────────────

  describe("getAggregate", () => {
    it("reads gridStats/{gridId} and maps full data", async () => {
      const updated = new FakeTimestamp(1700, 0);
      const data = {
        gridId: "grid-1",
        ownerId: "user-1",
        totalViews: 50,
        uniqueViewers: 30,
        authenticatedViews: 20,
        anonymousViews: 30,
        totalTimeSpentMs: 60000,
        totalSessions: 10,
        averageTimeSpentMs: 6000,
        updatedAt: updated,
      };
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(data) as any);

      const result = await dao.getAggregate("grid-1");

      expect(doc).toHaveBeenCalledWith(fakeDb, "gridStats", "grid-1");
      expect(getDoc).toHaveBeenCalledWith("docRef");
      expect(result).toEqual({
        gridId: "grid-1",
        ownerId: "user-1",
        totalViews: 50,
        uniqueViewers: 30,
        authenticatedViews: 20,
        anonymousViews: 30,
        totalTimeSpentMs: 60000,
        totalSessions: 10,
        averageTimeSpentMs: 6000,
        updatedAt: updated.toDate(),
      });
    });

    it("returns null when the aggregate document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(null) as any);

      const result = await dao.getAggregate("grid-missing");
      expect(result).toBeNull();
    });

    it("defaults missing numeric fields to 0 and uses epoch when updatedAt is not a Timestamp", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(
        fakeSnapshot({
          gridId: "grid-1",
          ownerId: "user-1",
        }) as any,
      );

      const result = await dao.getAggregate("grid-1");

      expect(result).toEqual({
        gridId: "grid-1",
        ownerId: "user-1",
        totalViews: 0,
        uniqueViewers: 0,
        authenticatedViews: 0,
        anonymousViews: 0,
        totalTimeSpentMs: 0,
        totalSessions: 0,
        averageTimeSpentMs: 0,
        updatedAt: new Date(0),
      });
    });
  });

  // ── getDaily ────────────────────────────────────────────────────────────

  describe("getDaily", () => {
    it("reads the gridStats/{gridId}__{date} document and includes the date field", async () => {
      const data = {
        gridId: "grid-1",
        ownerId: "user-1",
        totalViews: 3,
        date: "2026-05-07",
      };
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(data) as any);

      const result = await dao.getDaily("grid-1", "2026-05-07");

      expect(doc).toHaveBeenCalledWith(
        fakeDb,
        "gridStats",
        "grid-1__2026-05-07",
      );
      expect(result).toMatchObject({
        gridId: "grid-1",
        date: "2026-05-07",
        totalViews: 3,
      });
    });

    it("returns null when the daily document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot(null) as any);

      const result = await dao.getDaily("grid-1", "2026-05-07");
      expect(result).toBeNull();
    });
  });

  // ── getDailyRange ───────────────────────────────────────────────────────

  describe("getDailyRange", () => {
    it("queries gridStats by documentId() between {gridId}__{start} and {gridId}__{end}", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(
        fakeQueryResult([
          { gridId: "grid-1", date: "2026-05-01", totalViews: 1 },
          { gridId: "grid-1", date: "2026-05-02", totalViews: 2 },
        ]) as any,
      );

      const result = await dao.getDailyRange(
        "grid-1",
        "2026-05-01",
        "2026-05-02",
      );

      expect(collection).toHaveBeenCalledWith(fakeDb, "gridStats");
      expect(documentId).toHaveBeenCalled();
      expect(where).toHaveBeenCalledWith(
        "__name__",
        ">=",
        "grid-1__2026-05-01",
      );
      expect(where).toHaveBeenCalledWith(
        "__name__",
        "<=",
        "grid-1__2026-05-02",
      );
      expect(query).toHaveBeenCalledWith(
        "colRef",
        expect.objectContaining({ __where: expect.any(Array) }),
        expect.objectContaining({ __where: expect.any(Array) }),
      );
      expect(getDocs).toHaveBeenCalledWith("queryRef");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ date: "2026-05-01", totalViews: 1 });
      expect(result[1]).toMatchObject({ date: "2026-05-02", totalViews: 2 });
    });

    it("returns an empty array when no documents match", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(fakeQueryResult([]) as any);

      const result = await dao.getDailyRange(
        "grid-1",
        "2026-05-01",
        "2026-05-02",
      );
      expect(result).toEqual([]);
    });
  });
});
