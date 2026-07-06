import {
  type FirebaseStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  getBytes,
} from "firebase/storage";
import type {
  StorageDao,
  StorageUploadMetadata,
  StorageUploadProgress,
  StorageUploadTask,
} from "@grids/contracts/dao";

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
}
