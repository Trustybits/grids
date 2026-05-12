/**
 * Admin script: grant or revoke a badge for one or more users.
 *
 * Use cases:
 *   - Granting Early Adopter to specific users by handpicking them
 *   - Granting curated badges (community contributor, beta tester, etc.)
 *   - Backfilling a badge after launching it
 *   - Revoking a badge if it was granted in error
 *
 * Usage (from the functions/ directory):
 *
 *   npm run build
 *
 *   # Grant a badge to specific UIDs
 *   node lib/scripts/grantBadge.js grant earlyAdopter <uid1> [uid2 ...]
 *
 *   # Grant a badge to all users whose `users/{uid}.createdAt` is before a date
 *   node lib/scripts/grantBadge.js backfill earlyAdopter --before 2026-06-01
 *
 *   # Revoke a badge
 *   node lib/scripts/grantBadge.js revoke earlyAdopter <uid>
 *
 *   # Dry-run any of the above (no writes)
 *   node lib/scripts/grantBadge.js grant earlyAdopter <uid> --dry-run
 *
 * Auth:
 *   Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON
 *   key. Download from Firebase Console → Project Settings → Service Accounts.
 *
 * Adding a new badge:
 *   This script accepts any string as a badge ID — there's no per-badge
 *   validation here on purpose, so you can grant new badges before the
 *   client-side type union is updated. Just make sure the ID matches the
 *   key you intend to add to `BadgeId` in `src/types/Badge.ts`.
 */

/* eslint-disable max-len, no-console */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type Action = "grant" | "revoke" | "backfill";

interface ParsedArgs {
  action: Action;
  badgeId: string;
  uids: string[];
  before?: Date;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [actionRaw, badgeId, ...rest] = argv;
  if (!actionRaw || !["grant", "revoke", "backfill"].includes(actionRaw)) {
    throw new Error(`Action must be one of: grant | revoke | backfill (got: ${actionRaw ?? "<missing>"})`);
  }
  if (!badgeId) {
    throw new Error("Badge ID is required (e.g. earlyAdopter, supporter)");
  }

  const dryRun = rest.includes("--dry-run");
  const beforeIdx = rest.indexOf("--before");
  let before: Date | undefined;
  if (beforeIdx !== -1) {
    const beforeStr = rest[beforeIdx + 1];
    if (!beforeStr) throw new Error("--before requires a date (YYYY-MM-DD)");
    before = new Date(beforeStr);
    if (Number.isNaN(before.getTime())) {
      throw new Error(`Invalid --before date: ${beforeStr}`);
    }
  }

  const uids = rest.filter(
    (a, i) =>
      !a.startsWith("--") &&
      rest[i - 1] !== "--before",
  );

  return { action: actionRaw as Action, badgeId, uids, before, dryRun };
}

async function grantOne(uid: string, badgeId: string, dryRun: boolean): Promise<"granted" | "skipped"> {
  const ref = db.collection("userBadges").doc(uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() ?? {} : {};
  if (existing[badgeId]) {
    console.log(`  SKIP   ${uid} — already has ${badgeId}`);
    return "skipped";
  }

  if (dryRun) {
    console.log(`  WOULD  ${uid} ← ${badgeId}`);
    return "granted";
  }

  await ref.set(
    {
      [badgeId]: { earnedAt: admin.firestore.FieldValue.serverTimestamp() },
    },
    { merge: true },
  );
  console.log(`  GRANT  ${uid} ← ${badgeId}`);
  return "granted";
}

async function revokeOne(uid: string, badgeId: string, dryRun: boolean): Promise<"revoked" | "skipped"> {
  const ref = db.collection("userBadges").doc(uid);
  const snap = await ref.get();
  if (!snap.exists || !(snap.data() ?? {})[badgeId]) {
    console.log(`  SKIP   ${uid} — does not have ${badgeId}`);
    return "skipped";
  }
  if (dryRun) {
    console.log(`  WOULD  ${uid} ✗ ${badgeId}`);
    return "revoked";
  }
  await ref.update({ [badgeId]: admin.firestore.FieldValue.delete() });
  console.log(`  REVOKE ${uid} ✗ ${badgeId}`);
  return "revoked";
}

async function findUsersCreatedBefore(date: Date): Promise<string[]> {
  // `users/{uid}.lastLogin` always exists; `createdAt` is not currently
  // written by the app. Use the auth user's metadata.creationTime instead.
  console.log(`Listing auth users created before ${date.toISOString()}...`);
  const matches: string[] = [];
  let pageToken: string | undefined;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const user of result.users) {
      const createdAt = new Date(user.metadata.creationTime);
      if (createdAt < date) {
        matches.push(user.uid);
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);
  console.log(`Found ${matches.length} matching user(s).`);
  return matches;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  console.log(
    `Action: ${args.action}  Badge: ${args.badgeId}  ${args.dryRun ? "(dry-run)" : ""}`,
  );

  let uids = args.uids;
  if (args.action === "backfill") {
    if (!args.before) {
      throw new Error("backfill requires --before YYYY-MM-DD");
    }
    uids = await findUsersCreatedBefore(args.before);
  }

  if (!uids.length) {
    console.log("No users to process.");
    return;
  }

  let granted = 0;
  let revoked = 0;
  let skipped = 0;

  for (const uid of uids) {
    if (args.action === "revoke") {
      const result = await revokeOne(uid, args.badgeId, args.dryRun);
      if (result === "revoked") revoked++;
      else skipped++;
    } else {
      const result = await grantOne(uid, args.badgeId, args.dryRun);
      if (result === "granted") granted++;
      else skipped++;
    }
  }

  console.log(
    `\nDone. Granted: ${granted}, Revoked: ${revoked}, Skipped: ${skipped}` +
      (args.dryRun ? " (dry-run — no writes performed)" : ""),
  );
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
