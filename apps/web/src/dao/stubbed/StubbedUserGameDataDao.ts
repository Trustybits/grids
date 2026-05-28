import type {
  UserGameDataDao,
  UserGameDataInput,
} from "@grids/contracts/dao";
import type {
  LeaderboardEntry,
  UserGameData,
} from "@grids/contracts/types";

export class StubbedUserGameDataDao implements UserGameDataDao {
  public getById(_userId: string): Promise<UserGameData | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public create(_userId: string, _data: UserGameDataInput): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public update(_userId: string, _data: UserGameDataInput): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public incrementFields(
    _userId: string,
    _fields: Record<string, number>,
  ): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public incrementClicksTransaction(
    _userId: string,
    _amount: number,
  ): Promise<boolean> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribe(
    _userId: string,
    _callback: (data: UserGameData | null) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public getLeaderboard(_topN: number): Promise<LeaderboardEntry[]> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribeToLeaderboard(
    _topN: number,
    _callback: (entries: LeaderboardEntry[]) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }
}
