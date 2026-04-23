import type {
  StorageUploadMetadata,
  StorageUploadTask,
} from "@/dao/interfaces/StorageDao";
import type { UploadOptions } from "@/types/UploadFileTypes";

export interface IStorageService {
  /**
   * Validates that a file is a supported image or video and within size limits.
   * Throws a user-friendly error message on failure.
   */
  validateFile(
    file: File,
    options: UploadOptions,
  ): { isImage: boolean; isVideo: boolean };

  /** Upload a file in one shot and return the permanent download URL. */
  upload(userId: string, file: File, options?: UploadOptions, metadata?: StorageUploadMetadata): Promise<string>;

  /** Start a resumable upload and return a task handle for progress tracking. */
  uploadResumable(userId: string, file: File, options?: UploadOptions, metadata?: StorageUploadMetadata): StorageUploadTask;

  /** Fetch an external image URL, upload a copy to storage, and return our permanent URL. */
  uploadExternalImage(userId: string, externalUrl: string, folder?: string): Promise<string>;

  /** Fetch the permanent download URL for an existing object. */
  getDownloadUrl(path: string): Promise<string>;

  /** Delete the object at the given path. */
  delete(path: string): Promise<void>;

  /** Build the canonical storage path for a user-owned file. */
  buildFilePath(root: string, userId: string, folder: string, fileName: string): string;
}
