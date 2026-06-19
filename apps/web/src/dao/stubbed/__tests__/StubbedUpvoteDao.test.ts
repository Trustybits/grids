// Unit tests for StubbedUpvoteDao — toggleUpvote flips a notion page id in the
// per-user vote set (keyed by grid/tile/user) and reports the new state;
// subscribeToUserUpvotes delivers the current vote set. The AuthProvider
// singleton is mocked to supply the current user id.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StubbedUpvoteDao } from "../StubbedUpvoteDao";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import type { AuthProvider } from "@grids/contracts/auth";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

const GRID = "grid-1";
const TILE = "tile-1";
const PAGE = "page-1";

let dao: StubbedUpvoteDao;

function registerUser(id: string | null): void {
  registerAuthProvider({
    getCurrentUserId: vi.fn(() => id),
  } as unknown as AuthProvider);
}

beforeEach(() => {
  resetMemoryDatabase();
  registerUser("user-1");
  dao = new StubbedUpvoteDao();
});

describe("StubbedUpvoteDao.toggleUpvote", () => {
  it("adds an upvote and reports it as now upvoted", async () => {
    const result = await dao.toggleUpvote(GRID, TILE, PAGE);

    expect(result).toEqual({ isNowUpvoted: true });
    const stored = memoryDatabase.upvotes.get(`${GRID}/${TILE}/user-1`);
    expect(stored?.has(PAGE)).toBe(true);
  });

  it("removes an existing upvote on a second toggle", async () => {
    await dao.toggleUpvote(GRID, TILE, PAGE);
    const result = await dao.toggleUpvote(GRID, TILE, PAGE);

    expect(result).toEqual({ isNowUpvoted: false });
    expect(
      memoryDatabase.upvotes.get(`${GRID}/${TILE}/user-1`)?.has(PAGE),
    ).toBe(false);
  });

  it("tracks multiple pages independently within the same key", async () => {
    await dao.toggleUpvote(GRID, TILE, "page-1");
    await dao.toggleUpvote(GRID, TILE, "page-2");

    const stored = memoryDatabase.upvotes.get(`${GRID}/${TILE}/user-1`);
    expect([...(stored ?? [])].sort()).toEqual(["page-1", "page-2"]);
  });

  it("keys votes by the anonymous 'visitor' id when unauthenticated", async () => {
    registerUser(null);
    await dao.toggleUpvote(GRID, TILE, PAGE);

    expect(
      memoryDatabase.upvotes.get(`${GRID}/${TILE}/visitor`)?.has(PAGE),
    ).toBe(true);
  });
});

describe("StubbedUpvoteDao.subscribeToUserUpvotes", () => {
  it("delivers an empty set when the user has no votes", async () => {
    const callback = vi.fn();
    dao.subscribeToUserUpvotes(GRID, TILE, "user-1", callback);
    await flushMicrotasks();

    const delivered = callback.mock.calls[0][0];
    expect(delivered).toBeInstanceOf(Set);
    expect(delivered.size).toBe(0);
  });

  it("delivers the current vote set and live updates", async () => {
    const callback = vi.fn();
    dao.subscribeToUserUpvotes(GRID, TILE, "user-1", callback);
    await flushMicrotasks();

    await dao.toggleUpvote(GRID, TILE, PAGE);
    await flushMicrotasks();

    const delivered = callback.mock.calls.at(-1)?.[0];
    expect([...delivered]).toEqual([PAGE]);
  });

  it("stops delivering after unsubscribe", async () => {
    const callback = vi.fn();
    const unsubscribe = dao.subscribeToUserUpvotes(
      GRID,
      TILE,
      "user-1",
      callback,
    );
    await flushMicrotasks();
    callback.mockClear();

    unsubscribe();
    await dao.toggleUpvote(GRID, TILE, PAGE);
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });
});
