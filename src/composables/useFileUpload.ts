import { getAuth } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { ContentType } from "@/types/TileContent";
import { createTileContent } from "@/utils/TileUtils";
import type { TileContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";

export type FileType = "images" | "videos";

export interface UploadOptions {
  /** Override the file type detection */
  fileType?: FileType;
  /** Custom max size in bytes (overrides default) */
  maxSize?: number;
}

/**
 * Validates that a file is a supported image or video and within size limits.
 * Throws a user-friendly error message on failure.
 */
function validateFile(file: File, options: UploadOptions = {}): { isImage: boolean; isVideo: boolean } {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const defaultMaxSize = isImage ? 10 * 1024 * 1024 : 500 * 1024 * 1024;
  const maxSize = options.maxSize ?? defaultMaxSize;

  if (!isImage && !isVideo) {
    throw new Error("Unsupported file type. Please upload an image or video.");
  }

  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / 1024 / 1024);
    throw new Error(`File is too large! Maximum size: ${sizeMB}MB`);
  }

  return { isImage, isVideo };
}

export function useFileUpload() {
  const auth = getAuth();
  const storage = getStorage();
  const layoutStore = useLayoutStore();

  /**
   * Upload a file to Firebase Storage and return just the URL.
   * Use this for cases where you need the URL directly (avatars, backgrounds, etc.).
   */
  const uploadFileToUrl = async (
    file: File,
    options: UploadOptions = {}
  ): Promise<string> => {
    const { isImage } = validateFile(file, options);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("You must be logged in to upload.");
    }

    const fileType = options.fileType ?? (isImage ? "images" : "videos");
    const filePath = `users/${currentUser.uid}/${fileType}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, filePath);

    // Set metadata with published flag to satisfy storage security rules
    const metadata = {
      customMetadata: {
        published: 'true'
      }
    };

    try {
      await uploadBytes(fileRef, file, metadata);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (error: any) {
      console.error('uploadFileToUrl - Upload failed:', {
        error,
        code: error.code,
        message: error.message,
        serverResponse: error.serverResponse
      });
      throw error;
    }
  };

  /**
   * Upload a file to Firebase Storage and return TileContent.
   * Use this for creating new tiles from uploaded files (non-optimistic path).
   */
  const uploadFile = async (
    file: File,
    options: UploadOptions = {}
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
   * 2. Uploads the file to Firebase in the background with progress tracking.
   * 3. On completion, stores the Firebase URL in resolvedUrls for Firestore persistence
   *    without swapping the displayed src (avoids flash / video playback interruption).
   * 4. On failure, removes the tile and alerts the user.
   */
  const uploadFileOptimistic = async (
    file: File,
    options: UploadOptions = {}
  ): Promise<void> => {
    const { isImage } = validateFile(file, options);

    const currentUser = auth.currentUser;
    if (!currentUser) {
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
      const fileType = options.fileType ?? (isImage ? "images" : "videos");
      const filePath = `users/${currentUser.uid}/${fileType}/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, filePath);

      // Set metadata with published flag to satisfy storage security rules
      const metadata = {
        customMetadata: {
          published: 'true'
        }
      };

      // Resumable upload to track progress
      const uploadTask = uploadBytesResumable(fileRef, file, metadata);
      uploadTask.on("state_changed", (snapshot) => {
        layoutStore.setTileUploading(tileId, snapshot.bytesTransferred / snapshot.totalBytes);
      });

      await uploadTask;
      const url = await getDownloadURL(fileRef);

      // Store the permanent URL for Firestore persistence without touching the displayed src.
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
    options: UploadOptions = {}
  ): Promise<void> => {
    const { isImage } = validateFile(file, options);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("You must be logged in to upload.");
    }

    // Immediately show a local preview via blob URL
    const blobUrl = URL.createObjectURL(file);
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    const content = createTileContent(contentType, { src: blobUrl });
    layoutStore.setTileContent(tileId, content);
    layoutStore.setTileUploading(tileId, 0);

    try {
      const fileType = options.fileType ?? (isImage ? "images" : "videos");
      const filePath = `users/${currentUser.uid}/${fileType}/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, filePath);

      const uploadTask = uploadBytesResumable(fileRef, file);
      uploadTask.on("state_changed", (snapshot) => {
        layoutStore.setTileUploading(tileId, snapshot.bytesTransferred / snapshot.totalBytes);
      });

      await uploadTask;
      const url = await getDownloadURL(fileRef);

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
   * Fetch an external image URL, upload it to Firebase Storage, and return our permanent URL.
   * Use this when a user provides a remote image URL so we own a copy and avoid external dependency.
   */
  const uploadExternalImageToStorage = async (
    externalUrl: string,
    pathPrefix = "images"
  ): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("You must be logged in to upload.");
    }

    const response = await fetch(externalUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch image from the provided URL.");
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error("The URL does not point to a valid image.");
    }

    const blob = await response.blob();
    const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
    const filePath = `users/${currentUser.uid}/${pathPrefix}/${Date.now()}_external.${ext}`;
    const fileRef = storageRef(storage, filePath);

    await uploadBytes(fileRef, blob, { contentType });
    return await getDownloadURL(fileRef);
  };

  return {
    uploadFile,
    uploadFileToUrl,
    uploadFileOptimistic,
    uploadFileOptimisticForTile,
    uploadExternalImageToStorage,
  };
}
