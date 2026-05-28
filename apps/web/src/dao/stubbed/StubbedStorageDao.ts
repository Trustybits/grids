import type {
  StorageDao,
  StorageUploadMetadata,
  StorageUploadProgress,
  StorageUploadTask,
} from "@grids/contracts/dao";
import { memoryDatabase } from "./StubbedMemoryDatabase";

export class StubbedStorageDao implements StorageDao {
  public async upload(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): Promise<string> {
    return this.store(path, data, metadata);
  }

  public uploadResumable(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): StorageUploadTask {
    let canceled = false;
    const progressCallbacks = new Set<
      (progress: StorageUploadProgress) => void
    >();
    const done = new Promise<string>((resolve, reject) => {
      const finish = () => {
        if (canceled) {
          reject(new Error("Upload canceled"));
          return;
        }
        const progress = {
          bytesTransferred: data.size,
          totalBytes: data.size,
        };
        for (const callback of progressCallbacks) callback(progress);
        resolve(this.store(path, data, metadata));
      };
      if (typeof queueMicrotask === "function") {
        queueMicrotask(finish);
      } else {
        setTimeout(finish, 0);
      }
    });

    return {
      onProgress(callback: (progress: StorageUploadProgress) => void) {
        progressCallbacks.add(callback);
        callback({ bytesTransferred: 0, totalBytes: data.size });
        return () => progressCallbacks.delete(callback);
      },
      done() {
        return done;
      },
      cancel() {
        canceled = true;
      },
    };
  }

  public async getBytes(url: string): Promise<Uint8Array> {
    const path = memoryDatabase.storagePathByUrl.get(url) ?? url;
    const stored = memoryDatabase.storageByPath.get(path);
    if (stored) {
      return new Uint8Array(await stored.data.arrayBuffer());
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  public async getDownloadUrl(path: string): Promise<string> {
    const stored = memoryDatabase.storageByPath.get(path);
    return stored?.url ?? path;
  }

  public async delete(path: string): Promise<void> {
    const stored = memoryDatabase.storageByPath.get(path);
    if (stored && typeof URL !== "undefined" && "revokeObjectURL" in URL) {
      URL.revokeObjectURL(stored.url);
      memoryDatabase.storagePathByUrl.delete(stored.url);
    }
    memoryDatabase.storageByPath.delete(path);
  }

  public buildFilePath(
    root: string,
    userId: string,
    folder: string,
    fileName: string,
  ): string {
    return `${root}/${userId}/${folder}/${Date.now()}_${fileName}`;
  }

  private store(
    path: string,
    data: Blob | File,
    metadata?: StorageUploadMetadata,
  ): string {
    const existing = memoryDatabase.storageByPath.get(path);
    if (existing && typeof URL !== "undefined" && "revokeObjectURL" in URL) {
      URL.revokeObjectURL(existing.url);
      memoryDatabase.storagePathByUrl.delete(existing.url);
    }
    const url =
      typeof URL !== "undefined" && "createObjectURL" in URL
        ? URL.createObjectURL(data)
        : path;
    memoryDatabase.storageByPath.set(path, { data, metadata, url });
    memoryDatabase.storagePathByUrl.set(url, path);
    return url;
  }
}
