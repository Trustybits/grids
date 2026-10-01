/**
 * Admin script: lost-inbox account recovery codes.
 *
 * When a user can no longer receive mail at their account email, they file a
 * request from the app (Account → Email → "Lost access?", or "Can't access your
 * email?" on the login page). It lands in `emailRecoveryRequests` and pings
 * Discord. Before issuing a code, VERIFY IDENTITY OUT OF BAND — a code is a
 * one-time sign-in to the account. Good signals: the Discord account they've
 * used with us before, their handle/grid names/content, when they signed up.
 *
 * The code replaces re-authentication only: the user still has to confirm the
 * new address by clicking a link sent to it, and the old address is notified.
 * Codes are single-use, expire (24h default), and are stored only as a hash.
 *
 * Usage (from the apps/firebase-functions/ directory):
 *
 *   # List pending requests
 *   npm run recovery:issue -- requests
 *
 *   # Issue a code for a user (by uid or account email), optionally tied to a request
 *   npm run recovery:issue -- issue <uid|email> [--request <requestId>] [--hours 24]
 *
 *   # Reject a request (no code issued)
 *   npm run recovery:issue -- reject <requestId>
 *
 *   # Invalidate every unused code for a user
 *   npm run recovery:issue -- revoke <uid|email>
 *
 *   # Any of the above without writing
 *   ... --dry-run
 *
 * Auth:
 *   Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON
 *   key. Download from Firebase Console → Project Settings → Service Accounts.
 *
 * Emulators:
 *   GCLOUD_PROJECT=demo-grids-local FIRESTORE_EMULATOR_HOST=127.0.0.1:3076 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9076 npm run recovery:issue -- requests
 */

import admin from "firebase-admin";
import {
  DEFAULT_RECOVERY_CODE_TTL_HOURS,
  EMAIL_RECOVERY_REQUESTS_COLLECTION,
  issueRecoveryCode,
  revokeRecoveryCodes,
} from "../accounts/utils_emailRecovery.js";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

type Action = "requests" | "issue" | "reject" | "revoke";
const ACTIONS: Action[] = ["requests", "issue", "reject", "revoke"];

interface ParsedArgs {
  action: Action;
  target?: string;
  requestId?: string;
  hours: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [actionRaw, ...rest] = argv;
  if (!actionRaw || !ACTIONS.includes(actionRaw as Action)) {
    throw new Error(
      `Action must be one of: ${ACTIONS.join(" | ")} (got: ${actionRaw ?? "<missing>"})`,
    );
  }

  const flagValue = (flag: string): string | undefined => {
    const index = rest.indexOf(flag);
    if (index === -1) return undefined;
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };

  const hoursRaw = flagValue("--hours");
  const hours = hoursRaw ? Number(hoursRaw) : DEFAULT_RECOVERY_CODE_TTL_HOURS;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 7) {
    throw new Error(`--hours must be between 0 and 168 (got: ${hoursRaw})`);
  }

  const positional = rest.filter(
    (arg, i) =>
      !arg.startsWith("--") &&
      rest[i - 1] !== "--request" &&
      rest[i - 1] !== "--hours",
  );

  return {
    action: actionRaw as Action,
    target: positional[0],
    requestId: flagValue("--request"),
    hours,
    dryRun: rest.includes("--dry-run"),
  };
}

async function resolveUser(target: string): Promise<admin.auth.UserRecord> {
  return target.includes("@")
    ? admin.auth().getUserByEmail(target)
    : admin.auth().getUser(target);
}

function formatDate(value: unknown): string {
  const date =
    value && typeof (value as { toDate?: unknown }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : null;
  return date ? date.toISOString() : "—";
}

async function listRequests(): Promise<void> {
  const snapshot = await db
    .collection(EMAIL_RECOVERY_REQUESTS_COLLECTION)
    .where("status", "==", "pending")
    .get();
  if (snapshot.empty) {
    console.warn("No pending requests.");
    return;
  }
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.warn(
      [
        `\n${doc.id}  (${formatDate(data.createdAt)})`,
        `  uid:        ${data.uid ?? "⚠️ no account found"}`,
        `  lost email: ${data.lostEmail}`,
        `  new email:  ${data.requestedEmail}`,
        `  contact:    ${data.contact}`,
        `  details:    ${data.details || "—"}`,
      ].join("\n"),
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const suffix = args.dryRun ? " (dry-run — no writes)" : "";

  if (args.action === "requests") {
    await listRequests();
    return;
  }

  if (args.action === "reject") {
    if (!args.target) throw new Error("reject requires a request id");
    if (!args.dryRun) {
      await db
        .collection(EMAIL_RECOVERY_REQUESTS_COLLECTION)
        .doc(args.target)
        .update({ status: "rejected" });
    }
    console.warn(`Rejected request ${args.target}${suffix}`);
    return;
  }

  if (!args.target) throw new Error(`${args.action} requires a uid or email`);
  const user = await resolveUser(args.target);
  console.warn(`Account: ${user.uid} <${user.email ?? "no email"}>`);

  if (args.action === "revoke") {
    if (args.dryRun) {
      console.warn(`Would revoke unused codes${suffix}`);
      return;
    }
    const count = await revokeRecoveryCodes(db, serverTimestamp, user.uid);
    console.warn(`Revoked ${count} unused code(s).`);
    return;
  }

  if (args.dryRun) {
    console.warn(
      `Would issue a ${args.hours}h code${args.requestId ? ` for request ${args.requestId}` : ""}${suffix}`,
    );
    return;
  }

  const issued = await issueRecoveryCode(
    db,
    (date) => admin.firestore.Timestamp.fromDate(date),
    serverTimestamp,
    { uid: user.uid, requestId: args.requestId ?? null, ttlHours: args.hours },
  );

  console.warn(
    [
      "",
      `  Recovery code: ${issued.code}`,
      `  Expires:       ${issued.expiresAt.toISOString()}`,
      "",
      "Send it to the user privately. They enter it under",
      "\"Lost access to your email?\" → \"I have a code\". It works once.",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
