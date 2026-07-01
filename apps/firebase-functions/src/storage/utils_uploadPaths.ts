import { HttpsError } from "firebase-functions/v1/https";

export type UploadKind = "images" | "videos" | "documents";

export interface UploadMetadata {
  kind: UploadKind;
  hash: string;
  ext: string;
  size: number;
  contentType: string;
}

export interface CanonicalUploadPath {
  uid: string;
  kind: UploadKind;
  hash: string;
  ext: string;
  path: string;
}

export const STORAGE_QUOTA_BYTES = 5_368_709_120;

const UPLOAD_KINDS = new Set<UploadKind>([
  "images",
  "videos",
  "documents",
]);

const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const EXT_RE = /^[a-z0-9][a-z0-9-]{0,15}$/;

export function normalizeUploadKind(value: unknown): UploadKind {
  if (typeof value !== "string" || !UPLOAD_KINDS.has(value as UploadKind)) {
    throw new HttpsError(
      "invalid-argument",
      "Upload type must be images, videos, or documents.",
    );
  }
  return value as UploadKind;
}

export function normalizeHash(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "A SHA-256 hash is required.");
  }
  const hash = value.trim().toLowerCase();
  if (!SHA256_HEX_RE.test(hash)) {
    throw new HttpsError(
      "invalid-argument",
      "Hash must be a lowercase SHA-256 hex digest.",
    );
  }
  return hash;
}

export function normalizeExtension(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "A file extension is required.");
  }
  const ext = value.trim().toLowerCase().replace(/^\./, "");
  if (!EXT_RE.test(ext)) {
    throw new HttpsError("invalid-argument", "Invalid file extension.");
  }
  return ext;
}

export function normalizeUploadSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpsError("invalid-argument", "A valid file size is required.");
  }
  return value;
}

export function normalizeContentType(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", "A content type is required.");
  }
  return value.trim().toLowerCase();
}

export function normalizeUploadMetadata(data: unknown): UploadMetadata {
  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    kind: normalizeUploadKind(payload.kind ?? payload.type),
    hash: normalizeHash(payload.hash),
    ext: normalizeExtension(payload.ext),
    size: normalizeUploadSize(payload.size),
    contentType: normalizeContentType(payload.contentType),
  };
}

export function buildCanonicalUploadPath(
  uid: string,
  metadata: UploadMetadata,
): string {
  return `users/${uid}/${metadata.kind}/${metadata.hash}.${metadata.ext}`;
}

export function parseCanonicalUploadPath(
  path: string | undefined,
): CanonicalUploadPath | null {
  if (!path) return null;
  const parts = path.split("/");
  if (parts.length !== 4 || parts[0] !== "users") return null;
  const uid = parts[1];
  const kind = parts[2] as UploadKind;
  const filename = parts[3];
  if (!uid || !UPLOAD_KINDS.has(kind) || !filename) return null;

  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return null;
  const hash = filename.slice(0, dot).toLowerCase();
  const ext = filename.slice(dot + 1).toLowerCase();
  if (!SHA256_HEX_RE.test(hash) || !EXT_RE.test(ext)) return null;

  return {
    uid,
    kind,
    hash,
    ext,
    path,
  };
}
