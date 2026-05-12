import type {
  StorageUploadMetadata,
  StorageUploadTask,
} from "@/dao/interfaces/StorageDao";
import type { IStorageService } from "../interfaces/IStorageService";
import type { UploadOptions } from "@/types/UploadFileTypes";
import { validateUploadFile } from "@/utils/uploadFileClassification";

export class MockStorageService implements IStorageService {
  validateFile(
    file: File,
    options: UploadOptions,
  ): { isImage: boolean; isVideo: boolean; isDocument: boolean } {
    return validateUploadFile(file, options);
  }
  upload(
    _userId: string,
    _file: File,
    _options?: UploadOptions,
    _metadata?: StorageUploadMetadata,
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }
  uploadResumable(
    _userId: string,
    _file: File,
    _options?: UploadOptions,
    _metadata?: StorageUploadMetadata,
  ): StorageUploadTask {
    throw new Error("Method not implemented.");
  }
  uploadExternalImage(
    _userId: string,
    _externalUrl: string,
    _folder?: string,
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getBytes(_url: string): Promise<Uint8Array> {
    throw new Error("Method not implemented.");
  }
  getDownloadUrl(_path: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  delete(_path: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  buildFilePath(
    _root: string,
    _userId: string,
    _folder: string,
    _fileName: string,
  ): string {
    throw new Error("Method not implemented.");
  }
}
