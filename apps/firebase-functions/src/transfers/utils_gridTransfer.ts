import { HttpsError } from "firebase-functions/v1/https";
import type {
  GridTransfer,
  GridTransferStatus,
} from "@grids/contracts/types";
import admin from "../admin.js";
import { isValidSlugFormat } from "../accounts/utils_slugValidation.js";
import { STORAGE_QUOTA_BYTES } from "../storage/utils_uploadPaths.js";

export const GRID_TRANSFER_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

export type GridTransferDoc = Omit<
  GridTransfer,
  "createdAt" | "updatedAt" | "resolvedAt" | "expiresAt"
> & {
  createdAt?: unknown;
  updatedAt?: unknown;
  resolvedAt?: unknown;
  expiresAt: unknown;
};

export function gridTransfersCollection() {
  return admin.firestore().collection("gridTransfers");
}

export function fieldValue() {
  return admin.firestore.FieldValue;
}

export function timestampFromMillis(millis: number) {
  const Timestamp = admin.firestore.Timestamp;
  if (Timestamp?.fromMillis) return Timestamp.fromMillis(millis);
  return new Date(millis);
}

export function transferExpiresAt(now = Date.now()) {
  return timestampFromMillis(now + GRID_TRANSFER_EXPIRY_MS);
}

export function timestampToMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

export function isExpired(expiresAt: unknown, now = Date.now()): boolean {
  const expiresAtMs = timestampToMillis(expiresAt);
  return expiresAtMs !== null && expiresAtMs <= now;
}

export function normalizeTransferId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", "transferId is required.");
  }
  return value.trim();
}

export function normalizeGridId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", "gridId is required.");
  }
  return value.trim();
}

export function normalizeRemoveOrphanedFiles(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "removeOrphanedFiles is required.",
    );
  }
  return value;
}

export function normalizeRecipientRef(value: unknown):
  | { email: string; slug?: never }
  | { slug: string; email?: never } {
  const recipient = (value ?? {}) as Record<string, unknown>;
  const rawEmail =
    typeof recipient.email === "string" ? recipient.email.trim() : "";
  const rawSlug =
    typeof recipient.slug === "string" ? recipient.slug.trim().toLowerCase() : "";

  if (rawEmail && rawSlug) {
    throw new HttpsError(
      "invalid-argument",
      "Provide either an email or a slug, not both.",
    );
  }
  if (rawEmail) return { email: rawEmail.toLowerCase() };
  if (rawSlug) {
    if (!isValidSlugFormat(rawSlug)) {
      throw new HttpsError("invalid-argument", "Invalid recipient slug.");
    }
    return { slug: rawSlug };
  }
  throw new HttpsError("invalid-argument", "Recipient email or slug is required.");
}

export async function resolveRecipientUid(
  recipient: ReturnType<typeof normalizeRecipientRef>,
): Promise<string> {
  if ("slug" in recipient) {
    const slug = recipient.slug;
    if (!slug) {
      throw new HttpsError("invalid-argument", "Recipient slug is required.");
    }
    const slugSnap = await admin
      .firestore()
      .collection("slugs")
      .doc(slug)
      .get();
    const uid = slugSnap.data()?.userId;
    if (!slugSnap.exists || typeof uid !== "string" || !uid) {
      throw new HttpsError(
        "not-found",
        "No Grids account was found for that email/slug.",
      );
    }
    return uid;
  }

  try {
    return (await admin.auth().getUserByEmail(recipient.email)).uid;
  } catch {
    throw new HttpsError(
      "not-found",
      "No Grids account was found for that email/slug.",
    );
  }
}

export async function readTransfer(transferId: string): Promise<{
  ref: FirebaseFirestore.DocumentReference;
  transfer: GridTransferDoc;
}> {
  const ref = gridTransfersCollection().doc(transferId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Transfer not found.");
  }
  return {
    ref,
    transfer: { ...(snap.data() as Omit<GridTransferDoc, "id">), id: transferId },
  };
}

export async function markTransferResolved(
  ref: FirebaseFirestore.DocumentReference,
  status: GridTransferStatus,
  extra: Record<string, unknown> = {},
) {
  await ref.update({
    status,
    updatedAt: fieldValue().serverTimestamp(),
    resolvedAt: fieldValue().serverTimestamp(),
    ...extra,
  });
}

export async function getRecipientQuotaRemaining(uid: string): Promise<{
  remaining: number;
  isDevAccount: boolean;
}> {
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  const userData = userSnap.data() ?? {};
  if (userData.isDevAccount === true) {
    return { remaining: Number.MAX_SAFE_INTEGER, isDevAccount: true };
  }
  const storageUsed =
    typeof userData.storageUsed === "number" ? userData.storageUsed : 0;
  return {
    remaining: Math.max(0, STORAGE_QUOTA_BYTES - storageUsed),
    isDevAccount: false,
  };
}
