import type {
  UserProfile,
  SlugData,
  SlugAvailabilityResponse,
  SlugClaimResponse,
} from "@/types/UserProfile";
import type { IUserService } from "../interfaces/IUserService";

export class MockUserService implements IUserService {
  getUserProfile(_userId: string): Promise<UserProfile | null> {
    throw new Error("Method not implemented.");
  }
  updateUserProfile(_userId: string, _data: Partial<UserProfile>): Promise<void> {
    throw new Error("Method not implemented.");
  }
  subscribeToUserProfile(
    _userId: string,
    _callback: (profile: UserProfile | null) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }
  recordLogin(_userId: string, _email: string | null): Promise<void> {
    throw new Error("Method not implemented.");
  }
  grantSupporterBadge(_userId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getUserIdBySlug(_slug: string): Promise<string | null> {
    throw new Error("Method not implemented.");
  }
  getSlugData(_slug: string): Promise<SlugData | null> {
    throw new Error("Method not implemented.");
  }
  checkSlugAvailability(_slug: string): Promise<SlugAvailabilityResponse> {
    throw new Error("Method not implemented.");
  }
  claimSlug(_slug: string): Promise<SlugClaimResponse> {
    throw new Error("Method not implemented.");
  }
  setDefaultGrid(_userId: string, _gridId: string | null): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
