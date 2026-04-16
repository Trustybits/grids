import type {
  StorageUploadMetadata,
  StorageUploadTask,
} from "@/dao/interfaces/StorageDao";

export interface IStorageService {
  /**
   * Upload a file in one shot and return the permanent download URL.
   * Automatically sets the `published` custom-metadata flag required by storage security rules.
   */
  upload(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): Promise<string>;

  /**
   * Start a resumable upload and return a task handle for progress tracking.
   * Automatically sets the `published` custom-metadata flag required by storage security rules.
   */
  uploadResumable(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask;

  /** Fetch the permanent download URL for an existing object. */
  getDownloadUrl(path: string): Promise<string>;

  /** Delete the object at the given path. */
  delete(path: string): Promise<void>;

  /** Build the canonical storage path for a user-owned file (e.g. avatars, tile media). */
  buildUserPath(userId: string, folder: string, fileName: string): string;
}
