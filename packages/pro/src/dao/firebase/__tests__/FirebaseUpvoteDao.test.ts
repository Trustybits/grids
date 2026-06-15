/**
 * Unit tests for FirebaseUpvoteDao
 *
 * Covers:
 *  - subscribeToUserUpvotes: upvotes subcollection path, userId filter,
 *    mapping docs to a Set of notionPageIds (skipping docs without one),
 *    error forwarding to onError, unsubscribe passthrough
 *  - toggleUpvote: upvoteRoadmapItem callable, payload, unwrapped result
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { FirebaseUpvoteDao } from "../FirebaseUpvoteDao.js";
import type { Firestore } from "firebase/firestore";
import type { Functions } from "firebase/functions";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeDb = {} as Firestore;
const fakeFunctions = {} as Functions;

/** Build a fake QuerySnapshot supporting forEach. */
function fakeQuerySnapshot(docs: Array<Record<string, unknown>>) {
  const wrapped = docs.map((d) => ({ data: () => d }));
  return { forEach: (cb: (d: { data: () => unknown }) => void) => wrapped.forEach(cb) };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirebaseUpvoteDao", () => {
  let dao: FirebaseUpvoteDao;

  beforeEach(() => {
    dao = new FirebaseUpvoteDao(fakeDb, fakeFunctions);
  });

  // ── subscribeToUserUpvotes ────────────────────────────────────────────────

  describe("subscribeToUserUpvotes", () => {
    it("queries the tile's upvotes filtered by userId and maps notionPageIds to a Set", () => {
      const callback = vi.fn();
      vi.mocked(collection).mockReturnValue("upvotesRef" as any);
      vi.mocked(where).mockReturnValue("whereClause" as any);
      vi.mocked(query).mockReturnValue("myVotesQuery" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_q: any, onNext: any, _onErr: any) => {
          onNext(
            fakeQuerySnapshot([
              { userId: "user-1", notionPageId: "page-1" },
              { userId: "user-1", notionPageId: "page-2" },
            ]),
          );
          return vi.fn();
        },
      );

      dao.subscribeToUserUpvotes("grid-1", "tile-1", "user-1", callback);

      expect(collection).toHaveBeenCalledWith(
        fakeDb,
        "grids",
        "grid-1",
        "tiles",
        "tile-1",
        "upvotes",
      );
      expect(where).toHaveBeenCalledWith("userId", "==", "user-1");
      expect(query).toHaveBeenCalledWith("upvotesRef", "whereClause");
      expect(callback).toHaveBeenCalledWith(new Set(["page-1", "page-2"]));
    });

    it("skips documents without a notionPageId", () => {
      const callback = vi.fn();
      vi.mocked(collection).mockReturnValue("upvotesRef" as any);
      vi.mocked(query).mockReturnValue("myVotesQuery" as any);
      vi.mocked(onSnapshot).mockImplementation((_q: any, onNext: any) => {
        onNext(
          fakeQuerySnapshot([
            { userId: "user-1" },
            { userId: "user-1", notionPageId: "page-1" },
          ]),
        );
        return vi.fn();
      });

      dao.subscribeToUserUpvotes("grid-1", "tile-1", "user-1", callback);

      expect(callback).toHaveBeenCalledWith(new Set(["page-1"]));
    });

    it("passes an empty Set when there are no upvotes", () => {
      const callback = vi.fn();
      vi.mocked(collection).mockReturnValue("upvotesRef" as any);
      vi.mocked(query).mockReturnValue("myVotesQuery" as any);
      vi.mocked(onSnapshot).mockImplementation((_q: any, onNext: any) => {
        onNext(fakeQuerySnapshot([]));
        return vi.fn();
      });

      dao.subscribeToUserUpvotes("grid-1", "tile-1", "user-1", callback);

      expect(callback).toHaveBeenCalledWith(new Set());
    });

    it("forwards snapshot errors to onError", () => {
      const error = new Error("permission denied");
      vi.mocked(collection).mockReturnValue("upvotesRef" as any);
      vi.mocked(query).mockReturnValue("myVotesQuery" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_q: any, _onNext: any, onErr: any) => {
          onErr(error);
          return vi.fn();
        },
      );
      const onError = vi.fn();

      dao.subscribeToUserUpvotes("g", "t", "u", vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("does not throw on snapshot errors when no onError is provided", () => {
      vi.mocked(collection).mockReturnValue("upvotesRef" as any);
      vi.mocked(query).mockReturnValue("myVotesQuery" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_q: any, _onNext: any, onErr: any) => {
          onErr(new Error("boom"));
          return vi.fn();
        },
      );

      expect(() =>
        dao.subscribeToUserUpvotes("g", "t", "u", vi.fn()),
      ).not.toThrow();
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();
      vi.mocked(collection).mockReturnValue("upvotesRef" as any);
      vi.mocked(query).mockReturnValue("myVotesQuery" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      const result = dao.subscribeToUserUpvotes("g", "t", "u", vi.fn());

      expect(result).toBe(unsubFn);
    });
  });

  // ── toggleUpvote ──────────────────────────────────────────────────────────

  describe("toggleUpvote", () => {
    it("calls the upvoteRoadmapItem callable and returns its data", async () => {
      const callable = vi
        .fn()
        .mockResolvedValue({ data: { isNowUpvoted: true } });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const result = await dao.toggleUpvote("grid-1", "tile-1", "page-1");

      expect(httpsCallable).toHaveBeenCalledWith(
        fakeFunctions,
        "upvoteRoadmapItem",
      );
      expect(callable).toHaveBeenCalledWith({
        gridId: "grid-1",
        tileId: "tile-1",
        notionPageId: "page-1",
      });
      expect(result).toEqual({ isNowUpvoted: true });
    });

    it("propagates callable errors", async () => {
      const callable = vi.fn().mockRejectedValue(new Error("unauthenticated"));
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await expect(dao.toggleUpvote("g", "t", "p")).rejects.toThrow(
        "unauthenticated",
      );
    });
  });
});
