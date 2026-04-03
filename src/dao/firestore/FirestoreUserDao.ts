import type { Firestore } from "firebase/firestore";
import type { UserDao } from "../interfaces/UserDao";

export class FirestoreUserDao implements UserDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public getById(_userId: string): Promise<Record<string, unknown> | null> {
    throw new Error("FirestoreUserDao.getById not implemented");
  }

  public save(_userId: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("FirestoreUserDao.save not implemented");
  }

  public update(
    _userId: string,
    _data: Record<string, unknown>,
  ): Promise<void> {
    throw new Error("FirestoreUserDao.update not implemented");
  }

  public subscribe(
    _userId: string,
    _callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    throw new Error("FirestoreUserDao.subscribe not implemented");
  }
}
