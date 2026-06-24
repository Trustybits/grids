import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { ContentType } from "@grids/contracts/types";
import { createTileContent } from "@/utils/TileUtils";
import type { TileContent } from "@grids/contracts/types";
import { useGridStore } from "@/stores/grid";
import type { UploadOptions } from "@/types/UploadFileTypes";
import { v4 as uuidv4 } from "uuid";
import {
  ensureDocumentItemThumbnailOnServer,
  documentItemIsPdf,
} from "@/composables/useDocumentThumbnail";
import type {
  StorageUploadProgress,
  StorageUploadTask,
} from "@grids/contracts/dao";

type AuthProvider = ReturnType<typeof getAuthProvider>;
type ServiceFactory = ReturnType<typeof getServiceFactory>;
type StorageService = ReturnType<ServiceFactory["getStorageService"]>;
type GridStore = ReturnType<typeof useGridStore>;

export function useFileUpload() {
  let authProvider: AuthProvider | null = null;
  let storageService: StorageService | null = null;
  let gridStore: GridStore | null = null;

  const getUploadAuthProvider = (): AuthProvider => {
    authProvider ??= getAuthProvider();
    return authProvider;
  };

  const getUploadStorageService = (): StorageService => {
    storageService ??= getServiceFactory().getStorageService();
    return storageService;
  };

  const getUploadGridStore = (): GridStore => {
    gridStore ??= useGridStore();
    return gridStore;
  };

  const cancelUploadTask = (uploadTask: StorageUploadTask) => {
    try {
      uploadTask.cancel();
    } catch {
      // Cancellation is best-effort; controller validation drops late callbacks.
    }
  };

  /**
   * Upload a file to storage and return just the URL.
   * Use this for cases where you need the URL directly (avatars, backgrounds, etc.).
   */
  const uploadFileToUrl = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<string> => {
    const authProvider = getUploadAuthProvider();
    const storageService = getUploadStorageService();
    const currentUserId = authProvider.getCurrentUserId();
    if (!currentUserId) {
      throw new Error("You must be logged in to upload.");
    }

    try {
      return await storageService.upload(currentUserId, file, options);
    } catch (error) {
      console.error("uploadFileToUrl - Upload failed:", {
        error,
      });
      throw error;
    }
  };

  /**
   * Upload a file to storage and return TileContent.
   * Use this for creating new tiles from uploaded files (non-optimistic path).
   */
  const uploadFile = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<TileContent | null> => {
    const url = await uploadFileToUrl(file, options);

    const isImage = file.type.startsWith("image/");
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    return createTileContent(contentType, { src: url });
  };

  /**
   * Optimistic upload for a **new** tile (toolbar button, drag-and-drop, paste).
   *
   * 1. Creates a tile immediately with a local blob URL so the user sees instant feedback.
   * 2. Uploads the file to storage in the background with progress tracking.
   * 3. On completion, stores the storage URL in resolvedUrls for persistence
   *    without swapping the displayed src (avoids flash / video playback interruption).
   * 4. On failure, removes the tile and alerts the user.
   */
  const uploadFileOptimistic = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<void> => {
    const authProvider = getUploadAuthProvider();
    const storageService = getUploadStorageService();
    const gridStore = getUploadGridStore();
    const { isImage } = storageService.validateFile(file, options);

    const currentUserId = authProvider.getCurrentUserId();
    if (!currentUserId) {
      throw new Error("You must be logged in to upload.");
    }

    // Immediately show a local preview via blob URL
    const blobUrl = URL.createObjectURL(file);
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    const content = createTileContent(contentType, { src: blobUrl });
    const tileId = gridStore.addTile(content);

    if (!tileId) {
      gridStore.revokeOwnedObjectUrl(blobUrl);
      return;
    }

    let uploadId: string | null = null;
    try {
      // Resumable upload to track progress
      const uploadTask: StorageUploadTask = storageService.uploadResumable(
        currentUserId,
        file,
        options,
      );
      uploadId = gridStore.startUpload({
        tileId,
        progress: 0,
        ownedObjectUrl: blobUrl,
        task: uploadTask,
      });
      if (!uploadId) {
        cancelUploadTask(uploadTask);
        gridStore.revokeOwnedObjectUrl(blobUrl);
        return;
      }
      const currentUploadId = uploadId;

      uploadTask.onProgress((progress: StorageUploadProgress) => {
        gridStore.progressUpload(
          currentUploadId,
          progress.bytesTransferred / progress.totalBytes,
        );
      });

      const url = await uploadTask.done();

      // Store the permanent URL for persistence without touching the displayed src.
      // This avoids a visible flash and keeps video playback uninterrupted.
      gridStore.resolveUpload(currentUploadId, url);
    } catch (error) {
      console.error("File upload failed:", error);
      if (uploadId && gridStore.failUpload(uploadId)) {
        gridStore.removeTile(tileId);
      }
      throw error; // Re-throw so callers can display their own error UI
    }
  };

  /**
   * Optimistic upload for an **existing** tile (e.g. suggestion tile → media).
   *
   * Same flow as uploadFileOptimistic but updates the content of an existing tile
   * rather than creating a new one. On failure, reverts the tile to a suggestion.
   */
  const uploadFileOptimisticForTile = async (
    file: File,
    tileId: string,
    options: UploadOptions = {},
  ): Promise<void> => {
    const authProvider = getUploadAuthProvider();
    const storageService = getUploadStorageService();
    const gridStore = getUploadGridStore();
    const { isImage } = storageService.validateFile(file, options);

    const currentUserId = authProvider.getCurrentUserId();
    if (!currentUserId) {
      throw new Error("You must be logged in to upload.");
    }

    // Immediately show a local preview via blob URL
    const blobUrl = URL.createObjectURL(file);
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    const content = createTileContent(contentType, { src: blobUrl });
    gridStore.setTileContent(tileId, content);

    let uploadId: string | null = null;
    try {
      const uploadTask: StorageUploadTask = storageService.uploadResumable(
        currentUserId,
        file,
        options,
      );
      uploadId = gridStore.startUpload({
        tileId,
        progress: 0,
        ownedObjectUrl: blobUrl,
        task: uploadTask,
      });
      if (!uploadId) {
        cancelUploadTask(uploadTask);
        gridStore.revokeOwnedObjectUrl(blobUrl);
        return;
      }
      const currentUploadId = uploadId;

      uploadTask.onProgress((progress: StorageUploadProgress) => {
        gridStore.progressUpload(
          currentUploadId,
          progress.bytesTransferred / progress.totalBytes,
        );
      });

      const url = await uploadTask.done();

      gridStore.resolveUpload(currentUploadId, url);
    } catch (error) {
      console.error("File upload failed:", error);

      // Revert to suggestion tile on failure
      if (uploadId && gridStore.failUpload(uploadId)) {
        const revertContent = createTileContent(ContentType.SUGGESTION, {
          action: "media",
          label: "Add Media",
        });
        gridStore.setTileContent(tileId, revertContent);
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
    const authProvider = getUploadAuthProvider();
    const storageService = getUploadStorageService();
    const gridStore = getUploadGridStore();
    for (const f of files) {
      storageService.validateFile(f, { fileType: "documents" });
    }

    const currentUserId = authProvider.getCurrentUserId();
    if (!currentUserId) {
      throw new Error("You must be logged in to upload.");
    }

    const items = files.map((file) => ({
      id: uuidv4(),
      fileName: file.name,
      url: URL.createObjectURL(file),
      mimeType: file.type || undefined,
    }));

    const content = createTileContent(ContentType.DOCUMENT, { items });
    const tileId = gridStore.addTile(content);

    if (!tileId) {
      for (const item of items) {
        gridStore.revokeOwnedObjectUrl(item.url);
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
        const uploadTask = storageService.uploadResumable(
          currentUserId,
          file,
          { fileType: "documents" },
        );
        const uploadId = gridStore.startUpload({
          tileId,
          itemId: item.id,
          progress: completed / n,
          ownedObjectUrl: item.url,
          task: uploadTask,
        });
        activeUploadId = uploadId;
        if (!uploadId) {
          cancelUploadTask(uploadTask);
          gridStore.revokeOwnedObjectUrl(item.url);
          return;
        }

        uploadTask.onProgress((progress) => {
          const fileFrac =
            progress.totalBytes > 0
              ? progress.bytesTransferred / progress.totalBytes
              : 0;
          gridStore.progressUpload(
            uploadId,
            (completed + fileFrac) / n,
          );
        });

        const url = await uploadTask.done();
        completed += 1;
        gridStore.progressUpload(uploadId, completed / n);
        // Record each item's resolved URL without clearing progress yet; the
        // single final save is scheduled and flushed after the loop.
        if (!gridStore.resolveUpload(uploadId, url, i === n - 1)) {
          return;
        }
      }
      // Server-side thumbnail generation requires the document data to be
      // durably persisted first, so flush the scheduled saves before starting.
      await gridStore.flushSaves();

      const gridId = gridStore.currentGrid?.id;
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
                  gridStore.patchDocumentItem(tileId, item.id, {
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
      if (activeUploadId && gridStore.failUpload(activeUploadId)) {
        gridStore.removeTile(tileId);
      }
      throw error;
    }
  };

  /**
   * Fetch an external image URL, upload it to storage, and return our permanent URL.
   * Use this when a user provides a remote image URL so we own a copy and avoid external dependency.
   */
  const uploadExternalImageToStorage = async (
    externalUrl: string,
    folder = "images",
  ): Promise<string> => {
    const authProvider = getUploadAuthProvider();
    const storageService = getUploadStorageService();
    const currentUserId = authProvider.getCurrentUserId();
    if (!currentUserId) {
      throw new Error("You must be logged in to upload.");
    }

    return storageService.uploadExternalImage(
      currentUserId,
      externalUrl,
      folder,
    );
  };

  return {
    uploadFile,
    uploadFileToUrl,
    uploadFileOptimistic,
    uploadDocumentsOptimistic,
    uploadFileOptimisticForTile,
    uploadExternalImageToStorage,
  };
}
