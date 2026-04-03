import type { Firestore } from "firebase/firestore";
import type { Layout } from "@/types/Layout";
import type { LayoutDao } from "../interfaces/LayoutDao";

export class FirestoreLayoutDao implements LayoutDao {
  private db: Firestore;

  public constructor(db: Firestore) {
    this.db = db;
  }

  public getById(_id: string): Promise<Layout | null> {
    throw new Error("FirestoreLayoutDao.getById not implemented");
  }

  public findByUserId(_userId: string): Promise<Layout[]> {
    throw new Error("FirestoreLayoutDao.findByUserId not implemented");
  }

  public generateId(): string {
    throw new Error("FirestoreLayoutDao.generateId not implemented");
  }

  public save(_id: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("FirestoreLayoutDao.save not implemented");
  }

  public update(_id: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("FirestoreLayoutDao.update not implemented");
  }

  public updateLastOpenedAt(_id: string): Promise<void> {
    throw new Error("FirestoreLayoutDao.updateLastOpenedAt not implemented");
  }

  public delete(_id: string): Promise<void> {
    throw new Error("FirestoreLayoutDao.delete not implemented");
  }
}
