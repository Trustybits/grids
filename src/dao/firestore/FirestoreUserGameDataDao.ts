import type { Firestore } from "firebase/firestore";
import type { UserGameDataDao } from "../interfaces/UserGameDataDao";

export class FirestoreUserGameDataDao implements UserGameDataDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public getById(_userId: string): Promise<Record<string, unknown> | null> {
    throw new Error("FirestoreUserGameDataDao.getById not implemented");
  }

  public create(
    _userId: string,
    _data: Record<string, unknown>,
  ): Promise<void> {
    throw new Error("FirestoreUserGameDataDao.create not implemented");
  }

  public update(
    _userId: string,
    _data: Record<string, unknown>,
  ): Promise<void> {
    throw new Error("FirestoreUserGameDataDao.update not implemented");
  }

  public incrementClicksTransaction(
    _userId: string,
    _amount: number,
  ): Promise<boolean> {
    throw new Error(
      "FirestoreUserGameDataDao.incrementClicksTransaction not implemented",
    );
  }

  public subscribe(
    _userId: string,
    _callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    throw new Error("FirestoreUserGameDataDao.subscribe not implemented");
  }

  public getLeaderboard(
    _topN: number,
  ): Promise<Array<Record<string, unknown>>> {
    throw new Error("FirestoreUserGameDataDao.getLeaderboard not implemented");
  }

  public subscribeToLeaderboard(
    _topN: number,
    _callback: (entries: Array<Record<string, unknown>>) => void,
  ): () => void {
    throw new Error(
      "FirestoreUserGameDataDao.subscribeToLeaderboard not implemented",
    );
  }
}
