import { type Firestore, doc, onSnapshot } from "firebase/firestore";
import type { UploadArchiveDao } from "@grids/contracts/dao";
import type { UploadArchiveDocument } from "@grids/contracts/types";

const USERS_COLLECTION = "users";
const UPLOADS_COLLECTION = "uploads";

export class FirebaseUploadArchiveDao implements UploadArchiveDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public subscribeUploadStatus(
    uid: string,
    hash: string,
    callback: (doc: UploadArchiveDocument | null) => void,
  ): () => void {
    const docRef = doc(
      this.db,
      USERS_COLLECTION,
      uid,
      UPLOADS_COLLECTION,
      hash,
    );
    return onSnapshot(
      docRef,
      (snapshot) => {
        callback(
          snapshot.exists()
            ? (snapshot.data() as UploadArchiveDocument)
            : null,
        );
      },
      () => {
        // Surface listener errors (e.g. permission changes) as "no document"
        // so callers fall back to their timeout instead of hanging.
        callback(null);
      },
    );
  }
}
