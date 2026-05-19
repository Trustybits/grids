import {
  type FirebaseStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  getBytes,
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
    return getDownloadURL(ref);
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
        return getDownloadURL(ref);
      },
      cancel() {
        task.cancel();
      },
    };
  }

  private static readonly STORAGE_V0_DOWNLOAD =
    /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/i;

  private objectPathFromDownloadUrl(url: string): string | null {
    const m = url.match(FirebaseStorageDao.STORAGE_V0_DOWNLOAD);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1].replace(/\+/g, " "));
    } catch {
      return null;
    }
  }

  public async getBytes(url: string): Promise<Uint8Array> {
    const objectPath = this.objectPathFromDownloadUrl(url);
    if (objectPath) {
      const bytes = await getBytes(storageRef(this.storage, objectPath));
      return new Uint8Array(bytes);
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  public async getDownloadUrl(path: string): Promise<string> {
    const ref = storageRef(this.storage, path);
    return getDownloadURL(ref);
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
