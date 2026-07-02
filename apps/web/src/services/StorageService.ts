import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type {
  CloudFunctionsDao,
  StorageDao,
  StorageUploadMetadata,
  StorageUploadProgress,
  StorageUploadTask,
  UploadArchiveDao,
} from "@grids/contracts/dao";
import type {
  AuthorizeStorageUploadRequest,
  AuthorizeStorageUploadResponse,
  DeleteStorageUploadRequest,
  GetStorageUploadDownloadUrlRequest,
  GetStorageUploadDownloadUrlResponse,
  PrepareGridDuplicateStorageRequest,
  PrepareGridDuplicateStorageResponse,
  SetStorageUploadDisplayNameRequest,
  SetStorageUploadDisplayNameResponse,
  SetStorageUploadShareableRequest,
  SetStorageUploadShareableResponse,
  UploadArchiveDocument,
  UploadKind,
} from "@grids/contracts/types";
import type { StorageServiceInterface } from "./interfaces/StorageServiceInterface";
import type {
  ArchiveUploadResult,
  ArchiveUploadTask,
  FileType,
  UploadOptions,
} from "@/types/UploadFileTypes";
import { validateUploadFile } from "@/utils/UploadFileClassification";
import { hashFile, UploadCancelledError } from "@/utils/FileHashing";

const PUBLISHED_METADATA: StorageUploadMetadata = {
  customMetadata: { published: "true" },
};

/** How long to wait for the server finalize trigger before giving up. */
const FINALIZE_TIMEOUT_MS = 60_000;

const EXT_RE = /^[a-z0-9][a-z0-9-]{0,15}$/;

function mergeMetadata(custom?: StorageUploadMetadata): StorageUploadMetadata {
  if (!custom) return PUBLISHED_METADATA;
  return {
    ...custom,
    customMetadata: {
      ...PUBLISHED_METADATA.customMetadata,
      ...custom.customMetadata,
    },
  };
}

/** Derive a rules-safe file extension from the filename, falling back to MIME. */
function deriveExtension(fileName: string, contentType: string): string {
  const dot = fileName.lastIndexOf(".");
  let ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  if (!EXT_RE.test(ext)) {
    const sub = contentType.split("/")[1]?.split(";")[0]?.trim() ?? "";
    ext = sub.replace(/[^a-z0-9-]/g, "").slice(0, 16);
  }
  return EXT_RE.test(ext) ? ext : "bin";
}

function finalizeFailureMessage(reason?: string): string {
  if (reason === "hash-mismatch") {
    return "Upload verification failed: the file changed during upload. Please try again.";
  }
  return "Upload could not be verified. Please try again.";
}

export class StorageService implements StorageServiceInterface {
  private storageDao: StorageDao;
  private cloudFunctionsDao: CloudFunctionsDao;
  private uploadArchiveDao: UploadArchiveDao;

  constructor() {
    const factory = getDaoFactory();
    this.storageDao = factory.getStorageDao();
    this.cloudFunctionsDao = factory.getCloudFunctionsDao();
    this.uploadArchiveDao = factory.getUploadArchiveDao();
  }

  validateFile(
    file: File,
    options: UploadOptions = {},
  ): { isImage: boolean; isVideo: boolean; isDocument: boolean } {
    return validateUploadFile(file, options);
  }

  async uploadArchiveFile(
    userId: string,
    file: File,
    options: UploadOptions = {},
  ): Promise<ArchiveUploadResult> {
    const descriptor = this.describeUpload(file, options);
    const hash = await hashFile(file);
    return this.authorizeAndUpload(userId, file, descriptor, hash, {
      upload: async (path) =>
        this.storageDao.upload(
          path,
          file,
          mergeMetadata({ contentType: descriptor.contentType }),
        ),
    });
  }

  uploadArchiveResumable(
    userId: string,
    file: File,
    options: UploadOptions = {},
  ): ArchiveUploadTask {
    const uploadCallbacks = new Set<(p: StorageUploadProgress) => void>();
    const hashCallbacks = new Set<(fraction: number) => void>();
    let innerTask: StorageUploadTask | null = null;
    let cancelled = false;
    const abort = new AbortController();

    const run = async (): Promise<ArchiveUploadResult> => {
      const descriptor = this.describeUpload(file, options);
      const hash = await hashFile(file, {
        signal: abort.signal,
        onProgress: (fraction) => {
          for (const cb of hashCallbacks) cb(fraction);
        },
      });
      if (cancelled) throw new UploadCancelledError();

      return this.authorizeAndUpload(userId, file, descriptor, hash, {
        upload: async (path) => {
          if (cancelled) throw new UploadCancelledError();
          innerTask = this.storageDao.uploadResumable(
            path,
            file,
            mergeMetadata({ contentType: descriptor.contentType }),
          );
          innerTask.onProgress((progress) => {
            for (const cb of uploadCallbacks) cb(progress);
          });
          return innerTask.done();
        },
      });
    };

    const donePromise = run();

    return {
      onProgress(callback) {
        uploadCallbacks.add(callback);
        return () => uploadCallbacks.delete(callback);
      },
      onHashProgress(callback) {
        hashCallbacks.add(callback);
        return () => hashCallbacks.delete(callback);
      },
      done() {
        return donePromise;
      },
      cancel() {
        cancelled = true;
        abort.abort();
        try {
          innerTask?.cancel();
        } catch {
          // Cancellation is best-effort.
        }
      },
    };
  }

  async uploadToPath(
    path: string,
    file: File,
    metadata?: StorageUploadMetadata,
  ): Promise<string> {
    try {
      return await this.storageDao.upload(path, file, mergeMetadata(metadata));
    } catch (error) {
      console.error("StorageService uploadToPath failed:", error);
      throw error;
    }
  }

  async uploadExternalImageToArchive(
    userId: string,
    externalUrl: string,
  ): Promise<ArchiveUploadResult> {
    const response = await fetch(externalUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch image from the provided URL.");
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error("The URL does not point to a valid image.");
    }
    const blob = await response.blob();
    const ext = deriveExtension("external", contentType);
    const file = new File([blob], `external.${ext}`, { type: contentType });
    return this.uploadArchiveFile(userId, file, { fileType: "images" });
  }

  async getBytes(url: string): Promise<Uint8Array> {
    try {
      return await this.storageDao.getBytes(url);
    } catch (error) {
      console.error("StorageService getBytes failed:", error);
      throw error;
    }
  }

  async getDownloadUrl(path: string): Promise<string> {
    try {
      return await this.storageDao.getDownloadUrl(path);
    } catch (error) {
      console.error("StorageService getDownloadUrl failed:", error);
      throw error;
    }
  }

  async deleteArchiveUpload(hash: string, force = false): Promise<void> {
    try {
      await this.cloudFunctionsDao.callFunction<
        DeleteStorageUploadRequest,
        unknown
      >("deleteStorageUpload", { hash, force });
    } catch (error) {
      console.error("StorageService deleteArchiveUpload failed:", error);
      throw error;
    }
  }

  async listArchiveUploads(
    userId: string,
  ): Promise<UploadArchiveDocument[]> {
    try {
      return await this.uploadArchiveDao.listUploads(userId);
    } catch (error) {
      console.error("StorageService listArchiveUploads failed:", error);
      throw error;
    }
  }

  async getArchiveUpload(
    userId: string,
    hash: string,
  ): Promise<UploadArchiveDocument | null> {
    try {
      return await this.uploadArchiveDao.getUpload(userId, hash);
    } catch (error) {
      console.error("StorageService getArchiveUpload failed:", error);
      throw error;
    }
  }

  async getShareableArchiveDownloadUrl(
    ownerId: string,
    hash: string,
  ): Promise<string> {
    try {
      const response = await this.cloudFunctionsDao.callFunction<
        GetStorageUploadDownloadUrlRequest,
        GetStorageUploadDownloadUrlResponse
      >("getStorageUploadDownloadUrl", { ownerId, hash });
      return response.url;
    } catch (error) {
      console.error("StorageService getShareableArchiveDownloadUrl failed:", error);
      throw error;
    }
  }

  async setUploadShareable(
    hash: string,
    shareable: boolean,
  ): Promise<boolean> {
    try {
      const response = await this.cloudFunctionsDao.callFunction<
        SetStorageUploadShareableRequest,
        SetStorageUploadShareableResponse
      >("setStorageUploadShareable", { hash, shareable });
      return response.shareable;
    } catch (error) {
      console.error("StorageService setUploadShareable failed:", error);
      throw error;
    }
  }

  async renameUpload(hash: string, displayName: string): Promise<string> {
    try {
      const response = await this.cloudFunctionsDao.callFunction<
        SetStorageUploadDisplayNameRequest,
        SetStorageUploadDisplayNameResponse
      >("setStorageUploadDisplayName", { hash, displayName });
      return response.displayName;
    } catch (error) {
      console.error("StorageService renameUpload failed:", error);
      throw error;
    }
  }

  async prepareGridDuplicateStorage(
    request: PrepareGridDuplicateStorageRequest,
  ): Promise<PrepareGridDuplicateStorageResponse> {
    try {
      return await this.cloudFunctionsDao.callFunction<
        PrepareGridDuplicateStorageRequest,
        PrepareGridDuplicateStorageResponse
      >("prepareGridDuplicateStorage", request);
    } catch (error) {
      console.error("StorageService prepareGridDuplicateStorage failed:", error);
      throw error;
    }
  }

  private describeUpload(
    file: File,
    options: UploadOptions,
  ): { kind: FileType; ext: string; contentType: string; size: number } {
    const { isImage, isVideo } = this.validateFile(file, options);
    const kind: FileType =
      options.fileType ?? (isImage ? "images" : isVideo ? "videos" : "documents");
    const contentType = (file.type || "application/octet-stream").toLowerCase();
    return {
      kind,
      ext: deriveExtension(file.name, contentType),
      contentType,
      size: file.size,
    };
  }

  private async authorizeAndUpload(
    userId: string,
    file: File,
    descriptor: {
      kind: FileType;
      ext: string;
      contentType: string;
      size: number;
    },
    hash: string,
    handlers: { upload: (path: string) => Promise<string> },
  ): Promise<ArchiveUploadResult> {
    const authorization = await this.cloudFunctionsDao.callFunction<
      AuthorizeStorageUploadRequest,
      AuthorizeStorageUploadResponse
    >("authorizeStorageUpload", {
      hash,
      size: descriptor.size,
      kind: descriptor.kind as UploadKind,
      ext: descriptor.ext,
      contentType: descriptor.contentType,
      displayName: file.name,
    });

    const path =
      authorization.path ??
      `users/${userId}/${descriptor.kind}/${hash}.${descriptor.ext}`;

    if (!authorization.uploadRequired) {
      if (!authorization.url) {
        throw new Error("Existing upload is missing its URL.");
      }
      return {
        url: authorization.url,
        hash,
        path,
        type: descriptor.kind,
        size: descriptor.size,
        uploadRequired: false,
      };
    }

    const uploadedUrl = await handlers.upload(path);
    const url = await this.waitForFinalize(userId, hash, uploadedUrl);
    return {
      url,
      hash,
      path,
      type: descriptor.kind,
      size: descriptor.size,
      uploadRequired: true,
    };
  }

  /**
   * Resolve once the server finalize trigger flips the archive doc to `active`
   * (returning its authoritative URL, or the uploaded URL as a fallback), or
   * reject if it is marked `failed` (e.g. server-side hash mismatch). Falls back
   * to the uploaded URL if finalization is not observed before the timeout.
   */
  private waitForFinalize(
    userId: string,
    hash: string,
    fallbackUrl: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      let unsubscribe: (() => void) | null = null;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe?.();
        fn();
      };

      const timer = setTimeout(() => {
        // Never observed finalization; trust the uploaded URL rather than hang.
        finish(() => resolve(fallbackUrl));
      }, FINALIZE_TIMEOUT_MS);

      unsubscribe = this.uploadArchiveDao.subscribeUploadStatus(
        userId,
        hash,
        (doc: UploadArchiveDocument | null) => {
          if (!doc || settled) return;
          if (doc.status === "active") {
            finish(() => resolve(doc.url ?? fallbackUrl));
          } else if (doc.status === "failed") {
            finish(() =>
              reject(new Error(finalizeFailureMessage(doc.failureReason))),
            );
          }
        },
      );
    });
  }
}
