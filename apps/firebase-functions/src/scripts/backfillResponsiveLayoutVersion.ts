/**
 * Admin script: stamp unversioned grid documents as responsive legacy-v1.
 *
 * The script is dry-run by default. A write run requires an explicit project,
 * --commit, and a matching --confirm value:
 *
 *   npm run build
 *   node lib/scripts/backfillResponsiveLayoutVersion.js --project <project>
 *   node lib/scripts/backfillResponsiveLayoutVersion.js \
 *     --project <project> --commit --confirm <project>
 *
 * Only documents where responsiveLayoutVersion is absent are candidates.
 * Existing legacy-v1, griddle-v1, and unknown values are never rewritten. Each
 * committed candidate is re-read in a transaction so a value added during the
 * scan wins. The update contains only responsiveLayoutVersion, with no revision
 * or timestamp changes. Interrupted runs are safe to resume.
 *
 * Authentication uses Application Default Credentials. The caller needs read
 * and update access to the target project's grids collection.
 */

import admin from "firebase-admin";
import {
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
