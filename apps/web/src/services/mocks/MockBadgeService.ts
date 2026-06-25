import type { UserBadges } from "@grids/contracts/types";
import type { BadgeServiceInterface } from "../interfaces/BadgeServiceInterface";

export class MockBadgeService implements BadgeServiceInterface {
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
