/**
 * Unit tests for the sweepOrphanedSubcollections scheduled function.
 *
 * Covers:
 *  - maintenance gate: no-op (admin.firestore / recursiveDelete untouched),
 *    returns null
 *  - happy path: a phantom tile (id absent from grid.tiles) whose newest message
 *    is older than the 24h grace is recursiveDelete'd by its own tileRef
 *  - scope guard (critical): recursiveDelete is only ever handed a tileRef —
 *    never the grid ref, so the grid doc itself is never wiped here
 *  - live-tile skip: a tile id still present in grid.tiles is left alone and its
 *    messages are never even read
 *  - 24h message grace: an orphan with a message newer than 24h is skipped; the
 *    exact-24h boundary deletes
 *  - active-grid skip: a grid whose updatedAt is within the 1h active window is
 *    skipped wholesale (tiles never enumerated); a missing / old / exactly-1h
 *    updatedAt reads as not-active so the grid is still swept
 *  - conservative skip when message age can't be determined (empty messages
 *    subcollection, or a non-numeric / unparseable createdAt)
 *  - timestamp normalization: numeric and Timestamp-like (toMillis) message
 *    createdAt both work
 *  - non-array grid.tiles is treated as an empty live set
 *  - per-grid resilience: one grid throwing does not abort the sweep
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { recursiveDelete, firestoreSpy, dbState } = vi.hoisted(() => {
  const dbState = { gridDocs: [] as Array<{ id: string }> };
  const recursiveDelete = vi.fn();

  // A cursor-paginating fake of the grids query chain:
  //   collection("grids").orderBy(...).limit(n).startAfter(doc).get()
  // Ordering is ignored (the seed array is already the canonical order); slices
  // come straight off dbState.gridDocs by id cursor + limit.
  const makeQuery = (startAfterId: string | null, limit: number | null) => ({
    orderBy: () => makeQuery(startAfterId, limit),
    limit: (n: number) => makeQuery(startAfterId, n),
    startAfter: (doc: { id: string }) => makeQuery(doc.id, limit),
    get: async () => {
      const all = dbState.gridDocs;
      let start = 0;
      if (startAfterId !== null) {
        const idx = all.findIndex((doc) => doc.id === startAfterId);
        start = idx >= 0 ? idx + 1 : all.length;
      }
      const end = limit === null ? all.length : start + limit;
      const docs = all.slice(start, end);
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  });

  const db = {
    collection: (_name: string) => makeQuery(null, null),
    recursiveDelete,
  };
  const firestoreSpy = Object.assign(vi.fn(() => db), {
    FieldPath: { documentId: () => "__name__" },
  });
  return { recursiveDelete, firestoreSpy, dbState };
});

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    pubsub: {
      schedule: vi.fn(() => ({
        timeZone: vi.fn(() => ({
          onRun: (handler: unknown) => handler,
        })),
      })),
    },
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: { firestore: firestoreSpy },
}));

vi.mock("../../maintenance.js", () => ({ noopIfMaintenance: vi.fn() }));

import {
  sweepOrphanedSubcollections as handlerExport,
  GRIDS_PAGE_SIZE,
  MAX_DELETIONS_PER_RUN,
} from "../onSchedule_sweepOrphanedSubcollections.js";

const runSweep = handlerExport as unknown as () => Promise<unknown>;

// ── Time anchor ───────────────────────────────────────────────────────────────
const NOW = new Date("2026-06-29T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A Firestore server-Timestamp-like value (grid.updatedAt shape). */
function ts(millis: number) {
  return { toMillis: () => millis };
}

// ── Mock builders ─────────────────────────────────────────────────────────────

type MessageSpec =
  | { empty: true }
  | { empty?: false; createdAt: unknown };

interface TileRefMock {
  __kind: "tileRef";
  id: string;
  collection: ReturnType<typeof vi.fn>;
}

function makeTileRef(id: string, messages: MessageSpec): TileRefMock {
  const get = vi.fn(async () => {
    if ("empty" in messages && messages.empty) {
      return { empty: true, docs: [] };
    }
    return {
      empty: false,
      docs: [
        {
          data: () => ({
            createdAt: (messages as { createdAt: unknown }).createdAt,
          }),
        },
      ],
    };
  });
  const limit = vi.fn(() => ({ get }));
  const orderBy = vi.fn(() => ({ limit }));
  const collection = vi.fn(() => ({ orderBy }));
  return { __kind: "tileRef", id, collection };
}

interface GridDocMock {
  id: string;
  data: () => Record<string, unknown>;
  ref: {
    __kind: "gridRef";
    __gridId: string;
    collection: ReturnType<typeof vi.fn>;
    listDocuments: ReturnType<typeof vi.fn>;
  };
}

interface GridSpec {
  id: string;
  tiles?: unknown;
  updatedAt?: unknown;
  tileRefs?: TileRefMock[];
  listDocumentsThrows?: boolean;
}

function makeGridDoc(spec: GridSpec): GridDocMock {
  const listDocuments = vi.fn(async () => {
    if (spec.listDocumentsThrows) throw new Error("listDocuments boom");
    return spec.tileRefs ?? [];
  });
  const ref = {
    __kind: "gridRef" as const,
    __gridId: spec.id,
    collection: vi.fn(() => ({ listDocuments })),
    listDocuments,
  };
  return {
    id: spec.id,
    data: () => ({ tiles: spec.tiles, updatedAt: spec.updatedAt }),
    ref,
  };
}

/** Seed the grids the sweep will enumerate. */
function seedGrids(...docs: GridDocMock[]): void {
  dbState.gridDocs = docs;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  dbState.gridDocs = [];
  recursiveDelete.mockReset().mockResolvedValue(undefined);
  firestoreSpy.mockClear();
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sweepOrphanedSubcollections", () => {
  it("no-ops without touching Firestore when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [makeTileRef("orphan", { createdAt: NOW - 2 * DAY })],
      }),
    );

    await expect(runSweep()).resolves.toBeNull();

    expect(firestoreSpy).not.toHaveBeenCalled();
    expect(recursiveDelete).not.toHaveBeenCalled();
  });

  it("recursively deletes a stale orphan tile by its own tileRef", async () => {
    const orphan = makeTileRef("orphan-1", { createdAt: NOW - 2 * DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [{ i: "live-1" }],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [orphan],
      }),
    );

    await expect(runSweep()).resolves.toBeNull();

    expect(recursiveDelete).toHaveBeenCalledTimes(1);
    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
    expect(logger.info).toHaveBeenCalledWith(
      "Swept orphaned tile subcollection",
      { gridId: "grid-1", tileId: "orphan-1" },
    );
  });

  it("never passes the grid ref to recursiveDelete (scope guard)", async () => {
    const orphan = makeTileRef("orphan-1", { createdAt: NOW - 2 * DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [orphan],
      }),
    );

    await runSweep();

    expect(recursiveDelete).toHaveBeenCalled();
    for (const [arg] of recursiveDelete.mock.calls) {
      expect((arg as { __kind: string }).__kind).toBe("tileRef");
      expect((arg as { __kind: string }).__kind).not.toBe("gridRef");
    }
  });

  it("skips a tile that is still live and never reads its messages", async () => {
    const live = makeTileRef("live-1", { createdAt: NOW - 2 * DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [{ i: "live-1" }],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [live],
      }),
    );

    await runSweep();

    expect(recursiveDelete).not.toHaveBeenCalled();
    // Live tiles short-circuit before the messages subcollection is touched.
    expect(live.collection).not.toHaveBeenCalled();
  });

  it("skips an orphan whose newest message is within the 24h grace", async () => {
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [makeTileRef("orphan-1", { createdAt: NOW - 1 * HOUR })],
      }),
    );

    await runSweep();

    expect(recursiveDelete).not.toHaveBeenCalled();
  });

  it("deletes an orphan whose newest message is exactly 24h old (boundary)", async () => {
    const orphan = makeTileRef("orphan-1", { createdAt: NOW - DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [orphan],
      }),
    );

    await runSweep();

    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
  });

  it("normalizes a Timestamp-like message createdAt via toMillis", async () => {
    const orphan = makeTileRef("orphan-1", { createdAt: ts(NOW - 2 * DAY) });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [orphan],
      }),
    );

    await runSweep();

    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
  });

  it("conservatively skips an orphan with no messages", async () => {
    const orphan = makeTileRef("orphan-1", { empty: true });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [orphan],
      }),
    );

    await runSweep();

    expect(recursiveDelete).not.toHaveBeenCalled();
  });

  it("conservatively skips an orphan whose message createdAt is unparseable", async () => {
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [makeTileRef("orphan-1", { createdAt: "not-a-timestamp" })],
      }),
    );

    await runSweep();

    expect(recursiveDelete).not.toHaveBeenCalled();
  });

  it("skips an actively-edited grid wholesale without enumerating its tiles", async () => {
    const grid = makeGridDoc({
      id: "grid-1",
      tiles: [],
      updatedAt: ts(NOW - 30 * 60 * 1000), // 30 min ago → within 1h window
      tileRefs: [makeTileRef("orphan-1", { createdAt: NOW - 2 * DAY })],
    });
    seedGrids(grid);

    await runSweep();

    expect(grid.ref.listDocuments).not.toHaveBeenCalled();
    expect(recursiveDelete).not.toHaveBeenCalled();
  });

  it("treats a grid whose updatedAt is exactly 1h old as not active (boundary)", async () => {
    const orphan = makeTileRef("orphan-1", { createdAt: NOW - 2 * DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - HOUR), // exactly the 1h window → not active
        tileRefs: [orphan],
      }),
    );

    await runSweep();

    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
  });

  it("sweeps a grid with a missing updatedAt (not treated as active)", async () => {
    const orphan = makeTileRef("orphan-1", { createdAt: NOW - 2 * DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: undefined,
        tileRefs: [orphan],
      }),
    );

    await runSweep();

    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
  });

  it("treats a non-array grid.tiles as an empty live set", async () => {
    const orphan = makeTileRef("orphan-1", { createdAt: NOW - 2 * DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: undefined,
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [orphan],
      }),
    );

    await runSweep();

    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
  });

  it("paginates past the first page to reach orphans on a later page", async () => {
    // Fill a full page with empty grids, then put the only orphan on the grid
    // that lands on page 2. It is reclaimed only if the cursor advances.
    const filler = Array.from({ length: GRIDS_PAGE_SIZE }, (_, i) =>
      makeGridDoc({
        id: `filler-${i}`,
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [],
      }),
    );
    const orphan = makeTileRef("orphan-late", { createdAt: NOW - 2 * DAY });
    const lateGrid = makeGridDoc({
      id: "grid-page-2",
      tiles: [],
      updatedAt: ts(NOW - 2 * HOUR),
      tileRefs: [orphan],
    });
    seedGrids(...filler, lateGrid);

    await runSweep();

    expect(recursiveDelete).toHaveBeenCalledTimes(1);
    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
  });

  it("stops at the per-run deletion cap and warns that work was deferred", async () => {
    // One grid holding more orphans than the cap allows.
    const orphans = Array.from({ length: MAX_DELETIONS_PER_RUN + 5 }, (_, i) =>
      makeTileRef(`orphan-${i}`, { createdAt: NOW - 2 * DAY }),
    );
    seedGrids(
      makeGridDoc({
        id: "grid-1",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: orphans,
      }),
    );

    await expect(runSweep()).resolves.toBeNull();

    expect(recursiveDelete).toHaveBeenCalledTimes(MAX_DELETIONS_PER_RUN);
    // The orphans beyond the cap are left for the next run.
    expect(recursiveDelete).not.toHaveBeenCalledWith(
      orphans[MAX_DELETIONS_PER_RUN],
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("per-run deletion cap"),
      expect.objectContaining({
        deleted: MAX_DELETIONS_PER_RUN,
        cap: MAX_DELETIONS_PER_RUN,
      }),
    );
  });

  it("continues the sweep when one grid throws, and logs that grid's failure", async () => {
    const orphan = makeTileRef("orphan-2", { createdAt: NOW - 2 * DAY });
    seedGrids(
      makeGridDoc({
        id: "grid-bad",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        listDocumentsThrows: true,
      }),
      makeGridDoc({
        id: "grid-good",
        tiles: [],
        updatedAt: ts(NOW - 2 * HOUR),
        tileRefs: [orphan],
      }),
    );

    await expect(runSweep()).resolves.toBeNull();

    // The healthy grid is still swept despite the earlier failure.
    expect(recursiveDelete).toHaveBeenCalledTimes(1);
    expect(recursiveDelete).toHaveBeenCalledWith(orphan);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed sweeping grid for orphaned subcollections",
      expect.objectContaining({ gridId: "grid-bad" }),
    );
  });
});
