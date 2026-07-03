import type { StorageUploadProgress } from "@grids/contracts/dao";

export type FileType = "images" | "videos" | "documents";

export interface UploadOptions {
  /** Override the file type detection */
  fileType?: FileType;
  /** Custom max size in bytes (overrides default) */
  maxSize?: number;
}

/**
 * Result of routing a user-owned file through the archive upload flow
 * (hash → authorize → canonical upload → server finalize). Carries both the
 * display URL and the stored hash so persistence can record the authoritative
 * `users/{uid}/uploads/{hash}` archive key alongside the rendered URL.
 */
export interface ArchiveUploadResult {
  url: string;
  hash: string;
  path: string;
  type: FileType;
  size: number;
  /** False when server-side dedupe short-circuited the byte upload. */
  uploadRequired: boolean;
}

/**
 * Handle for a resumable archive upload. Mirrors the shape of
 * `StorageUploadTask` (`onProgress`/`done`/`cancel`) so it slots into the
 * optimistic upload wiring, but `done()` resolves to the structured
 * {@link ArchiveUploadResult} and `onHashProgress` surfaces the preparing/
 * hashing phase that precedes byte transfer.
 */
export interface ArchiveUploadTask {
  /** Subscribe to byte-transfer progress. Returns an unsubscribe function. */
  onProgress(
    callback: (progress: StorageUploadProgress) => void,
  ): () => void;
  /** Subscribe to hashing progress (0–1). Returns an unsubscribe function. */
  onHashProgress(callback: (fraction: number) => void): () => void;
  /** Resolves once the upload is authorized, transferred, and finalized. */
  done(): Promise<ArchiveUploadResult>;
  /** Cancel hashing and/or the in-flight byte upload. */
  cancel(): void;
}
