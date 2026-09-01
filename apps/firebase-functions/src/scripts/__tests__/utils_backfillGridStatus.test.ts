import { describe, expect, it, vi } from "vitest";
import {
  GRID_STATUS_BACKFILL_PAGE_SIZE,
  configureGridStatusBackfillProject,
  formatGridStatusBackfillSummary,
  parseGridStatusBackfillArgs,
  runGridStatusBackfill,
  type GridStatusBackfillDependencies,
  type GridStatusBackfillDocument,
} from "../utils_backfillGridStatus.js";

const doc = (
  id: string,
  data: Record<string, unknown>,
): GridStatusBackfillDocument => ({ id, data });

describe("parseGridStatusBackfillArgs", () => {
  it("requires an explicit project and defaults to dry-run", () => {
    expect(parseGridStatusBackfillArgs(["--project", "grids-dev"])).toEqual({
      project: "grids-dev",
      commit: false,
      confirm: undefined,
    });
    expect(() => parseGridStatusBackfillArgs([])).toThrow(
      "--project <projectId> is required.",
    );
  });

  it("accepts a commit only with a matching typed project confirmation", () => {
    expect(
      parseGridStatusBackfillArgs([
        "--project",
        "grids-dev",
        "--commit",
        "--confirm",
        "grids-dev",
      ]),
    ).toEqual({ project: "grids-dev", commit: true, confirm: "grids-dev" });

    expect(() =>
      parseGridStatusBackfillArgs(["--project", "grids-dev", "--commit"]),
    ).toThrow("--commit requires --confirm grids-dev");
    expect(() =>
      parseGridStatusBackfillArgs([
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
    [["--project", "grids-dev", "--unknown"], "Unknown argument: --unknown"],
    [
      ["--project", "grids-dev", "--project", "grids-prod"],
      "--project may only be provided once.",
    ],
  ])("rejects ambiguous or invalid arguments: %j", (argv, message) => {
    expect(() => parseGridStatusBackfillArgs(argv)).toThrow(message);
  });
});

describe("configureGridStatusBackfillProject", () => {
  it("sets both Firebase project environment variables", () => {
    const env: NodeJS.ProcessEnv = {};
    configureGridStatusBackfillProject("grids-dev", env);
    expect(env).toMatchObject({
      GOOGLE_CLOUD_PROJECT: "grids-dev",
      GCLOUD_PROJECT: "grids-dev",
    });
  });

  it("rejects a configured project that differs from --project", () => {
    expect(() =>
      configureGridStatusBackfillProject("grids-dev", {
        GOOGLE_CLOUD_PROJECT: "grids-prod",
      }),
    ).toThrow(
      "GOOGLE_CLOUD_PROJECT is grids-prod, which does not match --project grids-dev.",
    );
  });
});

describe("runGridStatusBackfill", () => {
  it("refuses an unconfirmed commit before reading any documents", async () => {
    const dependencies: GridStatusBackfillDependencies = {
      fetchPage: vi.fn(),
      stampIfEligible: vi.fn(),
    };

    await expect(
      runGridStatusBackfill(
        { project: "grids-dev", commit: true, confirm: "wrong" },
        dependencies,
      ),
    ).rejects.toThrow("--commit requires --confirm grids-dev");
    expect(dependencies.fetchPage).not.toHaveBeenCalled();
  });

  it("classifies documents and only counts missing status as updatable (dry-run)", async () => {
    const page = [
      doc("missing", { userId: "u" }),
      doc("published", { userId: "u", status: "published" }),
      doc("draft", { userId: "u", status: "draft", draftOf: "published" }),
      doc("weird", { userId: "u", status: "archived" }),
    ];
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([]);
    const stampIfEligible = vi.fn();

    const summary = await runGridStatusBackfill(
      { project: "grids-dev", commit: false },
      { fetchPage, stampIfEligible },
    );

    expect(summary.scanned).toBe(4);
    expect(summary.missing).toBe(1);
    expect(summary.explicitPublished).toBe(1);
    expect(summary.explicitDraft).toBe(1);
    expect(summary.unknown).toBe(1);
    expect(summary.unknownDocumentIds).toEqual(["weird"]);
    expect(summary.wouldUpdate).toBe(1);
    expect(summary.updated).toBe(0);
    expect(stampIfEligible).not.toHaveBeenCalled();
    expect(fetchPage).toHaveBeenCalledWith(
      undefined,
      GRID_STATUS_BACKFILL_PAGE_SIZE,
    );
  });

  it("stamps only missing documents on commit and tallies each outcome", async () => {
    const page = [
      doc("a", { userId: "u" }),
      doc("b", { userId: "u" }),
      doc("c", { userId: "u" }),
      doc("d", { userId: "u", status: "published" }),
    ];
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([]);
    const stampIfEligible = vi
      .fn()
      .mockResolvedValueOnce("updated")
      .mockResolvedValueOnce("skipped-concurrent-current")
      .mockResolvedValueOnce("skipped-concurrent-deleted");

    const summary = await runGridStatusBackfill(
      { project: "grids-dev", commit: true, confirm: "grids-dev" },
      { fetchPage, stampIfEligible },
    );

    expect(stampIfEligible).toHaveBeenCalledTimes(3);
    expect(stampIfEligible).toHaveBeenNthCalledWith(1, "a");
    expect(summary.updated).toBe(1);
    expect(summary.skippedConcurrentCurrent).toBe(1);
    expect(summary.skippedConcurrentDeleted).toBe(1);
    expect(summary.explicitPublished).toBe(1);
  });

  it("paginates across pages until an empty page is returned", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce([doc("a", { userId: "u", status: "published" })])
      .mockResolvedValueOnce([doc("b", { userId: "u", status: "published" })])
      .mockResolvedValueOnce([]);

    const summary = await runGridStatusBackfill(
      { project: "grids-dev", commit: false },
      { fetchPage, stampIfEligible: vi.fn() },
    );

    expect(summary.pages).toBe(2);
    expect(summary.scanned).toBe(2);
    expect(fetchPage).toHaveBeenNthCalledWith(
      2,
      "a",
      GRID_STATUS_BACKFILL_PAGE_SIZE,
    );
  });

  it("throws if pagination fails to advance", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue([doc("stuck", { userId: "u", status: "published" })]);

    await expect(
      runGridStatusBackfill(
        { project: "grids-dev", commit: false },
        { fetchPage, stampIfEligible: vi.fn() },
      ),
    ).rejects.toThrow("Grid pagination did not advance.");
  });
});

describe("formatGridStatusBackfillSummary", () => {
  it("renders a human-readable summary with the run mode", () => {
    const lines = formatGridStatusBackfillSummary(
      { project: "grids-dev", commit: false },
      {
        pages: 1,
        scanned: 2,
        missing: 1,
        explicitPublished: 1,
        explicitDraft: 0,
        unknown: 0,
        unknownDocumentIds: [],
        wouldUpdate: 1,
        updated: 0,
        skippedConcurrentCurrent: 0,
        skippedConcurrentDeleted: 0,
      },
    );
    expect(lines[0]).toContain("Grid status published backfill summary");
    expect(lines.some((line) => line.includes("Mode:") && line.includes("dry-run"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("Would update:"))).toBe(true);
  });
});
