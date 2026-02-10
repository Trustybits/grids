import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ContentType } from "@/types/TileContent";
import { createTileContent } from "@/utils/TileUtils";
import type { TileContent } from "@/types/TileContent";

export function useFileUpload() {
  const auth = getAuth();
  const storage = getStorage();

  const uploadFile = async (file: File): Promise<TileContent | null> => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const maxSize = isImage ? 10 * 1024 * 1024 : 500 * 1024 * 1024; // 10MB for images, 500MB for videos

    if (!isImage && !isVideo) {
      throw new Error("Unsupported file type. Please upload an image or video.");
    }

    if (file.size > maxSize) {
      throw new Error(`File is too large! Maximum size: ${isImage ? "10MB" : "500MB"}`);
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("You must be logged in to upload.");
    }

    // Determine storage path based on file type
    const filePath = `users/${currentUser.uid}/${
      isImage ? "images" : "videos"
    }/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, filePath);

    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
    const contentData = { src: url };

    return createTileContent(contentType, contentData);
  };

  return {
    uploadFile,
  };
}
