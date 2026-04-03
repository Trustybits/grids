import type { SlugDao } from "@/dao/interfaces/SlugDao";

export class StubbedSlugDao implements SlugDao {
  public getBySlug(_slug: string): Promise<Record<string, unknown> | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public checkAvailability(
    _slug: string,
  ): Promise<{ available: boolean; reason: string; message: string }> {
    throw new Error("Stubbed DAO implementation");
  }

  public claim(_slug: string): Promise<{ success: boolean; message: string }> {
    throw new Error("Stubbed DAO implementation");
  }

  public updateDefaultGrid(_gridId: string | null): Promise<{ success: boolean }> {
    throw new Error("Stubbed DAO implementation");
  }
}
