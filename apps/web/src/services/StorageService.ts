import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { StorageDao } from "@grids/contracts/dao";
import type {
  StorageUploadMetadata,
  StorageUploadTask,
} from "@grids/contracts/dao";
import type { IStorageService } from "./interfaces/IStorageService";
import type { UploadOptions } from "@/types/UploadFileTypes";
import { validateUploadFile } from "@/utils/UploadFileClassification";

const PUBLISHED_METADATA: StorageUploadMetadata = {
  customMetadata: { published: "true" },
};

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

export class StorageService implements IStorageService {
  private storageDao: StorageDao;

  constructor() {
    const factory = getDaoFactory();
    this.storageDao = factory.getStorageDao();
  }

  validateFile(
    file: File,
    options: UploadOptions = {},
  ): { isImage: boolean; isVideo: boolean; isDocument: boolean } {
    return validateUploadFile(file, options);
  }

  async upload(userId: string, file: File, options: UploadOptions = {}, metadata?: StorageUploadMetadata): Promise<string> {
    const { isImage, isVideo } = this.validateFile(file, options);

    const fileType =
      options.fileType ??
      (isImage ? "images" : isVideo ? "videos" : "documents");
    const filePath = this.buildFilePath("users", userId, fileType, file.name);

    try {
      return await this.storageDao.upload(filePath, file, mergeMetadata(metadata));
    } catch (error) {
      console.error("StorageService upload failed:", error);
      throw error;
    }
  }

  uploadResumable(
    userId: string,
    file: File,
    options: UploadOptions = {},
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask {
    const { isImage, isVideo } = this.validateFile(file, options);

    const fileType =
      options.fileType ??
      (isImage ? "images" : isVideo ? "videos" : "documents");
    const filePath = this.buildFilePath("users", userId, fileType, file.name);

    return this.storageDao.uploadResumable(filePath, file, mergeMetadata(metadata));
  }

  async uploadExternalImage(userId: string, externalUrl: string, folder = "images"): Promise<string> {
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
    const fileName = `external.${ext}`;
    const filePath = this.buildFilePath("users", userId, folder, fileName);

    try {
      return await this.storageDao.upload(filePath, blob, mergeMetadata({ contentType }));
    } catch (error) {
      console.error("StorageService uploadExternalImage failed:", error);
      throw error;
    }
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

  async delete(path: string): Promise<void> {
    try {
      await this.storageDao.delete(path);
    } catch (error) {
      console.error("StorageService delete failed:", error);
      throw error;
    }
  }

  buildFilePath(root: string, userId: string, folder: string, fileName: string): string {
    return this.storageDao.buildFilePath(root, userId, folder, fileName);
  }
}
