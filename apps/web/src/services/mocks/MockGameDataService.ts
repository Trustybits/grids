import type {
  UserGameData,
  DailyClickLimit,
  LeaderboardEntry,
} from "@grids/contracts/types";
import type { GameDataServiceInterface } from "../interfaces/GameDataServiceInterface";

export class MockGameDataService implements GameDataServiceInterface {
  getOrCreateUserGameData(_userId: string): Promise<UserGameData> {
    throw new Error("Method not implemented.");
  }
  getUserGameData(_userId: string): Promise<UserGameData | null> {
    throw new Error("Method not implemented.");
  }
  checkDailyClickLimit(_userId: string): Promise<DailyClickLimit> {
    throw new Error("Method not implemented.");
  }
  incrementUserClicks(_userId: string, _amount: number): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  subscribeToUserGameData(
    _userId: string,
    _callback: (data: UserGameData) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }
  getLeaderboard(_topN: number): Promise<LeaderboardEntry[]> {
    throw new Error("Method not implemented.");
  }
  subscribeToLeaderboard(
    _topN: number,
    _callback: (leaderboard: LeaderboardEntry[]) => void,
  ): () => void {
    throw new Error("Method not implemented.");
  }
  updateDisplayName(_userId: string, _displayName: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  increasePassiveBoost(_userId: string, _boostAmount: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  addPassiveClicks(_userId: string, _amount: number): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getDailyClickCap(): number {
    throw new Error("Method not implemented.");
  }
  claimPassiveClicks(_userId: string): Promise<number> {
    throw new Error("Method not implemented.");
  }
}
