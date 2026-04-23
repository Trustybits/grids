import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { ContentType } from "@/types/TileContent";
import { createTileContent } from "@/utils/TileUtils";
import type { TileContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import type { UploadOptions } from "@/types/UploadFileTypes";
import type {
  StorageUploadProgress,
  StorageUploadTask,
} from "@/dao/interfaces/StorageDao";

export function useFileUpload() {
  const authProvider = getAuthProvider();
  const storageService = getServiceFactory().getStorageService();
  const layoutStore = useLayoutStore();

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
    } catch (error: any) {
      console.error("uploadFileToUrl - Upload failed:", {
        error,
        code: error.code,
        message: error.message,
        serverResponse: error.serverResponse,
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
    const tileId = layoutStore.addTile(content);

    if (!tileId) {
      URL.revokeObjectURL(blobUrl);
      return;
    }

    // Mark tile as uploading so content components show a progress bar
    layoutStore.setTileUploading(tileId, 0);

    try {
      // Resumable upload to track progress
      const uploadTask: StorageUploadTask = storageService.uploadResumable(
        currentUserId,
        file,
        options,
      );

      uploadTask.onProgress((progress: StorageUploadProgress) => {
        layoutStore.setTileUploading(
          tileId,
          progress.bytesTransferred / progress.totalBytes,
        );
      });

      const url = await uploadTask.done();

      // Store the permanent URL for persistence without touching the displayed src.
      // This avoids a visible flash and keeps video playback uninterrupted.
      layoutStore.setResolvedUrl(tileId, url);
      layoutStore.clearTileUploading(tileId);
      layoutStore.updateLayout();
    } catch (error: any) {
      console.error("File upload failed:", error);
      layoutStore.clearTileUploading(tileId);
      URL.revokeObjectURL(blobUrl);
      layoutStore.removeTile(tileId);
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
    layoutStore.setTileContent(tileId, content);
    layoutStore.setTileUploading(tileId, 0);

    try {
      const uploadTask: StorageUploadTask = storageService.uploadResumable(
        currentUserId,
        file,
        options,
      );

      uploadTask.onProgress((progress: StorageUploadProgress) => {
        layoutStore.setTileUploading(
          tileId,
          progress.bytesTransferred / progress.totalBytes,
        );
      });

      const url = await uploadTask.done();

      layoutStore.setResolvedUrl(tileId, url);
      layoutStore.clearTileUploading(tileId);
      layoutStore.updateLayout();
    } catch (error: any) {
      console.error("File upload failed:", error);
      layoutStore.clearTileUploading(tileId);
      URL.revokeObjectURL(blobUrl);

      // Revert to suggestion tile on failure
      const revertContent = createTileContent(ContentType.SUGGESTION, {
        action: "media",
        label: "Add Media",
      });
      layoutStore.setTileContent(tileId, revertContent);
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

    return storageService.uploadExternalImage(currentUserId, externalUrl, folder);
  };

  return {
    uploadFile,
    uploadFileToUrl,
    uploadFileOptimistic,
    uploadFileOptimisticForTile,
    uploadExternalImageToStorage,
  };
}
