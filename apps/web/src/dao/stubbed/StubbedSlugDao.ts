import type { SlugDao } from "@/dao/interfaces/SlugDao";
import type {
  SlugAvailabilityResponse,
  SlugClaimResponse,
} from "@/types/UserProfile";

export class StubbedSlugDao implements SlugDao {
  public getBySlug(_slug: string): Promise<Record<string, unknown> | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public checkAvailability(
    _slug: string,
  ): Promise<SlugAvailabilityResponse> {
    throw new Error("Stubbed DAO implementation");
  }

  public claim(_slug: string): Promise<SlugClaimResponse> {
    throw new Error("Stubbed DAO implementation");
  }

  public updateDefaultGrid(_gridId: string | null): Promise<{ success: boolean }> {
    throw new Error("Stubbed DAO implementation");
  }
}
