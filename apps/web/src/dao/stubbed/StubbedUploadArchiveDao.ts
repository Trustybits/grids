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
}
