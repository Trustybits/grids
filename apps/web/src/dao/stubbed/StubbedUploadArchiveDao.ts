import type { UploadArchiveDao } from "@grids/contracts/dao";
import type { UploadArchiveDocument } from "@grids/contracts/types";

/**
 * Local-memory stand-in for the upload archive index. There is no server
 * finalize trigger in stub mode, so a subscription resolves immediately to an
 * `active` document. The consuming service falls back to the URL returned by
 * the stubbed storage upload because this document carries no `url`.
 */
export class StubbedUploadArchiveDao implements UploadArchiveDao {
  public subscribeUploadStatus(
    uid: string,
    hash: string,
    callback: (doc: UploadArchiveDocument | null) => void,
  ): () => void {
    let cancelled = false;
    const emit = () => {
      if (cancelled) return;
      callback({
        uid,
        hash,
        kind: "images",
        path: `users/${uid}/images/${hash}`,
        size: 0,
        contentType: "application/octet-stream",
        ext: "bin",
        status: "active",
        refCount: 0,
        shareable: false,
      });
    };
    if (typeof queueMicrotask === "function") {
      queueMicrotask(emit);
    } else {
      setTimeout(emit, 0);
    }
    return () => {
      cancelled = true;
    };
  }

  /**
   * Local mode has no server-written archive index, so there are no uploads to
   * list. The File Archive UI renders an empty state against the stub.
   */
  public listUploads(_uid: string): Promise<UploadArchiveDocument[]> {
    return Promise.resolve([]);
  }

  /** Local mode has no server-written archive index. */
  public getUpload(
    _uid: string,
    _hash: string,
  ): Promise<UploadArchiveDocument | null> {
    return Promise.resolve(null);
  }
}
