import type { StorageUploadMetadata } from "@grids/contracts/dao";
import type {
  PrepareGridDuplicateStorageRequest,
  PrepareGridDuplicateStorageResponse,
  UploadArchiveDocument,
} from "@grids/contracts/types";
import type {
  ArchiveUploadResult,
  ArchiveUploadTask,
  UploadOptions,
} from "@/types/UploadFileTypes";

export interface StorageServiceInterface {
  /**
   * Validates that a file is a supported image, video, or document. Throws a
   * user-friendly error on unsupported types. Size limits are advisory only
   * (see {@link classifyUploadSize}); they no longer reject the upload.
   */
  validateFile(
    file: File,
    options: UploadOptions,
  ): { isImage: boolean; isVideo: boolean; isDocument: boolean };

  /**
   * Upload a user-owned file through the archive flow: hash the bytes, request
   * server authorization, upload to the canonical `users/{uid}/{type}/{hash}`
   * path when required, and wait for server finalize. Resolves to the structured
   * {@link ArchiveUploadResult} (url + hash + path + type + size).
   */
  uploadArchiveFile(
    userId: string,
    file: File,
    options?: UploadOptions,
  ): Promise<ArchiveUploadResult>;

  /**
   * Resumable variant of {@link uploadArchiveFile} that exposes hashing and
   * byte-transfer progress plus cancellation for optimistic tile uploads.
   */
  uploadArchiveResumable(
    userId: string,
    file: File,
    options?: UploadOptions,
  ): ArchiveUploadTask;

  /**
   * Upload a file to an explicit storage path (overwriting any existing
   * object) and return the permanent download URL. Reserved for fixed-location
   * assets that are intentionally outside the archive, e.g. a grid's custom OG
   * image. Not for user archive uploads.
   */
  uploadToPath(
    path: string,
    file: File,
    metadata?: StorageUploadMetadata,
  ): Promise<string>;

  /**
   * Fetch an external image URL, copy it into the caller's archive through the
   * archive flow, and return the structured result (url + hash).
   */
  uploadExternalImageToArchive(
    userId: string,
    externalUrl: string,
  ): Promise<ArchiveUploadResult>;

  /** Download the raw bytes of a file from its public URL. */
  getBytes(url: string): Promise<Uint8Array>;

  /** Fetch the permanent download URL for an existing object. */
  getDownloadUrl(path: string): Promise<string>;

  /**
   * Permanently delete a user-owned archive upload via the server callable.
   * `force` is required to delete a file that is still referenced (refCount > 0).
   * Direct bucket deletion is intentionally not exposed to client flows.
   */
  deleteArchiveUpload(hash: string, force?: boolean): Promise<void>;

  /**
   * List every archive document under `users/{uid}/uploads` for the File Archive
   * UI. Read-only Firestore access; archive docs are written only by the server.
   */
  listArchiveUploads(userId: string): Promise<UploadArchiveDocument[]>;

  /**
   * Toggle a file's `shareable` flag through the server callable. Archive docs
   * are server-write-only, so this must not write Firestore directly. Resolves
   * to the persisted flag value.
   */
  setUploadShareable(hash: string, shareable: boolean): Promise<boolean>;

  /**
   * Rename a file's archive `displayName` through the server callable. Changes
   * only the display label; the object path, hash, and grid references are
   * untouched. Resolves to the persisted display name.
   */
  renameUpload(hash: string, displayName: string): Promise<string>;

  /**
   * Estimate (and, when `confirmed`, execute) the storage side of a full grid
   * duplication: which referenced files are copiable, the additional quota
   * required, and the URL/hash rewrite + tile-replacement maps.
   */
  prepareGridDuplicateStorage(
    request: PrepareGridDuplicateStorageRequest,
  ): Promise<PrepareGridDuplicateStorageResponse>;
}
