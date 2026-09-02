/**
 * Maintainer script: migrate PostHog Early Access enrollments between features.
 *
 * The "Mobile 2.0" early access feature (flag `beta-mobile-2`) was superseded
 * by the umbrella "Early Access" feature (flag `beta-early-access`). PostHog
 * stores enrollment as the person property `$feature_enrollment/<flag-key>`,
 * and enrollments do not carry over when a feature is recreated under a new
 * key — this script copies them.
 *
 * For every person with `$feature_enrollment/beta-mobile-2 = true`, it emits a
 * `$set` event writing `$feature_enrollment/beta-early-access = true`. Persons
 * already enrolled in the target are skipped. Source enrollments are never
 * modified, so the run is idempotent and safe to repeat.
 *
 * Dry-run by default; pass --commit to write.
 *
 *   node scripts/migrate-early-access-enrollment.mjs
 *   node scripts/migrate-early-access-enrollment.mjs --commit
 *
 * Options:
 *   --from <flag-key>   source flag key   (default: beta-mobile-2)
 *   --to <flag-key>     target flag key   (default: beta-early-access)
 *   --commit            actually send the $set events
 *
 * Required environment:
 *   POSTHOG_PERSONAL_API_KEY  personal API key with person:read scope
 *                             (queries the persons list)
 *   POSTHOG_PROJECT_API_KEY   the project's public `phc_...` key
 *                             (sends the $set capture events)
 *   POSTHOG_PROJECT_ID        numeric project id (visible in the PostHog URL)
 *
 * Optional environment:
 *   POSTHOG_API_HOST     private API host   (default: https://us.posthog.com)
 *   POSTHOG_INGEST_HOST  capture/ingestion host
 *                        (default: https://us.i.posthog.com — matches the
 *                        app's api_host in apps/web/src/main.ts)
 *
 * Run this only after the "Early Access" feature (key `beta-early-access`)
 * exists in PostHog; verify the dry-run count against the old feature's
 * enrollment count before committing. Person property updates are processed
 * asynchronously by PostHog, so allow a few minutes before verifying.
 */

const API_HOST = process.env.POSTHOG_API_HOST ?? "https://us.posthog.com";
const INGEST_HOST =
  process.env.POSTHOG_INGEST_HOST ?? "https://us.i.posthog.com";

const PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_API_KEY = process.env.POSTHOG_PROJECT_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

const CAPTURE_BATCH_SIZE = 100;

function parseArgs(argv) {
  const args = { from: "beta-mobile-2", to: "beta-early-access", commit: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--commit") args.commit = true;
    else if (arg === "--from") args.from = argv[(i += 1)];
    else if (arg === "--to") args.to = argv[(i += 1)];
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!args.from || !args.to || args.from === args.to) {
    console.error("--from and --to must be distinct flag keys.");
    process.exit(1);
  }
  return args;
}

function requireEnv() {
  const missing = [];
  if (!PERSONAL_API_KEY) missing.push("POSTHOG_PERSONAL_API_KEY");
  if (!PROJECT_API_KEY) missing.push("POSTHOG_PROJECT_API_KEY");
  if (!PROJECT_ID) missing.push("POSTHOG_PROJECT_ID");
  if (missing.length) {
    console.error(`Missing required environment: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${options?.method ?? "GET"} ${url} -> ${response.status} ${body.slice(0, 500)}`,
    );
  }
  return response.json();
}

/**
 * Page through every person enrolled in the source feature. The persons API
 * filter matches the person property PostHog writes on enrollment.
 */
async function* enrolledPersons(sourceFlagKey) {
  const properties = encodeURIComponent(
    JSON.stringify([
      {
        key: `$feature_enrollment/${sourceFlagKey}`,
        value: ["true"],
        operator: "exact",
        type: "person",
      },
    ]),
  );
  let url = `${API_HOST}/api/projects/${PROJECT_ID}/persons/?properties=${properties}&limit=100`;

  while (url) {
    const page = await fetchJson(url, {
      headers: { Authorization: `Bearer ${PERSONAL_API_KEY}` },
    });
    for (const person of page.results ?? []) yield person;
    url = page.next;
  }
}

async function sendBatch(events) {
  if (!events.length) return;
  await fetchJson(`${INGEST_HOST}/batch/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: PROJECT_API_KEY, batch: events }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireEnv();

  console.warn(
    `early-access enrollment migration  ${args.from} -> ${args.to}  ` +
      `project=${PROJECT_ID}  ${args.commit ? "COMMIT" : "dry-run"}`,
  );

  const targetProperty = `$feature_enrollment/${args.to}`;
  const timestamp = new Date().toISOString();

  let scanned = 0;
  let alreadyEnrolled = 0;
  let noDistinctId = 0;
  let migrated = 0;
  let pending = [];

  for await (const person of enrolledPersons(args.from)) {
    scanned += 1;

    if (person.properties?.[targetProperty] === true) {
      alreadyEnrolled += 1;
      continue;
    }

    const distinctId = person.distinct_ids?.[0];
    if (!distinctId) {
      noDistinctId += 1;
      console.warn(`  skip (no distinct id): person uuid=${person.uuid}`);
      continue;
    }

    migrated += 1;
    if (!args.commit) continue;

    pending.push({
      event: "$set",
      distinct_id: distinctId,
      timestamp,
      properties: { $set: { [targetProperty]: true } },
    });
    if (pending.length >= CAPTURE_BATCH_SIZE) {
      await sendBatch(pending);
      pending = [];
    }
  }

  if (args.commit) await sendBatch(pending);

  console.warn(`scanned:            ${scanned}`);
  console.warn(`already enrolled:   ${alreadyEnrolled}`);
  console.warn(`no distinct id:     ${noDistinctId}`);
  console.warn(
    `${args.commit ? "migrated:          " : "would migrate:     "} ${migrated}`,
  );

  if (!args.commit) {
    console.warn("Dry run — no events sent. Re-run with --commit to migrate.");
  } else {
    console.warn(
      "Events sent. PostHog applies person property updates asynchronously; " +
        "verify enrollment counts in a few minutes.",
    );
  }
}

main().catch((error) => {
  console.error("Enrollment migration failed:", error);
  process.exitCode = 1;
});
