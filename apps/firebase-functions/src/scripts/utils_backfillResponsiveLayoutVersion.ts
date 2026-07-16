import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
} from "@grids/contracts/types";

// Old-data sentinel used only by the maintainer migration. It is intentionally
// not part of the supported responsive-layout contract.
const LEGACY_RESPONSIVE_LAYOUT_VERSION = "legacy-v1";

export const RESPONSIVE_LAYOUT_VERSION_FIELD =
  "responsiveLayoutVersion" as const;
export const RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE = 300;

export interface ResponsiveLayoutBackfillArgs {
  project: string;
  commit: boolean;
  confirm?: string;
}

export interface ResponsiveLayoutBackfillDocument {
  id: string;
  data: Record<string, unknown>;
}

export type ResponsiveLayoutStampResult = "updated" | "skipped-concurrent";

export interface ResponsiveLayoutBackfillDependencies {
  fetchPage(
    afterId: string | undefined,
    pageSize: number,
  ): Promise<ResponsiveLayoutBackfillDocument[]>;
  stampIfAbsent(id: string): Promise<ResponsiveLayoutStampResult>;
}

export interface ResponsiveLayoutBackfillSummary {
  pages: number;
  scanned: number;
  missing: number;
  explicitLegacy: number;
  explicitGriddle: number;
  unknown: number;
  wouldUpdate: number;
  updated: number;
  skippedConcurrent: number;
}

export function parseResponsiveLayoutBackfillArgs(
  argv: string[],
): ResponsiveLayoutBackfillArgs {
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
  assertResponsiveLayoutBackfillAuthorized(args);
  return args;
}

export function configureResponsiveLayoutBackfillProject(
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

export function createFirestoreResponsiveLayoutBackfillDependencies(
  firestore: FirebaseFirestore.Firestore,
  documentIdField: FirebaseFirestore.FieldPath,
): ResponsiveLayoutBackfillDependencies {
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

    async stampIfAbsent(id) {
      const ref = grids.doc(id);
      return firestore.runTransaction(async (transaction) => {
        const latest = await transaction.get(ref);
        if (
          !latest.exists ||
          hasOwn(latest.data() ?? {}, RESPONSIVE_LAYOUT_VERSION_FIELD)
        ) {
          return "skipped-concurrent";
        }

        transaction.update(ref, {
          [RESPONSIVE_LAYOUT_VERSION_FIELD]:
            LEGACY_RESPONSIVE_LAYOUT_VERSION,
        });
        return "updated";
      });
    },
  };
}

export async function runResponsiveLayoutBackfill(
  args: ResponsiveLayoutBackfillArgs,
  dependencies: ResponsiveLayoutBackfillDependencies,
): Promise<ResponsiveLayoutBackfillSummary> {
  assertResponsiveLayoutBackfillAuthorized(args);

  const summary: ResponsiveLayoutBackfillSummary = {
    pages: 0,
    scanned: 0,
    missing: 0,
    explicitLegacy: 0,
    explicitGriddle: 0,
    unknown: 0,
    wouldUpdate: 0,
    updated: 0,
    skippedConcurrent: 0,
  };

  let afterId: string | undefined;
  for (;;) {
    const page = await dependencies.fetchPage(
      afterId,
      RESPONSIVE_LAYOUT_BACKFILL_PAGE_SIZE,
    );
    if (page.length === 0) break;
    summary.pages += 1;

    for (const doc of page) {
      summary.scanned += 1;
      if (!hasOwn(doc.data, RESPONSIVE_LAYOUT_VERSION_FIELD)) {
        summary.missing += 1;
        if (!args.commit) {
          summary.wouldUpdate += 1;
          continue;
        }

        const result = await dependencies.stampIfAbsent(doc.id);
        if (result === "updated") summary.updated += 1;
        else summary.skippedConcurrent += 1;
        continue;
      }

      const version = doc.data[RESPONSIVE_LAYOUT_VERSION_FIELD];
      if (version === LEGACY_RESPONSIVE_LAYOUT_VERSION) {
        summary.explicitLegacy += 1;
      } else if (version === GRIDDLE_RESPONSIVE_LAYOUT_VERSION) {
        summary.explicitGriddle += 1;
      } else {
        summary.unknown += 1;
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

export function formatResponsiveLayoutBackfillSummary(
  args: ResponsiveLayoutBackfillArgs,
  summary: ResponsiveLayoutBackfillSummary,
): string[] {
  return [
    "=== Responsive layout version backfill summary ===",
    `Mode:                       ${args.commit ? "COMMIT" : "dry-run"}`,
    `Pages scanned:              ${summary.pages}`,
    `Grid documents scanned:     ${summary.scanned}`,
    `Missing field:              ${summary.missing}`,
    `Explicit legacy-v1:         ${summary.explicitLegacy}`,
    `Explicit griddle-v1:        ${summary.explicitGriddle}`,
    `Unknown/invalid value:      ${summary.unknown}`,
    `Would update:               ${summary.wouldUpdate}`,
    `Updated:                    ${summary.updated}`,
    `Skipped after re-read:      ${summary.skippedConcurrent}`,
  ];
}

function readFlagValue(argv: string[], index: number, name: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`--${name} requires a value.`);
  }
  return value;
}

function assertResponsiveLayoutBackfillAuthorized(
  args: ResponsiveLayoutBackfillArgs,
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
