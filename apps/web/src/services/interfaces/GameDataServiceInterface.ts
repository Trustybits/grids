import type {
  DailyClickLimit,
  LeaderboardEntry,
  UserGameData,
} from "@grids/contracts/types";

export interface GameDataServiceInterface {
  getOrCreateUserGameData(userId: string): Promise<UserGameData>;
  /**
   * Read-only counterpart to `getOrCreateUserGameData`, for callers who are not
   * the record's owner. Creating `userGameData/{userId}` is gated on
   * `request.auth.uid == userId`, so a viewer must never take the create path
   * for someone else's record. Resolves `null` when none exists.
   */
  getUserGameData(userId: string): Promise<UserGameData | null>;
  checkDailyClickLimit(userId: string): Promise<DailyClickLimit>;
  incrementUserClicks(userId: string, amount: number): Promise<boolean>;
  subscribeToUserGameData(
    userId: string,
    callback: (data: UserGameData) => void,
  ): () => void;
  getLeaderboard(topN: number): Promise<LeaderboardEntry[]>;
  subscribeToLeaderboard(
    topN: number,
    callback: (leaderboard: LeaderboardEntry[]) => void,
  ): () => void;
  updateDisplayName(userId: string, displayName: string): Promise<void>;
  increasePassiveBoost(userId: string, boostAmount: number): Promise<void>;
  addPassiveClicks(userId: string, amount: number): Promise<void>;
  getDailyClickCap(): number;
  claimPassiveClicks(userId: string): Promise<number>;
}
