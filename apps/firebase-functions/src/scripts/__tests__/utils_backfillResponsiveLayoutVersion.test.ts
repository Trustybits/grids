import { describe, expect, it, vi } from "vitest";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
} from "@grids/contracts/types";
import {
  RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE,
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
      stampIfAbsent: vi.fn(),
    };

    await expect(
      runResponsiveLayoutBackfill(
        { project: "grids-dev", commit: true },
        dependencies,
      ),
    ).rejects.toThrow("--commit requires --confirm grids-dev");
    expect(dependencies.fetchPage).not.toHaveBeenCalled();
    expect(dependencies.stampIfAbsent).not.toHaveBeenCalled();
  });

  it("paginates every grid and dry-runs only documents with an absent field", async () => {
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
    const stampIfAbsent = vi.fn();

    const summary = await runResponsiveLayoutBackfill(
      { project: "grids-dev", commit: false },
      { fetchPage, stampIfAbsent },
    );

    expect(fetchPage.mock.calls).toEqual([
      [undefined, RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE],
      ["b", RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE],
      ["e", RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE],
    ]);
    expect(stampIfAbsent).not.toHaveBeenCalled();
    expect(summary).toEqual({
      pages: 2,
      scanned: 5,
      missing: 1,
      explicitLegacy: 1,
      explicitGriddle: 1,
      unknown: 2,
      wouldUpdate: 1,
      updated: 0,
      skippedConcurrent: 0,
    });
  });

  it("commits only scan-time missing documents", async () => {
    const dependencies = singlePageDependencies([
      doc("missing", {}),
      doc("legacy", {
        responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION,
      }),
      doc("griddle", {
        responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      }),
      doc("future", { responsiveLayoutVersion: "griddle-v2" }),
    ]);
    vi.mocked(dependencies.stampIfAbsent).mockResolvedValue("updated");

    const summary = await runResponsiveLayoutBackfill(
      {
        project: "grids-dev",
        commit: true,
        confirm: "grids-dev",
      },
      dependencies,
    );

    expect(dependencies.stampIfAbsent).toHaveBeenCalledExactlyOnceWith(
      "missing",
    );
    expect(summary).toMatchObject({
      missing: 1,
      explicitLegacy: 1,
      explicitGriddle: 1,
      unknown: 1,
      wouldUpdate: 0,
      updated: 1,
      skippedConcurrent: 0,
    });
  });

  it("counts a field that appears concurrently without overwriting it", async () => {
    const dependencies = singlePageDependencies([doc("grid-1", {})]);
    vi.mocked(dependencies.stampIfAbsent).mockResolvedValue(
      "skipped-concurrent",
    );

    const summary = await runResponsiveLayoutBackfill(
      {
        project: "grids-dev",
        commit: true,
        confirm: "grids-dev",
      },
      dependencies,
    );

    expect(summary).toMatchObject({
      missing: 1,
      updated: 0,
      skippedConcurrent: 1,
    });
  });

  it("is idempotent across committed reruns", async () => {
    const records = new Map<string, Record<string, unknown>>([
      ["missing", {}],
      [
        "griddle",
        { responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION },
      ],
    ]);
    const dependencies = mapBackedDependencies(records);
    const args = {
      project: "grids-dev",
      commit: true,
      confirm: "grids-dev",
    } as const;

    const first = await runResponsiveLayoutBackfill(args, dependencies);
    const second = await runResponsiveLayoutBackfill(args, dependencies);

    expect(first).toMatchObject({ missing: 1, updated: 1 });
    expect(second).toMatchObject({
      missing: 0,
      explicitLegacy: 1,
      explicitGriddle: 1,
      updated: 0,
    });
  });

  it("rejects a page whose cursor does not advance", async () => {
    const dependencies: ResponsiveLayoutBackfillDependencies = {
      fetchPage: vi.fn(async () => [doc("same", {})]),
      stampIfAbsent: vi.fn(),
    };

    await expect(
      runResponsiveLayoutBackfill(
        { project: "grids-dev", commit: false },
        dependencies,
      ),
    ).rejects.toThrow("Grid pagination did not advance.");
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

  it("transactionally updates only responsiveLayoutVersion when still absent", async () => {
    const harness = firestoreHarness({});
    const dependencies = createFirestoreResponsiveLayoutBackfillDependencies(
      harness.firestore,
      harness.documentIdField,
    );

    await expect(dependencies.stampIfAbsent("grid-1")).resolves.toBe("updated");
    expect(harness.transactionGet).toHaveBeenCalledWith(harness.documentRef);
    expect(harness.transactionUpdate).toHaveBeenCalledExactlyOnceWith(
      harness.documentRef,
      { responsiveLayoutVersion: LEGACY_RESPONSIVE_LAYOUT_VERSION },
    );
  });

  it.each([
    [false, {}],
    [true, { responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION }],
    [true, { responsiveLayoutVersion: "griddle-v2" }],
  ])(
    "skips a missing or concurrently changed document (exists=%s, data=%j)",
    async (exists, data) => {
      const harness = firestoreHarness(data, exists);
      const dependencies =
        createFirestoreResponsiveLayoutBackfillDependencies(
          harness.firestore,
          harness.documentIdField,
        );

      await expect(dependencies.stampIfAbsent("grid-1")).resolves.toBe(
        "skipped-concurrent",
      );
      expect(harness.transactionUpdate).not.toHaveBeenCalled();
    },
  );
});

describe("formatResponsiveLayoutBackfillSummary", () => {
  it("formats counters in a deterministic order", () => {
    const summary: ResponsiveLayoutBackfillSummary = {
      pages: 2,
      scanned: 5,
      missing: 1,
      explicitLegacy: 1,
      explicitGriddle: 1,
      unknown: 2,
      wouldUpdate: 1,
      updated: 0,
      skippedConcurrent: 0,
    };

    expect(
      formatResponsiveLayoutBackfillSummary(
        { project: "grids-dev", commit: false },
        summary,
      ),
    ).toEqual([
      "=== Responsive layout version backfill summary ===",
      "Mode:                       dry-run",
      "Pages scanned:              2",
      "Grid documents scanned:     5",
      "Missing field:              1",
      "Explicit legacy-v1:         1",
      "Explicit griddle-v1:        1",
      "Unknown/invalid value:      2",
      "Would update:               1",
      "Updated:                    0",
      "Skipped after re-read:      0",
    ]);
  });
});

function singlePageDependencies(
  documents: ResponsiveLayoutBackfillDocument[],
): ResponsiveLayoutBackfillDependencies {
  return {
    fetchPage: vi.fn(async (afterId: string | undefined) =>
      afterId === undefined ? documents : [],
    ),
    stampIfAbsent: vi.fn(),
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
    stampIfAbsent: vi.fn(async (id: string) => {
      const data = records.get(id);
      if (
        !data ||
        Object.prototype.hasOwnProperty.call(
          data,
          "responsiveLayoutVersion",
        )
      ) {
        return "skipped-concurrent" as const;
      }
      data.responsiveLayoutVersion = LEGACY_RESPONSIVE_LAYOUT_VERSION;
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
