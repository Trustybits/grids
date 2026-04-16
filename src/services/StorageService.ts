import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { StorageDao } from "@/dao/interfaces/StorageDao";
import type {
  StorageUploadMetadata,
  StorageUploadTask,
} from "@/dao/interfaces/StorageDao";
import type { IStorageService } from "./interfaces/IStorageService";

const PUBLISHED_METADATA: StorageUploadMetadata = {
  customMetadata: { published: "true" },
};

function mergeMetadata(
  custom?: StorageUploadMetadata,
): StorageUploadMetadata {
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

  async upload(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): Promise<string> {
    try {
      return await this.storageDao.upload(path, data, mergeMetadata(metadata));
    } catch (error) {
      console.error("StorageService upload failed:", error);
      throw error;
    }
  }

  uploadResumable(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask {
    return this.storageDao.uploadResumable(
      path,
      data,
      mergeMetadata(metadata),
    );
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

  buildUserPath(userId: string, folder: string, fileName: string): string {
    return this.storageDao.buildUserPath(userId, folder, fileName);
  }
}
