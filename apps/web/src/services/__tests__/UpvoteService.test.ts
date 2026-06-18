// Unit tests for UpvoteService — UpvoteDao is mocked via the DAO factory
// singleton. This service is a thin pass-through to the DAO.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpvoteService } from "@/services/UpvoteService";
import type { UpvoteDao } from "@grids/contracts/dao";
import { registerTestDaoFactory } from "./testHelpers";

let mockUpvoteDao: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  mockUpvoteDao = {
    subscribeToUserUpvotes: vi.fn(),
    toggleUpvote: vi.fn(),
  };

  registerTestDaoFactory({
    getUpvoteDao: () => mockUpvoteDao as unknown as UpvoteDao,
  });
});

describe("constructor", () => {
  it("resolves the UpvoteDao from the factory", () => {
    const getUpvoteDao = vi.fn(() => mockUpvoteDao as unknown as UpvoteDao);
    registerTestDaoFactory({
      getUpvoteDao,
    });

    new UpvoteService();

    expect(getUpvoteDao).toHaveBeenCalledTimes(1);
  });
});

describe("subscribeToUserUpvotes", () => {
  it("delegates all arguments and returns the unsubscribe fn", () => {
    const unsub = vi.fn();
    mockUpvoteDao.subscribeToUserUpvotes.mockReturnValueOnce(unsub);
    const callback = vi.fn();
    const onError = vi.fn();

    const service = new UpvoteService();
    const result = service.subscribeToUserUpvotes(
      "g1",
      "t1",
      "u1",
      callback,
      onError,
    );

    expect(mockUpvoteDao.subscribeToUserUpvotes).toHaveBeenCalledWith(
      "g1",
      "t1",
      "u1",
      callback,
      onError,
    );
    expect(result).toBe(unsub);
  });

  it("passes undefined onError through when omitted", () => {
    mockUpvoteDao.subscribeToUserUpvotes.mockReturnValueOnce(vi.fn());
    const callback = vi.fn();

    const service = new UpvoteService();
    service.subscribeToUserUpvotes("g1", "t1", "u1", callback);

    expect(mockUpvoteDao.subscribeToUserUpvotes).toHaveBeenCalledWith(
      "g1",
      "t1",
      "u1",
      callback,
      undefined,
    );
  });

  it("forwards the voted page id set to the callback", () => {
    const votes = new Set(["page-1", "page-2"]);
    mockUpvoteDao.subscribeToUserUpvotes.mockImplementation(
      (_g, _t, _u, cb: (s: Set<string>) => void) => {
        cb(votes);
        return vi.fn();
      },
    );
    const callback = vi.fn();

    const service = new UpvoteService();
    service.subscribeToUserUpvotes("g1", "t1", "u1", callback);

    expect(callback).toHaveBeenCalledWith(votes);
  });
});

describe("toggleUpvote", () => {
  it("delegates to upvoteDao.toggleUpvote and returns its result", async () => {
    mockUpvoteDao.toggleUpvote.mockResolvedValueOnce({ isNowUpvoted: true });

    const service = new UpvoteService();
    const result = await service.toggleUpvote("g1", "t1", "page-1");

    expect(mockUpvoteDao.toggleUpvote).toHaveBeenCalledWith("g1", "t1", "page-1");
    expect(result).toEqual({ isNowUpvoted: true });
  });

  it("returns isNowUpvoted false when toggled off", async () => {
    mockUpvoteDao.toggleUpvote.mockResolvedValueOnce({ isNowUpvoted: false });

    const service = new UpvoteService();
    const result = await service.toggleUpvote("g1", "t1", "page-1");

    expect(result).toEqual({ isNowUpvoted: false });
  });

  it("propagates errors from the DAO", async () => {
    mockUpvoteDao.toggleUpvote.mockRejectedValueOnce(new Error("vote failed"));

    const service = new UpvoteService();
    await expect(service.toggleUpvote("g1", "t1", "page-1")).rejects.toThrow(
      "vote failed",
    );
  });
});
