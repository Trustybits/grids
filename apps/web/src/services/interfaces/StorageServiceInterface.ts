import type {
  StorageUploadMetadata,
  StorageUploadTask,
} from "@grids/contracts/dao";
import type { UploadOptions } from "@/types/UploadFileTypes";

export interface StorageServiceInterface {
  /**
   * Validates that a file is a supported image or video and within size limits.
   * Throws a user-friendly error message on failure.
   */
  validateFile(
    file: File,
    options: UploadOptions,
  ): { isImage: boolean; isVideo: boolean; isDocument: boolean };

  /** Upload a file in one shot and return the permanent download URL. */
  upload(
    userId: string,
    file: File,
    options?: UploadOptions,
    metadata?: StorageUploadMetadata,
  ): Promise<string>;

  /**
   * Upload a file to an explicit storage path (overwriting any existing
   * object) and return the permanent download URL. Used for fixed-location
   * assets like a grid's custom OG image.
   */
  uploadToPath(
    path: string,
    file: File,
    metadata?: StorageUploadMetadata,
  ): Promise<string>;

  /** Start a resumable upload and return a task handle for progress tracking. */
  uploadResumable(
    userId: string,
    file: File,
    options?: UploadOptions,
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask;

  /** Fetch an external image URL, upload a copy to storage, and return our permanent URL. */
  uploadExternalImage(
    userId: string,
    externalUrl: string,
    folder?: string,
  ): Promise<string>;

  /** Download the raw bytes of a file from its public URL. */
  getBytes(url: string): Promise<Uint8Array>;

  /** Fetch the permanent download URL for an existing object. */
  getDownloadUrl(path: string): Promise<string>;

  /** Delete the object at the given path. */
  delete(path: string): Promise<void>;

  /** Build the canonical storage path for a user-owned file. */
  buildFilePath(
    root: string,
    userId: string,
    folder: string,
    fileName: string,
  ): string;
}
