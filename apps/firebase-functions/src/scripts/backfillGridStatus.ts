/**
 * Admin script: stamp every existing grid with status:"published".
 *
 * The draft/publish feature makes a grid private when its `status` is not
 * "published". Legacy grids have no `status` field; this backfill writes an
 * explicit "published" so the production Firestore read gate keeps them public.
 *
 * The script is dry-run by default. A write run requires an explicit project,
 * --commit, and a matching --confirm value:
 *
 *   npm run build
 *   node lib/scripts/backfillGridStatus.js --project <project>
 *   node lib/scripts/backfillGridStatus.js \
 *     --project <project> --commit --confirm <project>
 *
 * Documents where `status` is absent are candidates. Existing "published" and
 * "draft" documents are skipped; unexpected values are reported and never
 * overwritten. Each committed candidate is re-read in a transaction so a
 * concurrent write wins. The update contains only `status`, with no revision,
 * timestamp, geometry, or override changes. Interrupted runs are safe to resume.
 *
 * Authentication uses Application Default Credentials. The caller needs read
 * and update access to the target project's grids collection.
 */

import admin from "firebase-admin";
import {
  configureGridStatusBackfillProject,
  createFirestoreGridStatusBackfillDependencies,
  formatGridStatusBackfillSummary,
  parseGridStatusBackfillArgs,
  runGridStatusBackfill,
} from "./utils_backfillGridStatus.js";

async function main(): Promise<void> {
  const args = parseGridStatusBackfillArgs(process.argv.slice(2));
  configureGridStatusBackfillProject(args.project, process.env);

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: args.project });
  }

  console.warn(
    `grid status backfill  project=${args.project}  ` +
      `${args.commit ? "COMMIT" : "dry-run"}`,
  );

  const dependencies = createFirestoreGridStatusBackfillDependencies(
    admin.firestore(),
    admin.firestore.FieldPath.documentId(),
  );
  const summary = await runGridStatusBackfill(args, dependencies);
  for (const line of formatGridStatusBackfillSummary(args, summary)) {
    console.warn(line);
  }

  if (!args.commit) {
    console.warn(
      "Dry run — no writes performed. Re-run with " +
        `--commit --confirm ${args.project}.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error("Grid status backfill failed:", error);
  process.exitCode = 1;
});
