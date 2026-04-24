import type {
  DailyClickLimit,
  LeaderboardEntry,
  UserGameData,
} from "@/types/GameData";

export interface IGameDataService {
  getOrCreateUserGameData(userId: string): Promise<UserGameData>;
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
