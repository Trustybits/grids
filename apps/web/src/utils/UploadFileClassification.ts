import type { UploadOptions } from "@/types/UploadFileTypes";

/**
 * Advisory large-file thresholds. These no longer reject uploads — the archive
 * flow supports arbitrarily large files (subject to quota, enforced server-side
 * and in storage.rules). They exist only so the UI can warn the user that a big
 * file may take a while to hash and upload.
 */
const IMAGE_WARN_BYTES = 25 * 1024 * 1024;
const VIDEO_WARN_BYTES = 1024 * 1024 * 1024;
const DOCUMENT_WARN_BYTES = 100 * 1024 * 1024;

const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

const DOCUMENT_EXT = /\.(pdf|doc|docx|txt|md)$/i;

export type UploadKindLabel = "image" | "video" | "document";

/** Classify a file for grid upload (image, video, document). Returns null if unsupported. */
export function classifyFileForUpload(file: File): UploadKindLabel | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const mime = file.type.toLowerCase().trim();
  if (DOCUMENT_MIME.has(mime)) return "document";
  if (DOCUMENT_EXT.test(file.name)) return "document";
  return null;
}

export function isDocumentUploadFile(file: File): boolean {
  return classifyFileForUpload(file) === "document";
}

function warnBytesForKind(kind: UploadKindLabel): number {
  if (kind === "image") return IMAGE_WARN_BYTES;
  if (kind === "video") return VIDEO_WARN_BYTES;
  return DOCUMENT_WARN_BYTES;
}

/**
 * Validate a file's type. Throws with a user-facing message on unsupported
 * types. Size is intentionally not a failure condition anymore (see
 * {@link classifyUploadSize} for the advisory warning).
 */
export function validateUploadFile(
  file: File,
  options: UploadOptions = {},
): { isImage: boolean; isVideo: boolean; isDocument: boolean } {
  const kind = classifyFileForUpload(file);
  if (!kind) {
    throw new Error(
      "Unsupported file type. Please upload an image, video, or document (PDF, Word, TXT, or MD).",
    );
  }

  if (options.fileType === "images" && kind !== "image") {
    throw new Error("Unsupported file type. Please upload an image or video.");
  }
  if (options.fileType === "videos" && kind !== "video") {
    throw new Error("Unsupported file type. Please upload an image or video.");
  }
  if (options.fileType === "documents" && kind !== "document") {
    throw new Error(
      "Unsupported file type. Please upload a document (PDF, Word, TXT, or MD).",
    );
  }

  return {
    isImage: kind === "image",
    isVideo: kind === "video",
    isDocument: kind === "document",
  };
}

export interface UploadSizeClassification {
  /** True when the file is large enough to warrant a non-blocking warning. */
  warn: boolean;
  sizeMB: number;
  thresholdMB: number;
  message?: string;
}

/**
 * Non-blocking size classification. Returns a warning (never an error) when the
 * file exceeds the advisory threshold for its kind, so the UI can inform the
 * user without preventing the upload.
 */
export function classifyUploadSize(
  file: File,
  options: UploadOptions = {},
): UploadSizeClassification {
  const kind = classifyFileForUpload(file);
  const threshold = options.maxSize ?? (kind ? warnBytesForKind(kind) : Infinity);
  const sizeMB = Math.round(file.size / 1024 / 1024);
  const thresholdMB = Number.isFinite(threshold)
    ? Math.round(threshold / 1024 / 1024)
    : 0;

  if (file.size <= threshold) {
    return { warn: false, sizeMB, thresholdMB };
  }

  return {
    warn: true,
    sizeMB,
    thresholdMB,
    message: `This file is large (${sizeMB}MB). It may take a while to prepare and upload.`,
  };
}
