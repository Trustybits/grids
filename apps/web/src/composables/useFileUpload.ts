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

export function useFileUpload() {
  const authProvider = getAuthProvider();
  const storageService = getServiceFactory().getStorageService();
  const gridStore = useGridStore();

  /**
   * Upload a file to storage and return just the URL.
   * Use this for cases where you need the URL directly (avatars, backgrounds, etc.).
   */
  const uploadFileToUrl = async (
    file: File,
    options: UploadOptions = {},
  ): Promise<string> => {
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
      URL.revokeObjectURL(blobUrl);
      return;
    }

    // Mark tile as uploading so content components show a progress bar
    gridStore.setTileUploading(tileId, 0);

    try {
      // Resumable upload to track progress
      const uploadTask: StorageUploadTask = storageService.uploadResumable(
        currentUserId,
        file,
        options,
      );

      uploadTask.onProgress((progress: StorageUploadProgress) => {
        gridStore.setTileUploading(
          tileId,
          progress.bytesTransferred / progress.totalBytes,
        );
      });

      const url = await uploadTask.done();

      // Store the permanent URL for persistence without touching the displayed src.
      // This avoids a visible flash and keeps video playback uninterrupted.
      gridStore.resolveUploadedUrl({ tileId, permanentUrl: url });
    } catch (error) {
      console.error("File upload failed:", error);
      gridStore.clearTileUploading(tileId);
      URL.revokeObjectURL(blobUrl);
      gridStore.removeTile(tileId);
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
    gridStore.setTileUploading(tileId, 0);

    try {
      const uploadTask: StorageUploadTask = storageService.uploadResumable(
        currentUserId,
        file,
        options,
      );

      uploadTask.onProgress((progress: StorageUploadProgress) => {
        gridStore.setTileUploading(
          tileId,
          progress.bytesTransferred / progress.totalBytes,
        );
      });

      const url = await uploadTask.done();

      gridStore.resolveUploadedUrl({ tileId, permanentUrl: url });
    } catch (error) {
      console.error("File upload failed:", error);
      gridStore.clearTileUploading(tileId);
      URL.revokeObjectURL(blobUrl);

      // Revert to suggestion tile on failure
      const revertContent = createTileContent(ContentType.SUGGESTION, {
        action: "media",
        label: "Add Media",
      });
      gridStore.setTileContent(tileId, revertContent);
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
        URL.revokeObjectURL(item.url);
      }
      return;
    }

    gridStore.setTileUploading(tileId, 0);

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

        uploadTask.onProgress((progress) => {
          const fileFrac =
            progress.totalBytes > 0
              ? progress.bytesTransferred / progress.totalBytes
              : 0;
          gridStore.setTileUploading(
            tileId,
            (completed + fileFrac) / n,
          );
        });

        const url = await uploadTask.done();
        completed += 1;
        gridStore.setTileUploading(tileId, completed / n);
        // Record each item's resolved URL without clearing progress yet; the
        // single final save is scheduled and flushed after the loop.
        gridStore.resolveUploadedUrl({
          tileId,
          itemId: item.id,
          permanentUrl: url,
          final: false,
        });
      }
      gridStore.clearTileUploading(tileId);
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
      gridStore.clearTileUploading(tileId);
      for (const item of items) {
        URL.revokeObjectURL(item.url);
      }
      gridStore.removeTile(tileId);
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
