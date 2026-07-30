import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { ContentType } from "@grids/contracts/types";
import { createTileContent } from "@/utils/TileUtils";
import { hasTransparentPixels } from "@/utils/imageAlpha";
import { NO_FILL_COLOR } from "@/composables/useColorPicker";
import type { TileContent } from "@grids/contracts/types";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridController } from "@/controllers/useGridController";
import type {
  ArchiveUploadResult,
  ArchiveUploadTask,
  UploadOptions,
} from "@/types/UploadFileTypes";
import { v4 as uuidv4 } from "uuid";
import {
  ensureDocumentItemThumbnailOnServer,
  documentItemIsPdf,
} from "@/composables/useDocumentThumbnail";
import type { StorageUploadProgress } from "@grids/contracts/dao";

type AuthProvider = ReturnType<typeof getAuthProvider>;
type ServiceFactory = ReturnType<typeof getServiceFactory>;
type StorageService = ReturnType<ServiceFactory["getStorageService"]>;
type GridSessionStore = ReturnType<typeof useGridSessionStore>;
type GridController = ReturnType<typeof useGridController>;

/** Hashing occupies the first half of a media tile's progress bar, upload the second. */
const HASH_PROGRESS_SHARE = 0.5;

const uploadFraction = (progress: StorageUploadProgress): number =>
  progress.totalBytes > 0
    ? progress.bytesTransferred / progress.totalBytes
    : 0;

export function useFileUpload() {
  let authProvider: AuthProvider | null = null;
  let storageService: StorageService | null = null;
  let sessionStore: GridSessionStore | null = null;
  let controller: GridController | null = null;

  const getUploadAuthProvider = (): AuthProvider => {
    authProvider ??= getAuthProvider();
    return authProvider;
  };

  const getUploadStorageService = (): StorageService => {
    storageService ??= getServiceFactory().getStorageService();
    return storageService;
  };

  const getUploadSessionStore = (): GridSessionStore => {
    sessionStore ??= useGridSessionStore();
    return sessionStore;
  };

  const getUploadController = (): GridController => {
    controller ??= useGridController();
    return controller;
  };

  const cancelUploadTask = (uploadTask: ArchiveUploadTask) => {
    try {
      uploadTask.cancel();
    } catch {
      // Cancellation is best-effort; controller validation drops late callbacks.
    }
  };

  const requireUserId = (): string => {
    const currentUserId = getUploadAuthProvider().getCurrentUserId();
    if (!currentUserId) {
      throw new Error("You must be logged in to upload.");
    }
    return currentUserId;
  };

  /**
   * Upload a user-owned file through the archive flow and return the structured
   * result (url + hash + path + type + size).
   */
  const uploadFileToArchive = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<ArchiveUploadResult> => {
    const storageService = getUploadStorageService();
    const currentUserId = requireUserId();
    try {
      return await storageService.uploadArchiveFile(
        currentUserId,
        file,
        options,
      );
    } catch (error) {
      console.error("uploadFileToArchive - Upload failed:", { error });
      throw error;
    }
  };

  /**
   * Upload a file to storage and return just the URL. Back-compat helper for
   * callers that only need a URL (e.g. smart-text inline images). The file is
   * still routed through the archive flow so it is hashed, deduped, and counted.
   */
  const uploadFileToUrl = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<string> => {
    const result = await uploadFileToArchive(file, options);
    return result.url;
  };

  /**
   * Archive upload with resumable progress reporting. Returns the structured
   * result. The optional `onProgress` callback receives a 0–1 fraction that
   * spans both the hashing (first half) and byte-transfer (second half) phases.
   */
  const uploadFileToArchiveWithProgress = async (
    file: File,
    options: UploadOptions = {},
    onProgress?: (fraction: number) => void,
  ): Promise<ArchiveUploadResult> => {
    const storageService = getUploadStorageService();
    const currentUserId = requireUserId();
    try {
      const uploadTask = storageService.uploadArchiveResumable(
        currentUserId,
        file,
        options,
      );
      if (onProgress) {
        uploadTask.onHashProgress((fraction) =>
          onProgress(fraction * HASH_PROGRESS_SHARE),
        );
        uploadTask.onProgress((progress) =>
          onProgress(
            HASH_PROGRESS_SHARE +
              (1 - HASH_PROGRESS_SHARE) * uploadFraction(progress),
          ),
        );
      }
      return await uploadTask.done();
    } catch (error) {
      console.error("uploadFileToArchiveWithProgress - Upload failed:", {
        error,
      });
      throw error;
    }
  };

  /**
   * Back-compat wrapper returning only the URL. Used where the caller does not
   * yet capture the archive hash (e.g. profile avatar).
   */
  const uploadFileToUrlWithProgress = async (
    file: File,
    options: UploadOptions = {},
    onProgress?: (fraction: number) => void,
  ): Promise<string> => {
    const result = await uploadFileToArchiveWithProgress(
      file,
      options,
      onProgress,
    );
    return result.url;
  };

  /**
   * An image tile defaults to an opaque fill, which silently discards whatever
   * transparency the uploaded file carried — the artwork sat on a solid card
   * instead of on the grid behind it. When the file really is see-through,
   * start the tile with no fill so the alpha reads as intended. The owner can
   * still pick a fill afterwards; this only changes what it starts as.
   *
   * Returns an empty patch for opaque images, video, and any file whose alpha
   * could not be determined, so the previous default stands untouched.
   */
  const transparentFillPatch = async (
    file: File,
    isImage: boolean,
  ): Promise<{ backgroundColor?: string }> => {
    if (!isImage) return {};
    return (await hasTransparentPixels(file))
      ? { backgroundColor: NO_FILL_COLOR }
      : {};
  };

  /**
   * Upload a file to storage and return TileContent (non-optimistic path).
   */
  const uploadFile = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<TileContent | null> => {
    const result = await uploadFileToArchive(file, options);

    const isImage = file.type.startsWith("image/");
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    return createTileContent(contentType, {
      src: result.url,
      srcHash: result.hash,
      ...(await transparentFillPatch(file, isImage)),
    });
  };

  /**
   * Optimistic upload for a **new** media tile (toolbar, drag-and-drop, paste).
   *
   * 1. Creates a tile immediately with a local blob URL for instant feedback.
   * 2. Hashes, authorizes, and uploads in the background with progress tracking
   *    (hashing fills the first half of the bar, upload the second).
   * 3. On finalize, records the storage URL and archive hash for persistence
   *    without swapping the displayed src (avoids flash / playback interruption).
   * 4. On failure, removes the tile and alerts the user.
   */
  const uploadFileOptimistic = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<void> => {
    const storageService = getUploadStorageService();
    const controller = getUploadController();
    const { isImage } = storageService.validateFile(file, options);
    requireUserId();
    const currentUserId = getUploadAuthProvider().getCurrentUserId() as string;

    // Immediately show a local preview via blob URL
    const blobUrl = URL.createObjectURL(file);
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    // Resolved before the tile is created so a transparent image never renders
    // one frame against the opaque default and then pops to no-fill. The probe
    // decodes at most 64x64, so the added latency is negligible.
    const fillPatch = await transparentFillPatch(file, isImage);
    const content = createTileContent(contentType, {
      src: blobUrl,
      ...fillPatch,
    });
    const tileId = controller.addTile(content);

    if (!tileId) {
      controller.revokeOwnedObjectUrl(blobUrl);
      return;
    }

    let uploadId: string | null = null;
    try {
      const uploadTask = storageService.uploadArchiveResumable(
        currentUserId,
        file,
        options,
      );
      uploadId = controller.startUpload({
        tileId,
        progress: 0,
        ownedObjectUrl: blobUrl,
        task: uploadTask,
      });
      if (!uploadId) {
        cancelUploadTask(uploadTask);
        controller.revokeOwnedObjectUrl(blobUrl);
        return;
      }
      const currentUploadId = uploadId;

      uploadTask.onHashProgress((fraction) =>
        controller.progressUpload(
          currentUploadId,
          fraction * HASH_PROGRESS_SHARE,
        ),
      );
      uploadTask.onProgress((progress) =>
        controller.progressUpload(
          currentUploadId,
          HASH_PROGRESS_SHARE +
            (1 - HASH_PROGRESS_SHARE) * uploadFraction(progress),
        ),
      );

      const result = await uploadTask.done();

      // Store the permanent URL + archive hash for persistence without touching
      // the displayed src. Avoids a visible flash and keeps playback smooth.
      controller.resolveUpload(currentUploadId, result.url, result.hash);
    } catch (error) {
      console.error("File upload failed:", error);
      if (uploadId && controller.failUpload(uploadId)) {
        controller.removeTile(tileId);
      }
      throw error; // Re-throw so callers can display their own error UI
    }
  };

  /**
   * Optimistic upload for an **existing** tile (e.g. suggestion tile → media).
   * On failure, reverts the tile to a suggestion.
   */
  const uploadFileOptimisticForTile = async (
    file: File,
    tileId: string,
    options: UploadOptions = {},
  ): Promise<void> => {
    const storageService = getUploadStorageService();
    const controller = getUploadController();
    const { isImage } = storageService.validateFile(file, options);
    requireUserId();
    const currentUserId = getUploadAuthProvider().getCurrentUserId() as string;

    // Immediately show a local preview via blob URL
    const blobUrl = URL.createObjectURL(file);
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    const fillPatch = await transparentFillPatch(file, isImage);
    const content = createTileContent(contentType, {
      src: blobUrl,
      ...fillPatch,
    });
    controller.setTileContent(tileId, content);

    let uploadId: string | null = null;
    try {
      const uploadTask = storageService.uploadArchiveResumable(
        currentUserId,
        file,
        options,
      );
      uploadId = controller.startUpload({
        tileId,
        progress: 0,
        ownedObjectUrl: blobUrl,
        task: uploadTask,
      });
      if (!uploadId) {
        cancelUploadTask(uploadTask);
        controller.revokeOwnedObjectUrl(blobUrl);
        return;
      }
      const currentUploadId = uploadId;

      uploadTask.onHashProgress((fraction) =>
        controller.progressUpload(
          currentUploadId,
          fraction * HASH_PROGRESS_SHARE,
        ),
      );
      uploadTask.onProgress((progress) =>
        controller.progressUpload(
          currentUploadId,
          HASH_PROGRESS_SHARE +
            (1 - HASH_PROGRESS_SHARE) * uploadFraction(progress),
        ),
      );

      const result = await uploadTask.done();

      controller.resolveUpload(currentUploadId, result.url, result.hash);
    } catch (error) {
      console.error("File upload failed:", error);

      // Revert to suggestion tile on failure
      if (uploadId && controller.failUpload(uploadId)) {
        const revertContent = createTileContent(ContentType.SUGGESTION, {
          action: "media",
          label: "Add Media",
        });
        controller.setTileContent(tileId, revertContent);
      }
      throw error;
    }
  };

  /**
   * Optimistic upload of one or more document files into a single documents tile.
   */
  const uploadDocumentsOptimistic = async (
    files: File[],
  ): Promise<void> => {
    if (files.length === 0) return;
    const storageService = getUploadStorageService();
    const controller = getUploadController();
    const sessionStore = getUploadSessionStore();
    for (const f of files) {
      storageService.validateFile(f, { fileType: "documents" });
    }

    requireUserId();
    const currentUserId = getUploadAuthProvider().getCurrentUserId() as string;

    const items = files.map((file) => ({
      id: uuidv4(),
      fileName: file.name,
      url: URL.createObjectURL(file),
      mimeType: file.type || undefined,
    }));

    const content = createTileContent(ContentType.DOCUMENT, { items });
    const tileId = controller.addTile(content);

    if (!tileId) {
      for (const item of items) {
        controller.revokeOwnedObjectUrl(item.url);
      }
      return;
    }

    let activeUploadId: string | null = null;
    try {
      const n = files.length;
      let completed = 0;
      for (let i = 0; i < n; i++) {
        const file = files[i];
        const item = items[i];
        if (!file || !item) continue;
        const uploadTask = storageService.uploadArchiveResumable(
          currentUserId,
          file,
          { fileType: "documents" },
        );
        const uploadId = controller.startUpload({
          tileId,
          itemId: item.id,
          progress: completed / n,
          ownedObjectUrl: item.url,
          task: uploadTask,
        });
        activeUploadId = uploadId;
        if (!uploadId) {
          cancelUploadTask(uploadTask);
          controller.revokeOwnedObjectUrl(item.url);
          return;
        }

        uploadTask.onProgress((progress) => {
          controller.progressUpload(
            uploadId,
            (completed + uploadFraction(progress)) / n,
          );
        });

        const result = await uploadTask.done();
        completed += 1;
        controller.progressUpload(uploadId, completed / n);
        // Record each item's resolved URL + hash without clearing progress yet;
        // the single final save is scheduled and flushed after the loop.
        if (
          !controller.resolveUpload(
            uploadId,
            result.url,
            result.hash,
            i === n - 1,
          )
        ) {
          return;
        }
      }
      // Server-side thumbnail generation requires the document data to be
      // durably persisted first, so flush the scheduled saves before starting.
      await controller.flushSaves();

      const gridId = sessionStore.currentGrid?.id;
      if (gridId) {
        const thumbJobs = items
          .map((item, i) => ({ item, file: files[i] }))
          .filter(
            (
              x,
            ): x is {
              item: (typeof items)[number];
              file: File;
            } => !!x.item && !!x.file && documentItemIsPdf(x.file.name, x.file.type),
          )
          .map(({ item }) =>
            ensureDocumentItemThumbnailOnServer(gridId, tileId, item.id)
              .then((res) => {
                if (res.thumbnailUrl) {
                  controller.patchDocumentItem(tileId, item.id, {
                    thumbnailUrl: res.thumbnailUrl,
                  });
                }
              })
              .catch((err) => {
                console.warn("Document thumbnail generation failed:", err);
              }),
          );
        void Promise.all(thumbJobs);
      }
    } catch (error) {
      console.error("Document upload failed:", error);
      if (activeUploadId && controller.failUpload(activeUploadId)) {
        controller.removeTile(tileId);
      }
      throw error;
    }
  };

  /**
   * Fetch an external image URL and copy it into the caller's archive. Returns
   * the structured result (url + hash).
   */
  const uploadExternalImageToArchive = async (
    externalUrl: string,
  ): Promise<ArchiveUploadResult> => {
    const storageService = getUploadStorageService();
    const currentUserId = requireUserId();
    return storageService.uploadExternalImageToArchive(
      currentUserId,
      externalUrl,
    );
  };

  /**
   * Back-compat wrapper returning only the URL for external-image imports.
   */
  const uploadExternalImageToStorage = async (
    externalUrl: string,
  ): Promise<string> => {
    const result = await uploadExternalImageToArchive(externalUrl);
    return result.url;
  };

  return {
    uploadFile,
    uploadFileToUrl,
    uploadFileToArchive,
    uploadFileToUrlWithProgress,
    uploadFileToArchiveWithProgress,
    uploadFileOptimistic,
    uploadDocumentsOptimistic,
    uploadFileOptimisticForTile,
    uploadExternalImageToStorage,
    uploadExternalImageToArchive,
  };
}
