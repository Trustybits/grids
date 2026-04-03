import type { SlugDao } from "../interfaces/SlugDao";

export class FirestoreSlugDao implements SlugDao {
  public getBySlug(_slug: string): Promise<Record<string, unknown> | null> {
    throw new Error("FirestoreSlugDao.getBySlug not implemented");
  }

  public checkAvailability(
    _slug: string,
  ): Promise<{ available: boolean; reason: string; message: string }> {
    throw new Error("FirestoreSlugDao.checkAvailability not implemented");
  }

  public claim(_slug: string): Promise<{ success: boolean; message: string }> {
    throw new Error("FirestoreSlugDao.claim not implemented");
  }

  public updateDefaultGrid(
    _gridId: string | null,
  ): Promise<{ success: boolean }> {
    throw new Error("FirestoreSlugDao.updateDefaultGrid not implemented");
  }
}
