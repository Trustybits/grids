import type { UploadArchiveDocument } from "../types/Storage.js";

/**
 * Read access to a user's upload archive index at `users/{uid}/uploads/{hash}`.
 *
 * Archive documents are written only by server code (Cloud Functions). Clients
 * may read their own archive to observe upload finalization (pending → active,
 * or → failed on a server-side hash mismatch) and, later, to render the File
 * Archive UI.
 */
export interface UploadArchiveDao {
  /**
   * Subscribe to a single upload archive document.
   *
   * The callback is invoked with the current document immediately and again on
   * every change, or with `null` when the document does not (yet) exist.
   * Returns an unsubscribe function.
   */
  subscribeUploadStatus(
    uid: string,
    hash: string,
    callback: (doc: UploadArchiveDocument | null) => void,
  ): () => void;

  /**
   * Read every archive document under `users/{uid}/uploads`. Used by the File
   * Archive UI to render the owner's uploads (display name, size, refCount,
   * shareable state, timestamps). Read-only: archive documents are written only
   * by server code.
   */
  listUploads(uid: string): Promise<UploadArchiveDocument[]>;

  /**
   * Read a single archive document at `users/{uid}/uploads/{hash}`, or `null`
   * when it does not exist. Used to check a file's `shareable` state (e.g. to
   * gate a tile's download affordance).
   */
  getUpload(uid: string, hash: string): Promise<UploadArchiveDocument | null>;
}
