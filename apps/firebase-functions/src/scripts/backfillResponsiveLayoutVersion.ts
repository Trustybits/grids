/**
 * Admin script: migrate known responsive-layout stamps to griddle-v1.
 *
 * The script is dry-run by default. A write run requires an explicit project,
 * --commit, and a matching --confirm value:
 *
 *   npm run build
 *   node lib/scripts/backfillResponsiveLayoutVersion.js --project <project>
 *   node lib/scripts/backfillResponsiveLayoutVersion.js \
 *     --project <project> --commit --confirm <project>
 *
 * Documents where responsiveLayoutVersion is absent or exactly legacy-v1 are
 * candidates. Existing griddle-v1 documents are skipped. Unknown values block
 * successful completion and are never overwritten. Each committed candidate
 * is re-read in a transaction so a concurrent current or unknown value wins.
 * The update contains only responsiveLayoutVersion, with no revision,
 * timestamp, geometry, or override changes. Interrupted runs are safe to
 * resume.
 *
 * Authentication uses Application Default Credentials. The caller needs read
 * and update access to the target project's grids collection.
 */

import admin from "firebase-admin";
import {
  assertResponsiveLayoutMigrationUnblocked,
  configureResponsiveLayoutBackfillProject,
  createFirestoreResponsiveLayoutBackfillDependencies,
  formatResponsiveLayoutBackfillSummary,
  parseResponsiveLayoutBackfillArgs,
  runResponsiveLayoutBackfill,
} from "./utils_backfillResponsiveLayoutVersion.js";

async function main(): Promise<void> {
  const args = parseResponsiveLayoutBackfillArgs(process.argv.slice(2));
  configureResponsiveLayoutBackfillProject(args.project, process.env);

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: args.project });
  }

  console.warn(
    `responsiveLayoutVersion backfill  project=${args.project}  ` +
      `${args.commit ? "COMMIT" : "dry-run"}`,
  );

  const dependencies = createFirestoreResponsiveLayoutBackfillDependencies(
    admin.firestore(),
    admin.firestore.FieldPath.documentId(),
  );
  const summary = await runResponsiveLayoutBackfill(args, dependencies);
  for (const line of formatResponsiveLayoutBackfillSummary(args, summary)) {
    console.warn(line);
  }

  assertResponsiveLayoutMigrationUnblocked(summary);

  if (!args.commit) {
    console.warn(
      "Dry run — no writes performed. Re-run with " +
        `--commit --confirm ${args.project}.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error("Responsive layout version backfill failed:", error);
  process.exitCode = 1;
});
