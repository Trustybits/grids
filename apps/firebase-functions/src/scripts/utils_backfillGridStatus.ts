// Backfill helper: stamp every existing grid document with an explicit
// `status: "published"` so the draft/publish read gate treats legacy grids as
// public. A grid with no `status` field is a legacy public grid; the gate also
// defaults missing → public, but backfilling makes the value explicit so the
// production Firestore rule can rely on it without a null-fallback branch.
//
// Mirrors utils_backfillResponsiveLayoutVersion: dry-run by default, an
// explicit --project, and a --commit that requires a matching --confirm.
// Candidates are re-read inside a transaction so a concurrent write wins.

export const GRID_STATUS_FIELD = "status" as const;
export const PUBLISHED_STATUS = "published" as const;
export const DRAFT_STATUS = "draft" as const;
export const GRID_STATUS_BACKFILL_PAGE_SIZE = 300;

export interface GridStatusBackfillArgs {
  project: string;
  commit: boolean;
  confirm?: string;
}

export interface GridStatusBackfillDocument {
  id: string;
  data: Record<string, unknown>;
}

export type GridStatusStampResult =
  | "updated"
  | "skipped-concurrent-current"
  | "skipped-concurrent-deleted";

export interface GridStatusBackfillDependencies {
  fetchPage(
    afterId: string | undefined,
    pageSize: number,
  ): Promise<GridStatusBackfillDocument[]>;
  stampIfEligible(id: string): Promise<GridStatusStampResult>;
}

export interface GridStatusBackfillSummary {
  pages: number;
  scanned: number;
  missing: number;
  explicitPublished: number;
  explicitDraft: number;
  unknown: number;
  unknownDocumentIds: string[];
  wouldUpdate: number;
  updated: number;
  skippedConcurrentCurrent: number;
  skippedConcurrentDeleted: number;
}

type GridStatusValueClassification =
  | "missing"
  | "published"
  | "draft"
  | "unknown";

export function parseGridStatusBackfillArgs(
  argv: string[],
): GridStatusBackfillArgs {
  let project: string | undefined;
  let confirm: string | undefined;
  let commit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--project": {
        if (project !== undefined) {
          throw new Error("--project may only be provided once.");
        }
        project = readFlagValue(argv, ++index, "project");
        break;
      }
      case "--confirm": {
        if (confirm !== undefined) {
          throw new Error("--confirm may only be provided once.");
        }
        confirm = readFlagValue(argv, ++index, "confirm");
        break;
      }
      case "--commit":
        if (commit) throw new Error("--commit may only be provided once.");
        commit = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const args = { project: project ?? "", commit, confirm };
  assertGridStatusBackfillAuthorized(args);
  return args;
}

export function configureGridStatusBackfillProject(
  project: string,
  env: NodeJS.ProcessEnv,
): void {
  for (const key of ["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT"] as const) {
    const configured = env[key];
    if (configured && configured !== project) {
      throw new Error(
        `${key} is ${configured}, which does not match --project ${project}.`,
      );
    }
    env[key] = project;
  }
}

export function createFirestoreGridStatusBackfillDependencies(
  firestore: FirebaseFirestore.Firestore,
  documentIdField: FirebaseFirestore.FieldPath,
): GridStatusBackfillDependencies {
  const grids = firestore.collection("grids");

  return {
    async fetchPage(afterId, pageSize) {
      let query: FirebaseFirestore.Query = grids
        .orderBy(documentIdField)
        .limit(pageSize);
      if (afterId !== undefined) query = query.startAfter(afterId);
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    },

    async stampIfEligible(id) {
      const ref = grids.doc(id);
      return firestore.runTransaction(async (transaction) => {
        const latest = await transaction.get(ref);
        if (!latest.exists) return "skipped-concurrent-deleted";

        // Re-read: only a still-missing status is stamped. Any explicit value
        // (published, draft, or an unexpected one) is left untouched — the
        // backfill never demotes a draft or clobbers a concurrent write.
        if (classifyGridStatusValue(latest.data() ?? {}) !== "missing") {
          return "skipped-concurrent-current";
        }

        transaction.update(ref, { [GRID_STATUS_FIELD]: PUBLISHED_STATUS });
        return "updated";
      });
    },
  };
}

export async function runGridStatusBackfill(
  args: GridStatusBackfillArgs,
  dependencies: GridStatusBackfillDependencies,
): Promise<GridStatusBackfillSummary> {
  assertGridStatusBackfillAuthorized(args);

  const summary: GridStatusBackfillSummary = {
    pages: 0,
    scanned: 0,
    missing: 0,
    explicitPublished: 0,
    explicitDraft: 0,
    unknown: 0,
    unknownDocumentIds: [],
    wouldUpdate: 0,
    updated: 0,
    skippedConcurrentCurrent: 0,
    skippedConcurrentDeleted: 0,
  };

  let afterId: string | undefined;
  for (;;) {
    const page = await dependencies.fetchPage(
      afterId,
      GRID_STATUS_BACKFILL_PAGE_SIZE,
    );
    if (page.length === 0) break;
    summary.pages += 1;

    for (const doc of page) {
      summary.scanned += 1;
      const classification = classifyGridStatusValue(doc.data);

      if (classification === "published") {
        summary.explicitPublished += 1;
        continue;
      }
      if (classification === "draft") {
        summary.explicitDraft += 1;
        continue;
      }
      if (classification === "unknown") {
        // An unexpected status value is left alone and only reported, never
        // overwritten — the same posture the responsive backfill takes.
        summary.unknown += 1;
        summary.unknownDocumentIds.push(doc.id);
        continue;
      }

      summary.missing += 1;
      if (!args.commit) {
        summary.wouldUpdate += 1;
        continue;
      }

      const result = await dependencies.stampIfEligible(doc.id);
      switch (result) {
        case "updated":
          summary.updated += 1;
          break;
        case "skipped-concurrent-current":
          summary.skippedConcurrentCurrent += 1;
          break;
        case "skipped-concurrent-deleted":
          summary.skippedConcurrentDeleted += 1;
          break;
      }
    }

    const nextAfterId = page[page.length - 1]?.id;
    if (!nextAfterId || nextAfterId === afterId) {
      throw new Error("Grid pagination did not advance.");
    }
    afterId = nextAfterId;
  }

  return summary;
}

export function formatGridStatusBackfillSummary(
  args: GridStatusBackfillArgs,
  summary: GridStatusBackfillSummary,
): string[] {
  return [
    "=== Grid status published backfill summary ===",
    `Mode:                       ${args.commit ? "COMMIT" : "dry-run"}`,
    `Pages scanned:              ${summary.pages}`,
    `Grid documents scanned:     ${summary.scanned}`,
    `Missing status:             ${summary.missing}`,
    `Explicit published:         ${summary.explicitPublished}`,
    `Explicit draft:             ${summary.explicitDraft}`,
    `Unknown status:             ${summary.unknown}`,
    `Unknown document IDs:       ${formatDocumentIds(summary.unknownDocumentIds)}`,
    `Would update:               ${summary.wouldUpdate}`,
    `Updated:                    ${summary.updated}`,
    `Skipped already set:        ${summary.skippedConcurrentCurrent}`,
    `Skipped concurrently gone:  ${summary.skippedConcurrentDeleted}`,
  ];
}

function classifyGridStatusValue(
  data: Record<string, unknown>,
): GridStatusValueClassification {
  if (!hasOwn(data, GRID_STATUS_FIELD)) return "missing";
  const status = data[GRID_STATUS_FIELD];
  if (status === PUBLISHED_STATUS) return "published";
  if (status === DRAFT_STATUS) return "draft";
  return "unknown";
}

function formatDocumentIds(ids: readonly string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}

function readFlagValue(argv: string[], index: number, name: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`--${name} requires a value.`);
  }
  return value;
}

function assertGridStatusBackfillAuthorized(
  args: GridStatusBackfillArgs,
): void {
  if (!args.project) {
    throw new Error("--project <projectId> is required.");
  }
  if (args.commit && args.confirm !== args.project) {
    throw new Error(
      `--commit requires --confirm ${args.project} ` +
        "(typed confirmation of the target project).",
    );
  }
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}
