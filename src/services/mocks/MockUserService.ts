import type {
  UserProfile,
  SlugData,
  SlugAvailabilityResponse,
  SlugClaimResponse,
} from "@/types/UserProfile";
import type { IUserService } from "../interfaces/IUserService";

export class MockUserService implements IUserService {
  getUserProfile(userId: string): Promise<UserProfile | null> {
    throw new Error("Method not implemented.");
  }
  updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    throw new Error("Method not implemented.");
  }
  subscribeToUserProfile(
    userId: string,
    callback: (profile: UserProfile | null) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }
  recordLogin(userId: string, email: string | null): Promise<void> {
    throw new Error("Method not implemented.");
  }
  grantSupporterBadge(userId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getUserIdBySlug(slug: string): Promise<string | null> {
    throw new Error("Method not implemented.");
  }
  getSlugData(slug: string): Promise<SlugData | null> {
    throw new Error("Method not implemented.");
  }
  checkSlugAvailability(slug: string): Promise<SlugAvailabilityResponse> {
    throw new Error("Method not implemented.");
  }
  claimSlug(slug: string): Promise<SlugClaimResponse> {
    throw new Error("Method not implemented.");
  }
  setDefaultGrid(userId: string, gridId: string | null): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
