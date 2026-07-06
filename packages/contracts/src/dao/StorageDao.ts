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
   * Download the raw bytes of a file given its public download URL.
   * For Firebase Storage URLs the SDK is used to avoid CORS issues;
   * other URLs fall back to a plain fetch.
   */
  getBytes(url: string): Promise<Uint8Array>;
}
