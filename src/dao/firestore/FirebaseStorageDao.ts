import {
  type FirebaseStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import type {
  StorageDao,
  StorageUploadMetadata,
  StorageUploadProgress,
  StorageUploadTask,
} from "../interfaces/StorageDao";

export class FirebaseStorageDao implements StorageDao {
  private storage: FirebaseStorage;

  public constructor(storage: FirebaseStorage) {
    this.storage = storage;
  }

  public async upload(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): Promise<string> {
    const ref = storageRef(this.storage, path);
    await uploadBytes(ref, data, metadata);
    return await getDownloadURL(ref);
  }

  public uploadResumable(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask {
    const ref = storageRef(this.storage, path);
    const task = uploadBytesResumable(ref, data, metadata);

    return {
      onProgress(callback: (progress: StorageUploadProgress) => void) {
        return task.on("state_changed", (snapshot) => {
          callback({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
          });
        });
      },
      async done() {
        await task;
        return await getDownloadURL(ref);
      },
      cancel() {
        task.cancel();
      },
    };
  }

  public async getDownloadUrl(path: string): Promise<string> {
    const ref = storageRef(this.storage, path);
    return await getDownloadURL(ref);
  }

  public async delete(path: string): Promise<void> {
    const ref = storageRef(this.storage, path);
    await deleteObject(ref);
  }

  public buildFilePath(
    root: string,
    userId: string,
    folder: string,
    fileName: string,
  ): string {
    return `${root}/${userId}/${folder}/${Date.now()}_${fileName}`;
  }
}
