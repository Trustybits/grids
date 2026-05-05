import type { UploadOptions } from "@/types/UploadFileTypes";

const IMAGE_MAX_DEFAULT = 10 * 1024 * 1024;
const VIDEO_MAX_DEFAULT = 500 * 1024 * 1024;
const DOCUMENT_MAX_DEFAULT = 50 * 1024 * 1024;

const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

const DOCUMENT_EXT = /\.(pdf|doc|docx|txt|md)$/i;

/** Classify a file for grid upload (image, video, document). Returns null if unsupported. */
export function classifyFileForUpload(
  file: File,
): "image" | "video" | "document" | null {
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

function defaultMaxBytesForKind(kind: "image" | "video" | "document"): number {
  if (kind === "image") return IMAGE_MAX_DEFAULT;
  if (kind === "video") return VIDEO_MAX_DEFAULT;
  return DOCUMENT_MAX_DEFAULT;
}

/**
 * Same rules as StorageService.validateFile: throws with a user-facing message if invalid.
 * Used by StorageService and can be unit-tested without Firebase.
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

  const maxSize = options.maxSize ?? defaultMaxBytesForKind(kind);
  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / 1024 / 1024);
    throw new Error(`File is too large! Maximum size: ${sizeMB}MB`);
  }

  return {
    isImage: kind === "image",
    isVideo: kind === "video",
    isDocument: kind === "document",
  };
}
