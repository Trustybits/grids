import type {
  StorageDao,
  StorageUploadMetadata,
  StorageUploadTask,
} from "@/dao/interfaces/StorageDao";

export class StubbedStorageDao implements StorageDao {
  public upload(
    _path: string,
    _data: Blob | File,
    _metadata?: StorageUploadMetadata,
  ): Promise<string> {
    throw new Error("Stubbed DAO implementation");
  }

  public uploadResumable(
    _path: string,
    _data: Blob | File,
    _metadata?: StorageUploadMetadata,
  ): StorageUploadTask {
    throw new Error("Stubbed DAO implementation");
  }

  public getDownloadUrl(_path: string): Promise<string> {
    throw new Error("Stubbed DAO implementation");
  }

  public delete(_path: string): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public buildUserPath(_userId: string, _folder: string, _fileName: string): string {
    throw new Error("Stubbed DAO implementation");
  }
}
