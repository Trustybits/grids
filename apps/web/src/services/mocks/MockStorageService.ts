import type { StorageUploadMetadata } from "@grids/contracts/dao";
import type { StorageServiceInterface } from "../interfaces/StorageServiceInterface";
import type {
  ArchiveUploadResult,
  ArchiveUploadTask,
  UploadOptions,
} from "@/types/UploadFileTypes";
import { validateUploadFile } from "@/utils/UploadFileClassification";

export class MockStorageService implements StorageServiceInterface {
  validateFile(
    file: File,
    options: UploadOptions,
  ): { isImage: boolean; isVideo: boolean; isDocument: boolean } {
    return validateUploadFile(file, options);
  }
  uploadArchiveFile(
    _userId: string,
    _file: File,
    _options?: UploadOptions,
  ): Promise<ArchiveUploadResult> {
    throw new Error("Method not implemented.");
  }
  uploadArchiveResumable(
    _userId: string,
    _file: File,
    _options?: UploadOptions,
  ): ArchiveUploadTask {
    throw new Error("Method not implemented.");
  }
  uploadToPath(
    _path: string,
    _file: File,
    _metadata?: StorageUploadMetadata,
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }
  uploadExternalImageToArchive(
    _userId: string,
    _externalUrl: string,
  ): Promise<ArchiveUploadResult> {
    throw new Error("Method not implemented.");
  }
  getBytes(_url: string): Promise<Uint8Array> {
    throw new Error("Method not implemented.");
  }
  getDownloadUrl(_path: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  deleteArchiveUpload(_hash: string, _force?: boolean): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
