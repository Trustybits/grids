// Shared helpers for the stubbed DAO tests. Not a *.test.ts file, so Vitest
// does not collect it as a suite. The stubbed DAOs all read and write the
// module-level `memoryDatabase` singleton, so every test must reset that shared
// state before it runs to stay isolated from sibling tests.
import { memoryDatabase } from "../StubbedMemoryDatabase";

/**
 * Clear every collection on the shared in-memory database back to its empty
 * initial state. `idCounter` inside StubbedMemoryDatabase is module-private and
 * cannot be reset, but `createId` mixes it with `Date.now()` so generated IDs
 * remain unique across tests regardless.
 */
export function resetMemoryDatabase(): void {
  memoryDatabase.analyticsEvents.length = 0;
  memoryDatabase.badges.clear();
  memoryDatabase.businessDailyStats.clear();
  memoryDatabase.businessStats = null;
  memoryDatabase.checkoutSessions.clear();
  memoryDatabase.gridDailyStats.clear();
  memoryDatabase.gridStats.clear();
  memoryDatabase.grids.clear();
  memoryDatabase.messages.clear();
  memoryDatabase.payments.clear();
  memoryDatabase.slugs.clear();
  memoryDatabase.storageByPath.clear();
  memoryDatabase.storagePathByUrl.clear();
  memoryDatabase.subscriptions.clear();
  memoryDatabase.upvotes.clear();
  memoryDatabase.userGameData.clear();
  memoryDatabase.users.clear();
}

/**
 * Flush the microtask queue. The stub's pub/sub layer (`subscribeToValue` /
 * `emit`) delivers snapshots via `queueMicrotask`, so subscriber callbacks fire
 * asynchronously. Awaiting a freshly-queued microtask drains everything queued
 * before it (FIFO), letting tests observe delivered values.
 */
export function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}
