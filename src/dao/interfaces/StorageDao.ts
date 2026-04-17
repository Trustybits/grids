/** Optional metadata attached to an uploaded object (e.g. contentType, custom flags). */
export interface StorageUploadMetadata {
  contentType?: string;
  customMetadata?: Record<string, string>;
}

/** Progress snapshot emitted by a resumable upload. */
export interface StorageUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
}

/** Handle returned from a resumable upload so callers can await completion and observe progress. */
export interface StorageUploadTask {
  /** Subscribe to progress events. Returns an unsubscribe function. */
  onProgress(callback: (progress: StorageUploadProgress) => void): () => void;

  /** Resolves to the permanent download URL once the upload completes. */
  done(): Promise<string>;

  /** Cancel the in-flight upload. */
  cancel(): void;
}

export interface StorageDao {
  /**
   * Upload a Blob or File to the given path in one shot and resolve to its download URL.
   * Use for small files where progress tracking is not needed.
   */
  upload(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): Promise<string>;

  /**
   * Start a resumable upload for the given path and return a task handle.
   * Use when the UI needs to display progress or when the file is large enough to benefit from resumability.
   */
  uploadResumable(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask;

  /**
   * Fetch the public download URL for an object that already exists at the given path.
   * Throws if the object is missing or unreadable.
   */
  getDownloadUrl(path: string): Promise<string>;

  /**
   * Delete the object at the given path. No-op semantics are implementation-defined —
   * consult the concrete DAO for whether missing objects throw or silently succeed.
   */
  delete(path: string): Promise<void>;

  /**
   * Build the canonical storage path for a user-owned object.
   * Centralizing path construction keeps security-rule expectations consistent across callers.
   */
  buildFilePath(
    root: string,
    userId: string,
    folder: string,
    fileName: string,
  ): string;
}
