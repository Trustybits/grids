import { describe, expect, it, vi } from "vitest";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
} from "@grids/contracts/types";
import {
  RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE,
  assertResponsiveLayoutMigrationUnblocked,
  configureResponsiveLayoutBackfillProject,
  createFirestoreResponsiveLayoutBackfillDependencies,
  formatResponsiveLayoutBackfillSummary,
  parseResponsiveLayoutBackfillArgs,
  runResponsiveLayoutBackfill,
  type ResponsiveLayoutBackfillDependencies,
  type ResponsiveLayoutBackfillDocument,
  type ResponsiveLayoutBackfillSummary,
} from "../utils_backfillResponsiveLayoutVersion.js";

const LEGACY_RESPONSIVE_LAYOUT_VERSION = "legacy-v1";

const doc = (
  id: string,
  data: Record<string, unknown>,
): ResponsiveLayoutBackfillDocument => ({ id, data });

describe("parseResponsiveLayoutBackfillArgs", () => {
  it("requires an explicit project and defaults to dry-run", () => {
    expect(parseResponsiveLayoutBackfillArgs(["--project", "grids-dev"])).toEqual(
      {
        project: "grids-dev",
        commit: false,
        confirm: undefined,
      },
    );
    expect(() => parseResponsiveLayoutBackfillArgs([])).toThrow(
      "--project <projectId> is required.",
    );
  });

  it("accepts a commit only with a matching typed project confirmation", () => {
    expect(
      parseResponsiveLayoutBackfillArgs([
        "--project",
        "grids-dev",
        "--commit",
        "--confirm",
        "grids-dev",
      ]),
    ).toEqual({
      project: "grids-dev",
      commit: true,
      confirm: "grids-dev",
    });

    expect(() =>
      parseResponsiveLayoutBackfillArgs([
        "--project",
        "grids-dev",
        "--commit",
      ]),
    ).toThrow("--commit requires --confirm grids-dev");
    expect(() =>
      parseResponsiveLayoutBackfillArgs([
        "--project",
        "grids-dev",
        "--commit",
        "--confirm",
        "grids-prod",
      ]),
    ).toThrow("--commit requires --confirm grids-dev");
  });

  it.each([
    [["--project"], "--project requires a value."],
    [
      ["--project", "grids-dev", "--unknown"],
      "Unknown argument: --unknown",
    ],
    [
      ["--project", "grids-dev", "--project", "grids-prod"],
      "--project may only be provided once.",
    ],
    [
      ["--project", "grids-dev", "--commit", "--commit"],
      "--commit may only be provided once.",
    ],
  ])("rejects ambiguous or invalid arguments: %j", (argv, message) => {
    expect(() => parseResponsiveLayoutBackfillArgs(argv)).toThrow(message);
  });
});

describe("configureResponsiveLayoutBackfillProject", () => {
  it("sets both Firebase project environment variables", () => {
    const env: NodeJS.ProcessEnv = {};
    configureResponsiveLayoutBackfillProject("grids-dev", env);
    expect(env).toMatchObject({
      GOOGLE_CLOUD_PROJECT: "grids-dev",
      GCLOUD_PROJECT: "grids-dev",
    });
  });

  it("rejects a configured project that differs from --project", () => {
    expect(() =>
      configureResponsiveLayoutBackfillProject("grids-dev", {
        GOOGLE_CLOUD_PROJECT: "grids-prod",
      }),
    ).toThrow(
      "GOOGLE_CLOUD_PROJECT is grids-prod, which does not match --project grids-dev.",
    );
  });
});

describe("runResponsiveLayoutBackfill", () => {
  it("refuses an unconfirmed commit before reading any documents", async () => {
    const dependencies: ResponsiveLayoutBackfillDependencies = {
      fetchPage: vi.fn(),
      stampIfEligible: vi.fn(),
    };

    await expect(
      runResponsiveLayoutBackfill(
        { project: "grids-dev", commit: true },
        dependencies,
      ),
    ).rejects.toThrow("--commit requires --confirm grids-dev");
    expect(dependencies.fetchPage).not.toHaveBeenCalled();
    expect(dependencies.stampIfEligible).not.toHaveBeenCalled();
  });

  it("paginates every grid and dry-runs missing and legacy candidates", async () => {
    const pages = new Map<string | undefined, ResponsiveLayoutBackfillDocument[]>([
      [
        undefined,
        [
          doc("a", {}),
          doc("b", {
            responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION,
          }),
        ],
      ],
      [
        "b",
        [
          doc("c", {
            responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
          }),
          doc("d", { responsiveLayoutVersion: "griddle-v2" }),
          doc("e", { responsiveLayoutVersion: null }),
        ],
      ],
      ["e", []],
    ]);
    const fetchPage = vi.fn(async (afterId: string | undefined) =>
      pages.get(afterId) ?? [],
    );
    const stampIfEligible = vi.fn();

    const summary = await runResponsiveLayoutBackfill(
      { project: "grids-dev", commit: false },
      { fetchPage, stampIfEligible },
    );

    expect(fetchPage.mock.calls).toEqual([
      [undefined, RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE],
      ["b", RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE],
      ["e", RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE],
    ]);
    expect(stampIfEligible).not.toHaveBeenCalled();
    expect(summary).toEqual({
      pages: 2,
      scanned: 5,
      missing: 1,
      explicitLegacy: 1,
      explicitGriddle: 1,
      unknown: 2,
      unknownDocumentIds: ["d", "e"],
      wouldUpdate: 2,
      updated: 0,
      skippedConcurrentCurrent: 0,
      skippedConcurrentDeleted: 0,
      concurrentUnknown: 0,
      concurrentUnknownDocumentIds: [],
    });
  });

  it("commits both missing and legacy candidates", async () => {
    const dependencies = singlePageDependencies([
      doc("missing", {}),
      doc("legacy", {
        responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION,
      }),
      doc("griddle", {
        responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      }),
    ]);
    vi.mocked(dependencies.stampIfEligible).mockResolvedValue("updated");

    const summary = await runResponsiveLayoutBackfill(
      commitArgs,
      dependencies,
    );

    expect(dependencies.stampIfEligible).toHaveBeenCalledTimes(2);
    expect(dependencies.stampIfEligible).toHaveBeenNthCalledWith(1, "missing");
    expect(dependencies.stampIfEligible).toHaveBeenNthCalledWith(2, "legacy");
    expect(summary).toMatchObject({
      missing: 1,
      explicitLegacy: 1,
      explicitGriddle: 1,
      wouldUpdate: 0,
      updated: 2,
    });
  });

  it("classifies concurrent current, deleted, and unknown outcomes", async () => {
    const dependencies = singlePageDependencies([
      doc("current", {}),
      doc("deleted", {}),
      doc("unknown", {
        responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION,
      }),
    ]);
    vi.mocked(dependencies.stampIfEligible)
      .mockResolvedValueOnce("skipped-concurrent-current")
      .mockResolvedValueOnce("skipped-concurrent-deleted")
      .mockResolvedValueOnce("blocked-concurrent-unknown");

    const summary = await runResponsiveLayoutBackfill(
      commitArgs,
      dependencies,
    );

    expect(summary).toMatchObject({
      missing: 2,
      explicitLegacy: 1,
      updated: 0,
      skippedConcurrentCurrent: 1,
      skippedConcurrentDeleted: 1,
      concurrentUnknown: 1,
      concurrentUnknownDocumentIds: ["unknown"],
    });
  });

  it("is idempotent across committed reruns", async () => {
    const records = new Map<string, Record<string, unknown>>([
      ["missing", {}],
      [
        "legacy",
        { responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION },
      ],
      [
        "griddle",
        { responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION },
      ],
    ]);
    const dependencies = mapBackedDependencies(records);

    const first = await runResponsiveLayoutBackfill(commitArgs, dependencies);
    const second = await runResponsiveLayoutBackfill(commitArgs, dependencies);

    expect(first).toMatchObject({
      missing: 1,
      explicitLegacy: 1,
      explicitGriddle: 1,
      updated: 2,
    });
    expect(second).toMatchObject({
      missing: 0,
      explicitLegacy: 0,
      explicitGriddle: 3,
      updated: 0,
    });
  });

  it("rejects a page whose cursor does not advance", async () => {
    const dependencies: ResponsiveLayoutBackfillDependencies = {
      fetchPage: vi.fn(async () => [doc("same", {})]),
      stampIfEligible: vi.fn(),
    };

    await expect(
      runResponsiveLayoutBackfill(
        { project: "grids-dev", commit: false },
        dependencies,
      ),
    ).rejects.toThrow("Grid pagination did not advance.");
  });
});

describe("unknown-value blocking", () => {
  it("throws with actionable IDs for scan-time and concurrent unknowns", () => {
    const summary = makeSummary({
      unknown: 1,
      unknownDocumentIds: ["future"],
      concurrentUnknown: 1,
      concurrentUnknownDocumentIds: ["raced"],
    });

    expect(() => assertResponsiveLayoutMigrationUnblocked(summary)).toThrow(
      "blocked by 2 unknown value(s): future, raced",
    );
  });

  it("accepts a zero-unknown summary", () => {
    expect(() =>
      assertResponsiveLayoutMigrationUnblocked(makeSummary()),
    ).not.toThrow();
  });
});

describe("createFirestoreResponsiveLayoutBackfillDependencies", () => {
  it("orders and pages by document ID", async () => {
    const harness = firestoreHarness({});
    const dependencies = createFirestoreResponsiveLayoutBackfillDependencies(
      harness.firestore,
      harness.documentIdField,
    );

    await expect(dependencies.fetchPage("grid-0", 300)).resolves.toEqual([
      { id: "grid-1", data: {} },
    ]);
    expect(harness.collection).toHaveBeenCalledWith("grids");
    expect(harness.orderBy).toHaveBeenCalledWith(harness.documentIdField);
    expect(harness.limit).toHaveBeenCalledWith(300);
    expect(harness.startAfter).toHaveBeenCalledWith("grid-0");
  });

  it.each([
    ["missing", {}],
    [
      "legacy",
      { responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION },
    ],
  ])("writes only griddle-v1 for an eligible %s value", async (_label, data) => {
    const harness = firestoreHarness(data);
    const dependencies = createFirestoreResponsiveLayoutBackfillDependencies(
      harness.firestore,
      harness.documentIdField,
    );

    await expect(dependencies.stampIfEligible("grid-1")).resolves.toBe(
      "updated",
    );
    expect(harness.transactionGet).toHaveBeenCalledWith(harness.documentRef);
    expect(harness.transactionUpdate).toHaveBeenCalledExactlyOnceWith(
      harness.documentRef,
      { responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION },
    );
  });

  it("safely skips a concurrent griddle-v1 write", async () => {
    const harness = firestoreHarness({
      responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    });
    const dependencies = createFirestoreResponsiveLayoutBackfillDependencies(
      harness.firestore,
      harness.documentIdField,
    );

    await expect(dependencies.stampIfEligible("grid-1")).resolves.toBe(
      "skipped-concurrent-current",
    );
    expect(harness.transactionUpdate).not.toHaveBeenCalled();
  });

  it.each(["griddle-v2", null, 1])(
    "blocks a concurrent unknown value %j without overwriting it",
    async (responsiveLayoutVersion) => {
      const harness = firestoreHarness({ responsiveLayoutVersion });
      const dependencies =
        createFirestoreResponsiveLayoutBackfillDependencies(
          harness.firestore,
          harness.documentIdField,
        );

      await expect(dependencies.stampIfEligible("grid-1")).resolves.toBe(
        "blocked-concurrent-unknown",
      );
      expect(harness.transactionUpdate).not.toHaveBeenCalled();
    },
  );

  it("safely skips a concurrently deleted document", async () => {
    const harness = firestoreHarness({}, false);
    const dependencies = createFirestoreResponsiveLayoutBackfillDependencies(
      harness.firestore,
      harness.documentIdField,
    );

    await expect(dependencies.stampIfEligible("grid-1")).resolves.toBe(
      "skipped-concurrent-deleted",
    );
    expect(harness.transactionUpdate).not.toHaveBeenCalled();
  });
});

describe("formatResponsiveLayoutBackfillSummary", () => {
  it("formats counters, IDs, and a blocking outcome deterministically", () => {
    const summary = makeSummary({
      pages: 2,
      scanned: 5,
      missing: 1,
      explicitLegacy: 1,
      explicitGriddle: 1,
      unknown: 1,
      unknownDocumentIds: ["future"],
      wouldUpdate: 2,
      concurrentUnknown: 1,
      concurrentUnknownDocumentIds: ["raced"],
    });

    expect(
      formatResponsiveLayoutBackfillSummary(
        { project: "grids-dev", commit: false },
        summary,
      ),
    ).toEqual([
      "=== Responsive layout griddle-v1 migration summary ===",
      "Mode:                       dry-run",
      "Pages scanned:              2",
      "Grid documents scanned:     5",
      "Missing field:              1",
      "Explicit legacy-v1:         1",
      "Explicit griddle-v1:        1",
      "Unknown at scan:            1",
      "Unknown after re-read:      1",
      "Blocking unknown total:     2",
      "Unknown document IDs:       future",
      "Concurrent unknown IDs:     raced",
      "Would update:               2",
      "Updated:                    0",
      "Skipped already current:    0",
      "Skipped concurrently gone:  0",
      "Outcome:                    BLOCKED",
    ]);
  });
});

const commitArgs = {
  project: "grids-dev",
  commit: true,
  confirm: "grids-dev",
} as const;

function makeSummary(
  overrides: Partial<ResponsiveLayoutBackfillSummary> = {},
): ResponsiveLayoutBackfillSummary {
  return {
    pages: 0,
    scanned: 0,
    missing: 0,
    explicitLegacy: 0,
    explicitGriddle: 0,
    unknown: 0,
    unknownDocumentIds: [],
    wouldUpdate: 0,
    updated: 0,
    skippedConcurrentCurrent: 0,
    skippedConcurrentDeleted: 0,
    concurrentUnknown: 0,
    concurrentUnknownDocumentIds: [],
    ...overrides,
  };
}

function singlePageDependencies(
  documents: ResponsiveLayoutBackfillDocument[],
): ResponsiveLayoutBackfillDependencies {
  return {
    fetchPage: vi.fn(async (afterId: string | undefined) =>
      afterId === undefined ? documents : [],
    ),
    stampIfEligible: vi.fn(),
  };
}

function mapBackedDependencies(
  records: Map<string, Record<string, unknown>>,
): ResponsiveLayoutBackfillDependencies {
  return {
    fetchPage: vi.fn(async (afterId: string | undefined) =>
      afterId === undefined
        ? [...records.entries()].map(([id, data]) => doc(id, { ...data }))
        : [],
    ),
    stampIfEligible: vi.fn(async (id: string) => {
      const data = records.get(id);
      if (!data) return "skipped-concurrent-deleted" as const;
      const hasVersion = Object.prototype.hasOwnProperty.call(
        data,
        "responsiveLayoutVersion",
      );
      const version = data.responsiveLayoutVersion;
      if (version === GRIDDLE_RESPONSIVE_LAYOUT_VERSION) {
        return "skipped-concurrent-current" as const;
      }
      if (hasVersion && version !== LEGACY_RESPONSIVE_LAYOUT_VERSION) {
        return "blocked-concurrent-unknown" as const;
      }
      data.responsiveLayoutVersion = GRIDDLE_RESPONSIVE_LAYOUT_VERSION;
      return "updated" as const;
    }),
  };
}

function firestoreHarness(
  latestData: Record<string, unknown>,
  latestExists = true,
) {
  const documentIdField = {} as FirebaseFirestore.FieldPath;
  const documentRef = { path: "grids/grid-1" };
  const transactionGet = vi.fn(async () => ({
    exists: latestExists,
    data: () => latestData,
  }));
  const transactionUpdate = vi.fn();
  const runTransaction = vi.fn(
    async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({ get: transactionGet, update: transactionUpdate }),
  );
  const get = vi.fn(async () => ({
    docs: [{ id: "grid-1", data: () => ({}) }],
  }));
  const startAfter = vi.fn(() => ({ get }));
  const limit = vi.fn(() => ({ startAfter, get }));
  const orderBy = vi.fn(() => ({ limit }));
  const docRef = vi.fn(() => documentRef);
  const collection = vi.fn(() => ({ orderBy, doc: docRef }));

  return {
    firestore: {
      collection,
      runTransaction,
    } as unknown as FirebaseFirestore.Firestore,
    documentIdField,
    documentRef,
    collection,
    orderBy,
    limit,
    startAfter,
    transactionGet,
    transactionUpdate,
  };
}
