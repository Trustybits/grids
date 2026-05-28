import type { UserBadges } from "@grids/contracts/types";
import type { IBadgeService } from "../interfaces/IBadgeService";

export class MockBadgeService implements IBadgeService {
  getBadges(_userId: string): Promise<UserBadges | null> {
    throw new Error("Method not implemented.");
  }

  subscribeToBadges(
    _userId: string,
    _callback: (badges: UserBadges | null) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }
}
