import type {
  StorageUploadMetadata,
  StorageUploadTask,
} from "@/dao/interfaces/StorageDao";
import type { IStorageService } from "../interfaces/IStorageService";

export class MockStorageService implements IStorageService {
  upload(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }
  uploadResumable(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask {
    throw new Error("Method not implemented.");
  }
  getDownloadUrl(path: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  delete(path: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  buildUserPath(userId: string, folder: string, fileName: string): string {
    throw new Error("Method not implemented.");
  }
}
