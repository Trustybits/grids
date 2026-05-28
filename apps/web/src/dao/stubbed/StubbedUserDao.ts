import type { UserDao } from "@grids/contracts/dao";
import {
  channel,
  cloneValue,
  emit,
  memoryDatabase,
  mergeRecord,
  subscribeToValue,
} from "./StubbedMemoryDatabase";

export class StubbedUserDao implements UserDao {
  public async getById(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const user = memoryDatabase.users.get(userId);
    return user ? cloneValue(user) : null;
  }

  public async save(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    memoryDatabase.users.set(
      userId,
      mergeRecord(memoryDatabase.users.get(userId), data),
    );
    emit(channel("user", userId));
  }

  public async update(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    memoryDatabase.users.set(
      userId,
      mergeRecord(memoryDatabase.users.get(userId), data),
    );
    emit(channel("user", userId));
  }

  public subscribe(
    userId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void {
    return subscribeToValue(
      channel("user", userId),
      () => memoryDatabase.users.get(userId) ?? null,
      callback,
    );
  }
}
