import type { UserGameDataDao } from "@/dao/interfaces/UserGameDataDao";

export class StubbedUserGameDataDao implements UserGameDataDao {
  public getById(_userId: string): Promise<Record<string, unknown> | null> {
    throw new Error("Stubbed DAO implementation");
  }

  public create(_userId: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public update(_userId: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public incrementFields(_userId: string, _fields: Record<string, number>): Promise<void> {
    throw new Error("Stubbed DAO implementation");
  }

  public incrementClicksTransaction(_userId: string, _amount: number): Promise<boolean> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribe(
    _userId: string,
    _callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }

  public getLeaderboard(_topN: number): Promise<Array<Record<string, unknown>>> {
    throw new Error("Stubbed DAO implementation");
  }

  public subscribeToLeaderboard(
    _topN: number,
    _callback: (entries: Array<Record<string, unknown>>) => void,
  ): () => void {
    throw new Error("Stubbed DAO implementation");
  }
}
