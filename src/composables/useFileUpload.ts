import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ContentType } from "@/types/TileContent";
import { createTileContent } from "@/utils/TileUtils";
import type { TileContent } from "@/types/TileContent";

export type FileType = "image" | "video";

export interface UploadOptions {
  /**
   * Override the file type detection
   */
  fileType?: FileType;
  /**
   * Custom max size in bytes (overrides default)
   */
  maxSize?: number;
}

export function useFileUpload() {
  const auth = getAuth();
  const storage = getStorage();

  /**
   * Upload a file to Firebase Storage and return just the URL
   * Use this for cases where you need to set the URL directly (avatars, backgrounds, etc.)
   */
  const uploadFileToUrl = async (
    file: File,
    options: UploadOptions = {}
  ): Promise<string> => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const defaultMaxSize = isImage ? 10 * 1024 * 1024 : 500 * 1024 * 1024; // 10MB for images, 500MB for videos
    const maxSize = options.maxSize ?? defaultMaxSize;

    if (!isImage && !isVideo) {
      throw new Error("Unsupported file type. Please upload an image or video.");
    }

    if (file.size > maxSize) {
      const sizeMB = Math.round(maxSize / 1024 / 1024);
      throw new Error(`File is too large! Maximum size: ${sizeMB}MB`);
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("You must be logged in to upload.");
    }

    // Determine storage path based on file type
    const fileType = options.fileType ?? (isImage ? "images" : "videos");
    const filePath = `users/${currentUser.uid}/${fileType}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, filePath);

    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    return url;
  };

  /**
   * Upload a file to Firebase Storage and return TileContent
   * Use this for creating new tiles from uploaded files
   */
  const uploadFile = async (
    file: File,
    options: UploadOptions = {}
  ): Promise<TileContent | null> => {
    const url = await uploadFileToUrl(file, options);
    
    const isImage = file.type.startsWith("image/");
    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    const contentData = { src: url };

    return createTileContent(contentType, contentData);
  };

  return {
    uploadFile,
    uploadFileToUrl,
  };
}
