/**
 * Tests for the onAnalyticsEventCreated Cloud Function trigger.
 *
 * The handler aggregates raw `analyticsEvents` writes into per-grid `gridStats`
 * documents and global `businessStats` documents. It is dispatched by event
 * type, so the tests are organised by event type and exercise:
 *   - validation / early-return paths
 *   - exact field shapes written to Firestore (FieldValue sentinels included)
 *   - both the lifetime aggregate and the per-day daily document
 *   - transactional read-modify-write semantics (averages, uniqueness markers)
 *   - error propagation back to Firebase for retry
 *
 * All Firebase IO is mocked: `firebase-admin` is replaced with a tiny
 * in-memory store, `firebase-functions/v1` is stubbed so .onCreate() returns
 * the raw handler, and the logger is mocked so warn/error calls are silent
 * but assertable. No real network IO occurs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as logger from "firebase-functions/logger";

// ── Hoisted shared state (so vi.mock factories can see it) ──────────────

const { dbHolder, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    increment: (value: number) => ({ __op: "increment", value }),
    serverTimestamp: () => ({ __op: "serverTimestamp" }),
  };
  const dbHolder: { db: unknown } = { db: null };
  return { dbHolder, FieldValue };
});

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("firebase-admin", () => {
  const firestoreFn: any = () => dbHolder.db;
  firestoreFn.FieldValue = FieldValue;
  return { firestore: firestoreFn, default: { firestore: firestoreFn } };
});

vi.mock("firebase-functions/v1", () => ({
  firestore: {
    document: () => ({
      // Capture and return the raw handler so tests can invoke it directly.
      onCreate: (handler: unknown) => handler,
    }),
  },
}));

vi.mock("firebase-functions/logger", () => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
}));

// Import AFTER mocks so the trigger picks them up. Cast to the raw handler
// shape since our `onCreate` mock returns the function as-is.
import { onAnalyticsEventCreated as triggerExport } from "../onAnalyticsEventCreated";
const handler = triggerExport as unknown as (
  snap: { data: () => unknown },
  ctx: { params: { docId: string } },
) => Promise<unknown>;

// ── Fake Firestore ───────────────────────────────────────────────────────

interface DocRef {
  __isDocRef: true;
  path: string;
  collection: (name: string) => CollectionRef;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
}
interface CollectionRef {
  __isColRef: true;
  path: string;
  doc: (id: string) => DocRef;
}

interface RecordedOp {
  via: "batch" | "tx";
  /** Per-transaction id, present only when via === "tx". */
  txId?: number;
  path: string;
  data: Record<string, unknown>;
  opts: Record<string, unknown> | undefined;
}

function makeFakeDb() {
  // Path -> stored data. After a merge-set we shallow-merge so that
  // recomputeAverage's read-after-write within a transaction sees prior values.
  const docs = new Map<string, Record<string, unknown>>();
  const ops: RecordedOp[] = [];

  function applyWrite(
    path: string,
    data: Record<string, unknown>,
    opts: Record<string, unknown> | undefined,
  ): void {
    if (opts && (opts as { merge?: boolean }).merge) {
      const prev = docs.get(path) ?? {};
      docs.set(path, { ...prev, ...data });
    } else {
      docs.set(path, { ...data });
    }
  }

  function makeDocRef(path: string): DocRef {
    return {
      __isDocRef: true,
      path,
      collection: (name: string) => makeCollectionRef(`${path}/${name}`),
      get: async () => ({
        exists: docs.has(path),
        data: () => docs.get(path),
      }),
    };
  }
  function makeCollectionRef(path: string): CollectionRef {
    return {
      __isColRef: true,
      path,
      doc: (id: string) => makeDocRef(`${path}/${id}`),
    };
  }

  const batchCommit = vi.fn();
  let txCounter = 0;

  const db = {
    collection: (name: string) => makeCollectionRef(name),
    batch: () => {
      const queued: Array<{
        path: string;
        data: Record<string, unknown>;
        opts: Record<string, unknown> | undefined;
      }> = [];
      return {
        set: (
          ref: DocRef,
          data: Record<string, unknown>,
          opts?: Record<string, unknown>,
        ) => {
          queued.push({ path: ref.path, data, opts });
        },
        commit: async () => {
          batchCommit();
          for (const q of queued) {
            applyWrite(q.path, q.data, q.opts);
            ops.push({ via: "batch", ...q });
          }
        },
      };
    },
    runTransaction: async (
      fn: (tx: {
        get: (ref: DocRef) => Promise<{
          exists: boolean;
          data: () => Record<string, unknown> | undefined;
        }>;
        set: (
          ref: DocRef,
          data: Record<string, unknown>,
          opts?: Record<string, unknown>,
        ) => void;
      }) => Promise<unknown>,
    ): Promise<unknown> => {
      txCounter += 1;
      const currentTxId = txCounter;
      const queued: Array<{
        path: string;
        data: Record<string, unknown>;
        opts: Record<string, unknown> | undefined;
      }> = [];
      const tx = {
        get: async (ref: DocRef) => ({
          exists: docs.has(ref.path),
          data: () => docs.get(ref.path),
        }),
        set: (
          ref: DocRef,
          data: Record<string, unknown>,
          opts?: Record<string, unknown>,
        ) => {
          queued.push({ path: ref.path, data, opts });
        },
      };
      const result = await fn(tx);
      for (const q of queued) {
        applyWrite(q.path, q.data, q.opts);
        ops.push({ via: "tx", txId: currentTxId, ...q });
      }
      return result;
    },
  };

  return {
    db,
    docs,
    ops,
    batchCommit,
    /** How many `runTransaction` calls have been made. */
    get txCount() {
      return txCounter;
    },
  };
}

function fakeTimestamp(iso: string) {
  return { toDate: () => new Date(iso) };
}

function snap(data: unknown) {
  return { data: () => data };
}

function ctx(docId = "evt-1") {
  return { params: { docId } };
}

function findOps(ops: RecordedOp[], path: string): RecordedOp[] {
  return ops.filter((o) => o.path === path);
}

// ── Setup ────────────────────────────────────────────────────────────────

let fake: ReturnType<typeof makeFakeDb>;

beforeEach(() => {
  fake = makeFakeDb();
  dbHolder.db = fake.db;
  vi.mocked(logger.warn).mockClear();
  vi.mocked(logger.error).mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Trigger-level: validation & error handling ───────────────────────────

describe("trigger: input validation", () => {
  it("warns and returns null when snapshot data is undefined", async () => {
    const result = await handler(snap(undefined), ctx("doc-1"));
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "Malformed analytics event",
      expect.objectContaining({ docId: "doc-1" }),
    );
    expect(fake.ops).toHaveLength(0);
  });

  it("warns and returns null when eventType is missing", async () => {
    await handler(
      snap({ timestamp: fakeTimestamp("2026-05-07T00:00:00Z") }),
      ctx(),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Malformed analytics event",
      expect.any(Object),
    );
    expect(fake.ops).toHaveLength(0);
  });

  it("warns and returns null when timestamp is missing", async () => {
    await handler(snap({ eventType: "grid_view" }), ctx());
    expect(logger.warn).toHaveBeenCalledWith(
      "Malformed analytics event",
      expect.any(Object),
    );
    expect(fake.ops).toHaveLength(0);
  });

  it("warns on unknown eventType and writes nothing", async () => {
    await handler(
      snap({
        eventType: "totally_made_up",
        timestamp: fakeTimestamp("2026-05-07T00:00:00Z"),
        userId: null,
        layoutId: null,
        metadata: {},
      }),
      ctx(),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Unknown analytics eventType",
      expect.objectContaining({ eventType: "totally_made_up" }),
    );
    expect(fake.ops).toHaveLength(0);
  });

  it("logs and rethrows when a handler throws (so Firebase will retry)", async () => {
    // user_login goes through applyBusinessStats → batch.commit. Force commit
    // to fail.
    const original = fake.db.batch;
    fake.db.batch = () => {
      const b = original();
      b.commit = async () => {
        throw new Error("transient firestore failure");
      };
      return b;
    };

    await expect(
      handler(
        snap({
          eventType: "user_login",
          timestamp: fakeTimestamp("2026-05-07T00:00:00Z"),
          userId: "u",
          layoutId: null,
          metadata: { signInMethod: "google" },
        }),
        ctx("evt-x"),
      ),
    ).rejects.toThrow("transient firestore failure");
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to aggregate analytics event",
      expect.objectContaining({
        docId: "evt-x",
        eventType: "user_login",
      }),
    );
  });
});

// ── grid_view ────────────────────────────────────────────────────────────

describe("grid_view", () => {
  const baseEvent = (overrides: Record<string, unknown> = {}) => ({
    eventType: "grid_view",
    timestamp: fakeTimestamp("2026-05-07T12:34:56Z"),
    userId: "u-1",
    layoutId: "layout-1",
    metadata: {
      viewerType: "authenticated",
      sessionId: "sess-1",
      viewerFingerprint: "fp-1",
    },
    ...overrides,
  });

  it("warns and writes nothing when layoutId is missing", async () => {
    await handler(snap(baseEvent({ layoutId: null })), ctx());
    expect(logger.warn).toHaveBeenCalledWith("grid_view event missing layoutId");
    expect(fake.ops).toHaveLength(0);
  });

  it("writes aggregate and daily docs with totalViews+authenticatedViews increments and ownerId", async () => {
    // Seed the layout doc so getOwnerId returns a value.
    fake.docs.set("layouts/layout-1", { userId: "owner-7" });

    await handler(snap(baseEvent()), ctx());

    expect(fake.batchCommit).toHaveBeenCalledTimes(1);

    const aggOp = findOps(fake.ops, "gridStats/layout-1").find(
      (o) => o.via === "batch",
    );
    expect(aggOp?.opts).toEqual({ merge: true });
    expect(aggOp?.data).toMatchObject({
      layoutId: "layout-1",
      ownerId: "owner-7",
      totalViews: { __op: "increment", value: 1 },
      authenticatedViews: { __op: "increment", value: 1 },
      updatedAt: { __op: "serverTimestamp" },
    });
    // No anonymousViews field for an authenticated viewer.
    expect(aggOp?.data).not.toHaveProperty("anonymousViews");

    const dailyOp = findOps(fake.ops, "gridStats/layout-1__2026-05-07").find(
      (o) => o.via === "batch",
    );
    expect(dailyOp?.opts).toEqual({ merge: true });
    expect(dailyOp?.data).toMatchObject({
      layoutId: "layout-1",
      ownerId: "owner-7",
      date: "2026-05-07",
      totalViews: { __op: "increment", value: 1 },
      authenticatedViews: { __op: "increment", value: 1 },
      updatedAt: { __op: "serverTimestamp" },
    });
    expect(dailyOp?.data).not.toHaveProperty("anonymousViews");
  });

  it("uses anonymousViews increment for anonymous viewers", async () => {
    await handler(
      snap(
        baseEvent({
          metadata: {
            viewerType: "anonymous",
            sessionId: "sess-1",
            viewerFingerprint: "fp-anon",
          },
        }),
      ),
      ctx(),
    );

    const aggOp = findOps(fake.ops, "gridStats/layout-1").find(
      (o) => o.via === "batch",
    );
    expect(aggOp?.data).toMatchObject({
      anonymousViews: { __op: "increment", value: 1 },
    });
    expect(aggOp?.data).not.toHaveProperty("authenticatedViews");
  });

  it("omits both viewer-type fields when viewerType is unrecognised", async () => {
    await handler(
      snap(
        baseEvent({
          metadata: { sessionId: "s", viewerType: "robot", viewerFingerprint: "fp" },
        }),
      ),
      ctx(),
    );
    const aggOp = findOps(fake.ops, "gridStats/layout-1").find(
      (o) => o.via === "batch",
    );
    expect(aggOp?.data).not.toHaveProperty("authenticatedViews");
    expect(aggOp?.data).not.toHaveProperty("anonymousViews");
  });

  it("omits ownerId when the layout document does not exist", async () => {
    // No seed for `layouts/layout-1` → snap.exists is false.
    await handler(snap(baseEvent()), ctx());
    const aggOp = findOps(fake.ops, "gridStats/layout-1").find(
      (o) => o.via === "batch",
    );
    expect(aggOp?.data).not.toHaveProperty("ownerId");
  });

  it("uses UTC date (slice of ISO string) regardless of local time of day", async () => {
    // 23:30 UTC on 2026-05-07
    await handler(
      snap(baseEvent({ timestamp: fakeTimestamp("2026-05-07T23:30:00Z") })),
      ctx(),
    );
    expect(fake.ops.find((o) => o.path === "gridStats/layout-1__2026-05-07")).toBeDefined();
  });

  it("creates the lifetime fingerprint marker and increments uniqueViewers on aggregate + daily on first sight", async () => {
    await handler(snap(baseEvent()), ctx());

    // Single lifetime marker doc was set by the transaction. There is no
    // per-day marker subcollection — the daily uniqueViewers increment is
    // gated on the lifetime marker being newly created.
    const markerAgg = findOps(
      fake.ops,
      "gridStats/layout-1/viewers/fp-1",
    ).find((o) => o.via === "tx");
    expect(markerAgg?.data).toEqual({
      firstSeenAt: { __op: "serverTimestamp" },
    });

    const markerDaily = findOps(
      fake.ops,
      "gridStats/layout-1__2026-05-07/viewers/fp-1",
    );
    expect(markerDaily).toHaveLength(0);

    // uniqueViewers increment was set on both the aggregate and daily refs
    // via the same transaction.
    const uniqAgg = findOps(fake.ops, "gridStats/layout-1").find(
      (o) =>
        o.via === "tx" &&
        (o.data as Record<string, unknown>).uniqueViewers !== undefined,
    );
    expect(uniqAgg?.opts).toEqual({ merge: true });
    expect(uniqAgg?.data).toEqual({
      uniqueViewers: { __op: "increment", value: 1 },
    });

    const uniqDaily = findOps(
      fake.ops,
      "gridStats/layout-1__2026-05-07",
    ).find(
      (o) =>
        o.via === "tx" &&
        (o.data as Record<string, unknown>).uniqueViewers !== undefined,
    );
    expect(uniqDaily).toBeDefined();
  });

  it("does not run uniqueness transactions when viewerFingerprint is missing", async () => {
    await handler(
      snap(
        baseEvent({
          metadata: { viewerType: "authenticated", sessionId: "s" },
        }),
      ),
      ctx(),
    );
    expect(fake.ops.every((o) => o.via === "batch")).toBe(true);
  });

  it("does NOT increment uniqueViewers when the lifetime marker already exists", async () => {
    // Pre-seed the lifetime marker doc — viewer is a returning visitor.
    fake.docs.set("gridStats/layout-1/viewers/fp-1", {
      firstSeenAt: { __op: "serverTimestamp" },
    });

    await handler(snap(baseEvent()), ctx());

    // No transaction-originated writes should have happened (tx returned early).
    expect(fake.ops.every((o) => o.via === "batch")).toBe(true);
  });
});

// ── grid_view_end ────────────────────────────────────────────────────────

describe("grid_view_end", () => {
  const evt = (overrides: Record<string, unknown> = {}) => ({
    eventType: "grid_view_end",
    timestamp: fakeTimestamp("2026-05-07T00:00:00Z"),
    userId: null,
    layoutId: "layout-1",
    metadata: { sessionId: "sess-1", durationMs: 5000 },
    ...overrides,
  });

  it("warns when layoutId is missing and writes nothing", async () => {
    await handler(snap(evt({ layoutId: null })), ctx());
    expect(logger.warn).toHaveBeenCalledWith(
      "grid_view_end event missing layoutId",
    );
    expect(fake.ops).toHaveLength(0);
  });

  it.each([
    ["NaN durationMs", { sessionId: "s" }],
    ["zero durationMs", { sessionId: "s", durationMs: 0 }],
    ["negative durationMs", { sessionId: "s", durationMs: -100 }],
    ["non-numeric durationMs", { sessionId: "s", durationMs: "abc" }],
  ])("warns and writes nothing for %s", async (_label, metadata) => {
    await handler(snap(evt({ metadata })), ctx());
    expect(logger.warn).toHaveBeenCalledWith(
      "grid_view_end event has invalid durationMs",
      expect.any(Object),
    );
    expect(fake.ops).toHaveLength(0);
  });

  it("computes totalTimeSpentMs/totalSessions/averageTimeSpentMs from scratch when stats doc does not exist", async () => {
    fake.docs.set("layouts/layout-1", { userId: "owner-9" });
    await handler(snap(evt({ metadata: { durationMs: 4000 } })), ctx());

    const aggOp = findOps(fake.ops, "gridStats/layout-1")[0];
    expect(aggOp?.via).toBe("tx");
    expect(aggOp?.opts).toEqual({ merge: true });
    expect(aggOp?.data).toEqual({
      layoutId: "layout-1",
      ownerId: "owner-9",
      totalTimeSpentMs: 4000,
      totalSessions: 1,
      averageTimeSpentMs: 4000,
      updatedAt: { __op: "serverTimestamp" },
    });

    const dailyOp = findOps(fake.ops, "gridStats/layout-1__2026-05-07")[0];
    expect(dailyOp?.data).toMatchObject({
      layoutId: "layout-1",
      date: "2026-05-07",
      totalTimeSpentMs: 4000,
      totalSessions: 1,
      averageTimeSpentMs: 4000,
    });
  });

  it("accumulates and rounds the average when prior totals exist", async () => {
    fake.docs.set("layouts/layout-1", { userId: "owner-9" });
    // Prior aggregate: 3 sessions totalling 9000ms (avg 3000). Add a 5000ms
    // session → total 14000, sessions 4, avg round(14000/4) = 3500.
    fake.docs.set("gridStats/layout-1", {
      totalTimeSpentMs: 9000,
      totalSessions: 3,
      averageTimeSpentMs: 3000,
    });
    // Prior daily: 1 session of 1000ms → adding 5000 → total 6000, sessions 2,
    // avg 3000.
    fake.docs.set("gridStats/layout-1__2026-05-07", {
      totalTimeSpentMs: 1000,
      totalSessions: 1,
      averageTimeSpentMs: 1000,
    });

    await handler(snap(evt({ metadata: { durationMs: 5000 } })), ctx());

    const aggOp = findOps(fake.ops, "gridStats/layout-1")[0];
    expect(aggOp?.data).toMatchObject({
      totalTimeSpentMs: 14000,
      totalSessions: 4,
      averageTimeSpentMs: 3500,
    });

    const dailyOp = findOps(fake.ops, "gridStats/layout-1__2026-05-07")[0];
    expect(dailyOp?.data).toMatchObject({
      totalTimeSpentMs: 6000,
      totalSessions: 2,
      averageTimeSpentMs: 3000,
    });
  });

  it("rounds non-integer averages to the nearest millisecond", async () => {
    fake.docs.set("layouts/layout-1", { userId: "owner-9" });
    // 2 sessions totalling 1001ms gives avg 500.5 → rounded 501.
    fake.docs.set("gridStats/layout-1", {
      totalTimeSpentMs: 1,
      totalSessions: 1,
    });
    fake.docs.set("gridStats/layout-1__2026-05-07", {
      totalTimeSpentMs: 1,
      totalSessions: 1,
    });

    await handler(snap(evt({ metadata: { durationMs: 1000 } })), ctx());

    const aggOp = findOps(fake.ops, "gridStats/layout-1")[0];
    expect(aggOp?.data).toMatchObject({
      totalTimeSpentMs: 1001,
      totalSessions: 2,
      averageTimeSpentMs: 501,
    });
  });
});

// ── tile_added / tile_removed ────────────────────────────────────────────

describe("tile_added / tile_removed", () => {
  const baseTile = (
    eventType: "tile_added" | "tile_removed",
    metadata: Record<string, unknown>,
  ) => ({
    eventType,
    timestamp: fakeTimestamp("2026-05-07T10:00:00Z"),
    userId: "u-1",
    layoutId: "layout-1",
    metadata,
  });

  it("warns when tileType is missing (tile_added)", async () => {
    await handler(snap(baseTile("tile_added", { tileId: "x" })), ctx());
    expect(logger.warn).toHaveBeenCalledWith(
      "tile_added event missing tileType",
    );
    expect(fake.ops).toHaveLength(0);
  });

  it("warns when tileType is missing (tile_removed)", async () => {
    await handler(snap(baseTile("tile_removed", { tileId: "x" })), ctx());
    expect(logger.warn).toHaveBeenCalledWith(
      "tile_removed event missing tileType",
    );
  });

  it("increments businessStats.tileAdds.<tileType> on the global and daily docs", async () => {
    await handler(
      snap(baseTile("tile_added", { tileId: "t1", tileType: "image" })),
      ctx(),
    );

    const globalOp = findOps(fake.ops, "businessStats/global")[0];
    expect(globalOp?.via).toBe("batch");
    expect(globalOp?.opts).toEqual({ merge: true });
    expect(globalOp?.data).toEqual({
      "tileAdds.image": { __op: "increment", value: 1 },
      updatedAt: { __op: "serverTimestamp" },
    });

    const dailyOp = findOps(fake.ops, "businessStats/daily__2026-05-07")[0];
    expect(dailyOp?.data).toEqual({
      "tileAdds.image": { __op: "increment", value: 1 },
      updatedAt: { __op: "serverTimestamp" },
      date: "2026-05-07",
    });
  });

  it("increments businessStats.tileDeletes.<tileType> on the global and daily docs", async () => {
    await handler(
      snap(baseTile("tile_removed", { tileId: "t1", tileType: "video" })),
      ctx(),
    );
    const globalOp = findOps(fake.ops, "businessStats/global")[0];
    expect(globalOp?.data).toMatchObject({
      "tileDeletes.video": { __op: "increment", value: 1 },
    });
  });
});

// ── business-stats-only handlers (parametric) ────────────────────────────

describe("business-stats handlers", () => {
  const cases: Array<{
    eventType: string;
    extra?: Record<string, unknown>;
    expectedDelta: Record<string, unknown>;
  }> = [
    {
      eventType: "grid_created",
      expectedDelta: {
        totalGridsCreated: { __op: "increment", value: 1 },
        activeGrids: { __op: "increment", value: 1 },
      },
    },
    {
      eventType: "grid_deleted",
      expectedDelta: {
        totalGridsDeleted: { __op: "increment", value: 1 },
        activeGrids: { __op: "increment", value: -1 },
      },
    },
    {
      eventType: "user_signup",
      expectedDelta: { totalUsers: { __op: "increment", value: 1 } },
    },
    {
      eventType: "user_login",
      expectedDelta: { totalLogins: { __op: "increment", value: 1 } },
    },
    {
      eventType: "owner_grid_enter",
      expectedDelta: { totalOwnerVisits: { __op: "increment", value: 1 } },
    },
  ];

  for (const c of cases) {
    it(`${c.eventType}: writes the right delta to businessStats/global and daily`, async () => {
      await handler(
        snap({
          eventType: c.eventType,
          timestamp: fakeTimestamp("2026-05-07T01:00:00Z"),
          userId: "u",
          layoutId: c.eventType === "owner_grid_enter" ? "layout-1" : null,
          metadata: c.extra ?? {},
        }),
        ctx(),
      );

      expect(fake.batchCommit).toHaveBeenCalledTimes(1);

      const globalOp = findOps(fake.ops, "businessStats/global")[0];
      expect(globalOp?.opts).toEqual({ merge: true });
      expect(globalOp?.data).toMatchObject({
        ...c.expectedDelta,
        updatedAt: { __op: "serverTimestamp" },
      });

      const dailyOp = findOps(fake.ops, "businessStats/daily__2026-05-07")[0];
      expect(dailyOp?.opts).toEqual({ merge: true });
      expect(dailyOp?.data).toMatchObject({
        ...c.expectedDelta,
        date: "2026-05-07",
      });
    });
  }
});

describe("grid_view_end: ownerId, gating, and atomicity (per spec §3.5)", () => {
  const evt = (overrides: Record<string, unknown> = {}) => ({
    eventType: "grid_view_end",
    timestamp: fakeTimestamp("2026-05-07T12:00:00Z"),
    userId: null,
    layoutId: "layout-1",
    metadata: { sessionId: "sess-1", durationMs: 5000 },
    ...overrides,
  });

  it("skips aggregation entirely when the layout document does not exist", async () => {
    // No seed for `layouts/layout-1`. Spec §3.5: handler should warn and
    // perform no writes — partial creation of a stats doc would leave it
    // missing the required `ownerId` field (§1.1) and break owner reads (§8).
    await handler(snap(evt()), ctx("evt-orphan"));

    expect(fake.ops).toHaveLength(0);
    expect(fake.txCount).toBe(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("includes ownerId on both the aggregate and daily docs when creating them", async () => {
    fake.docs.set("layouts/layout-1", { userId: "owner-9" });
    await handler(snap(evt({ metadata: { durationMs: 4000 } })), ctx());

    const aggOp = findOps(fake.ops, "gridStats/layout-1")[0];
    expect(aggOp?.data).toMatchObject({
      layoutId: "layout-1",
      ownerId: "owner-9",
    });

    const dailyOp = findOps(fake.ops, "gridStats/layout-1__2026-05-07")[0];
    expect(dailyOp?.data).toMatchObject({
      layoutId: "layout-1",
      ownerId: "owner-9",
      date: "2026-05-07",
    });
  });

  it("performs the aggregate and daily updates inside a single Firestore transaction", async () => {
    // Spec §3.5: the cross-document read-modify-write must be atomic so
    // that a Firebase retry after a partial failure cannot double-apply
    // durationMs / totalSessions to the side that already committed.
    fake.docs.set("layouts/layout-1", { userId: "owner-9" });
    await handler(snap(evt({ metadata: { durationMs: 4000 } })), ctx());

    expect(fake.txCount).toBe(1);

    // Both stats writes should share the same txId (i.e. commit together).
    const txOps = fake.ops.filter((o) => o.via === "tx");
    const txIds = new Set(txOps.map((o) => o.txId));
    expect(txOps.length).toBeGreaterThanOrEqual(2);
    expect(txIds.size).toBe(1);
  });
});
