import { createHash, randomInt } from "node:crypto";
import type { firestore } from "firebase-admin";

/**
 * Lost-inbox account recovery.
 *
 * A user who can no longer receive mail at their account email files a request
 * (`emailRecoveryRequests`). After staff verify their identity out of band,
 * staff issue a one-time recovery code (`emailRecoveryCodes`). Redeeming the
 * code yields a custom sign-in token, which stands in for re-authentication so
 * the user can start a normal verified email change — the new address still
 * has to be confirmed by link.
 *
 * Both collections are server-only: clients never read or write them directly.
 * These helpers are shared by the callables and the admin script, and are the
 * intended building blocks for a future staff admin portal.
 */

export const EMAIL_RECOVERY_REQUESTS_COLLECTION = "emailRecoveryRequests";
export const EMAIL_RECOVERY_CODES_COLLECTION = "emailRecoveryCodes";

export const DEFAULT_RECOVERY_CODE_TTL_HOURS = 24;
export const RECOVERY_REQUEST_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const MAX_CONTACT_LENGTH = 200;
export const MAX_DETAILS_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;

// Crockford base32: no I, L, O, U, so codes read aloud / retyped unambiguously.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 12; // 12 × 5 bits = 60 bits of entropy
const CODE_GROUP = 4;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailRecoveryRequestStatus = "pending" | "code-issued" | "rejected";

export interface EmailRecoveryRequestDoc {
  uid: string | null;
  lostEmail: string;
  requestedEmail: string;
  contact: string;
  details: string;
  signedIn: boolean;
  status: EmailRecoveryRequestStatus;
  dedupeKey: string;
  createdAt: unknown;
}

export interface EmailRecoveryCodeDoc {
  uid: string;
  requestId: string | null;
  issuedAt: unknown;
  expiresAt: firestore.Timestamp;
  usedAt: unknown | null;
}

// ── Codes ──────────────────────────────────────────────────────────────────

/** Generate a random code in canonical (undashed) form. */
export function generateRecoveryCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Format a canonical code for display, e.g. `ABCD-EFGH-JKMN`. */
export function formatRecoveryCode(code: string): string {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += CODE_GROUP) {
    groups.push(code.slice(i, i + CODE_GROUP));
  }
  return groups.join("-");
}

/**
 * Normalize user input to the canonical code, or null if it can't be one.
 * Accepts lowercase, spaces/dashes, and the usual Crockford look-alikes.
 */
export function normalizeRecoveryCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) {
    if (!CODE_ALPHABET.includes(char)) return null;
  }
  return code;
}

/** Codes are stored only as a hash, used as the document id. */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// ── Input normalization ────────────────────────────────────────────────────

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH) return null;
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function recoveryDedupeKey(
  uid: string | null,
  lostEmail: string,
): string {
  return uid ? `uid:${uid}` : `email:${lostEmail}`;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/**
 * True when a pending request with this dedupe key was filed recently, so a
 * repeat submission shouldn't create another request (or Discord ping).
 */
export async function hasRecentPendingRequest(
  db: firestore.Firestore,
  dedupeKey: string,
  now: number = Date.now(),
): Promise<boolean> {
  // Single-field equality query: served by the automatic index.
  const snapshot = await db
    .collection(EMAIL_RECOVERY_REQUESTS_COLLECTION)
    .where("dedupeKey", "==", dedupeKey)
    .get();
  return snapshot.docs.some((doc) => {
    const data = doc.data() as Partial<EmailRecoveryRequestDoc>;
    if (data.status !== "pending") return false;
    const createdAt = toMillis(data.createdAt);
    // A just-written doc may still have a pending server timestamp.
    return createdAt === null || now - createdAt < RECOVERY_REQUEST_DEDUPE_WINDOW_MS;
  });
}

// ── Issue / redeem ─────────────────────────────────────────────────────────

export interface IssueRecoveryCodeOptions {
  uid: string;
  requestId?: string | null;
  ttlHours?: number;
  now?: Date;
}

export interface IssuedRecoveryCode {
  /** Display form of the plaintext code. Shown once; never stored. */
  code: string;
  expiresAt: Date;
}

/**
 * Create a one-time recovery code for `uid` and, when tied to a request, mark
 * that request as `code-issued`. Returns the plaintext code exactly once.
 */
export async function issueRecoveryCode(
  db: firestore.Firestore,
  timestampFromDate: (date: Date) => firestore.Timestamp,
  serverTimestamp: () => unknown,
  { uid, requestId = null, ttlHours = DEFAULT_RECOVERY_CODE_TTL_HOURS, now = new Date() }: IssueRecoveryCodeOptions,
): Promise<IssuedRecoveryCode> {
  const code = generateRecoveryCode();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const codeDoc: EmailRecoveryCodeDoc = {
    uid,
    requestId,
    issuedAt: serverTimestamp(),
    expiresAt: timestampFromDate(expiresAt),
    usedAt: null,
  };

  const batch = db.batch();
  batch.create(
    db.collection(EMAIL_RECOVERY_CODES_COLLECTION).doc(hashRecoveryCode(code)),
    codeDoc,
  );
  if (requestId) {
    batch.update(
      db.collection(EMAIL_RECOVERY_REQUESTS_COLLECTION).doc(requestId),
      { status: "code-issued", uid },
    );
  }
  await batch.commit();

  return { code: formatRecoveryCode(code), expiresAt };
}

export type RedeemFailureReason =
  | "not-found"
  | "used"
  | "expired"
  | "wrong-account";

export class RecoveryCodeRejectedError extends Error {
  public constructor(public readonly reason: RedeemFailureReason) {
    super(`Recovery code rejected: ${reason}`);
    this.name = "RecoveryCodeRejectedError";
  }
}

/**
 * Atomically validate and consume a recovery code. Resolves with the uid the
 * code was issued to; rejects with `RecoveryCodeRejectedError` otherwise.
 * `callerUid` (when signed in) must match the code's account.
 */
export async function consumeRecoveryCode(
  db: firestore.Firestore,
  serverTimestamp: () => unknown,
  code: string,
  callerUid: string | null,
  now: number = Date.now(),
): Promise<string> {
  const ref = db
    .collection(EMAIL_RECOVERY_CODES_COLLECTION)
    .doc(hashRecoveryCode(code));

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new RecoveryCodeRejectedError("not-found");

    const data = snapshot.data() as Partial<EmailRecoveryCodeDoc>;
    if (data.usedAt) throw new RecoveryCodeRejectedError("used");

    const expiresAt = toMillis(data.expiresAt);
    if (expiresAt === null || expiresAt <= now) {
      throw new RecoveryCodeRejectedError("expired");
    }
    if (!data.uid || (callerUid && callerUid !== data.uid)) {
      throw new RecoveryCodeRejectedError("wrong-account");
    }

    transaction.update(ref, {
      usedAt: serverTimestamp(),
      redeemedWhileSignedIn: Boolean(callerUid),
    });
    return data.uid;
  });
}

/** Undo `consumeRecoveryCode` when the follow-up token mint fails. */
export async function releaseRecoveryCode(
  db: firestore.Firestore,
  code: string,
): Promise<void> {
  await db
    .collection(EMAIL_RECOVERY_CODES_COLLECTION)
    .doc(hashRecoveryCode(code))
    .update({ usedAt: null });
}

/** Mark every unused code for `uid` as used, so none can be redeemed. */
export async function revokeRecoveryCodes(
  db: firestore.Firestore,
  serverTimestamp: () => unknown,
  uid: string,
): Promise<number> {
  const snapshot = await db
    .collection(EMAIL_RECOVERY_CODES_COLLECTION)
    .where("uid", "==", uid)
    .get();
  const unused = snapshot.docs.filter((doc) => !doc.data().usedAt);
  if (!unused.length) return 0;

  const batch = db.batch();
  for (const doc of unused) {
    batch.update(doc.ref, { usedAt: serverTimestamp(), revoked: true });
  }
  await batch.commit();
  return unused.length;
}
