/**
 * Unit tests for FirebaseChatDao
 *
 * Covers:
 *  - subscribeToMessages: subcollection path + orderBy(createdAt asc), document
 *    mapping (id/text/createdAt/authorId), filtering of empty / non-string text,
 *    createdAt normalization (number, Timestamp-like toMillis, fallback to now),
 *    authorId dropped when not a string, error forwarding to onError,
 *    unsubscribe passthrough
 *  - addMessage: addDoc on the subcollection, returns the new doc id
 *  - updateMessage: doc path + updateDoc({ text })
 *  - deleteMessage: doc path + deleteDoc
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { FirebaseChatDao } from "../FirebaseChatDao.js";
import type { Firestore } from "firebase/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeDb = {} as Firestore;

function fakeQuerySnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirebaseChatDao", () => {
  let dao: FirebaseChatDao;

  beforeEach(() => {
    dao = new FirebaseChatDao(fakeDb);
  });

  // ── subscribeToMessages ───────────────────────────────────────────────────

  describe("subscribeToMessages", () => {
    function arrange(snapshotDocs: Array<{ id: string; data: Record<string, unknown> }>) {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(orderBy).mockReturnValue("orderByClause" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_q: any, onNext: any, _onError: any) => {
          onNext(fakeQuerySnapshot(snapshotDocs));
          return vi.fn();
        },
      );
    }

    it("queries the messages subcollection ordered by createdAt ascending", () => {
      arrange([]);
      const callback = vi.fn();

      dao.subscribeToMessages("grid-1", "tile-1", callback);

      expect(collection).toHaveBeenCalledWith(
        fakeDb,
        "grids",
        "grid-1",
        "tiles",
        "tile-1",
        "messages",
      );
      expect(orderBy).toHaveBeenCalledWith("createdAt", "asc");
      expect(query).toHaveBeenCalledWith("colRef", "orderByClause");
      expect(onSnapshot).toHaveBeenCalledWith(
        "queryRef",
        expect.any(Function),
        expect.any(Function),
      );
      expect(callback).toHaveBeenCalledWith([]);
    });

    it("maps documents to ChatMessage with id, text, createdAt, and authorId", () => {
      arrange([
        {
          id: "m1",
          data: { text: "hello", createdAt: 1000, authorId: "user-1" },
        },
      ]);
      const callback = vi.fn();

      dao.subscribeToMessages("grid-1", "tile-1", callback);

      expect(callback).toHaveBeenCalledWith([
        { id: "m1", text: "hello", createdAt: 1000, authorId: "user-1" },
      ]);
    });

    it("filters out messages with empty or non-string text", () => {
      arrange([
        { id: "empty", data: { text: "", createdAt: 1 } },
        { id: "numeric", data: { text: 42, createdAt: 2 } },
        { id: "missing", data: { createdAt: 3 } },
        { id: "ok", data: { text: "kept", createdAt: 4 } },
      ]);
      const callback = vi.fn();

      dao.subscribeToMessages("grid-1", "tile-1", callback);

      const messages = callback.mock.calls[0][0];
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("ok");
    });

    it("normalizes a Timestamp-like createdAt via toMillis()", () => {
      arrange([
        {
          id: "m1",
          data: { text: "hi", createdAt: { toMillis: () => 123456 } },
        },
      ]);
      const callback = vi.fn();

      dao.subscribeToMessages("grid-1", "tile-1", callback);

      expect(callback.mock.calls[0][0][0].createdAt).toBe(123456);
    });

    it("falls back to Date.now() when createdAt is missing or unrecognized", () => {
      vi.useFakeTimers();
      vi.setSystemTime(5_000_000);
      try {
        arrange([{ id: "m1", data: { text: "hi" } }]);
        const callback = vi.fn();

        dao.subscribeToMessages("grid-1", "tile-1", callback);

        expect(callback.mock.calls[0][0][0].createdAt).toBe(5_000_000);
      } finally {
        vi.useRealTimers();
      }
    });

    it("leaves authorId undefined when it is not a string", () => {
      arrange([{ id: "m1", data: { text: "hi", createdAt: 1, authorId: 99 } }]);
      const callback = vi.fn();

      dao.subscribeToMessages("grid-1", "tile-1", callback);

      expect(callback.mock.calls[0][0][0].authorId).toBeUndefined();
    });

    it("forwards snapshot errors to onError", () => {
      const error = new Error("permission denied");
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_q: any, _onNext: any, onErr: any) => {
          onErr(error);
          return vi.fn();
        },
      );
      const onError = vi.fn();

      dao.subscribeToMessages("grid-1", "tile-1", vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("does not throw on snapshot errors when no onError is provided", () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(onSnapshot).mockImplementation(
        (_q: any, _onNext: any, onErr: any) => {
          onErr(new Error("boom"));
          return vi.fn();
        },
      );

      expect(() =>
        dao.subscribeToMessages("grid-1", "tile-1", vi.fn()),
      ).not.toThrow();
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      const result = dao.subscribeToMessages("grid-1", "tile-1", vi.fn());

      expect(result).toBe(unsubFn);
    });
  });

  // ── addMessage ────────────────────────────────────────────────────────────

  describe("addMessage", () => {
    it("adds the message to the subcollection and returns the new doc id", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(addDoc).mockResolvedValue({ id: "new-msg" } as any);

      const message = { text: "hello", createdAt: 1000, authorId: "user-1" };
      const id = await dao.addMessage("grid-1", "tile-1", message);

      expect(collection).toHaveBeenCalledWith(
        fakeDb,
        "grids",
        "grid-1",
        "tiles",
        "tile-1",
        "messages",
      );
      expect(addDoc).toHaveBeenCalledWith("colRef", message);
      expect(id).toBe("new-msg");
    });

    it("propagates errors from addDoc", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(addDoc).mockRejectedValue(new Error("write failed"));

      await expect(
        dao.addMessage("grid-1", "tile-1", {
          text: "x",
          createdAt: 1,
          authorId: "u",
        }),
      ).rejects.toThrow("write failed");
    });
  });

  // ── updateMessage ─────────────────────────────────────────────────────────

  describe("updateMessage", () => {
    it("updates only the text field on the message document", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await dao.updateMessage("grid-1", "tile-1", "msg-1", "edited");

      expect(doc).toHaveBeenCalledWith(
        fakeDb,
        "grids",
        "grid-1",
        "tiles",
        "tile-1",
        "messages",
        "msg-1",
      );
      expect(updateDoc).toHaveBeenCalledWith("docRef", { text: "edited" });
    });
  });

  // ── deleteMessage ─────────────────────────────────────────────────────────

  describe("deleteMessage", () => {
    it("deletes the message document", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      await dao.deleteMessage("grid-1", "tile-1", "msg-1");

      expect(doc).toHaveBeenCalledWith(
        fakeDb,
        "grids",
        "grid-1",
        "tiles",
        "tile-1",
        "messages",
        "msg-1",
      );
      expect(deleteDoc).toHaveBeenCalledWith("docRef");
    });
  });

  // ── deleteAllMessages ─────────────────────────────────────────────────────

  describe("deleteAllMessages", () => {
    function fakeDeleteSnapshot(ids: string[]) {
      return {
        empty: ids.length === 0,
        docs: ids.map((id) => ({ ref: `ref-${id}` })),
      };
    }

    function arrangeBatch() {
      const batch = { delete: vi.fn(), commit: vi.fn() };
      vi.mocked(writeBatch).mockReturnValue(batch as any);
      return batch;
    }

    it("queries the tile's messages subcollection", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(getDocs).mockResolvedValue(fakeDeleteSnapshot([]) as any);

      await dao.deleteAllMessages("grid-1", "tile-1");

      expect(collection).toHaveBeenCalledWith(
        fakeDb,
        "grids",
        "grid-1",
        "tiles",
        "tile-1",
        "messages",
      );
      expect(getDocs).toHaveBeenCalledWith("colRef");
    });

    it("does nothing when the collection is empty", async () => {
      vi.mocked(getDocs).mockResolvedValue(fakeDeleteSnapshot([]) as any);

      await dao.deleteAllMessages("grid-1", "tile-1");

      expect(writeBatch).not.toHaveBeenCalled();
    });

    it("batch-deletes every message in a single batch", async () => {
      vi.mocked(getDocs).mockResolvedValue(
        fakeDeleteSnapshot(["a", "b", "c"]) as any,
      );
      const batch = arrangeBatch();

      await dao.deleteAllMessages("grid-1", "tile-1");

      expect(writeBatch).toHaveBeenCalledTimes(1);
      expect(batch.delete).toHaveBeenCalledTimes(3);
      expect(batch.delete).toHaveBeenCalledWith("ref-a");
      expect(batch.delete).toHaveBeenCalledWith("ref-b");
      expect(batch.delete).toHaveBeenCalledWith("ref-c");
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it("uses a single batch at exactly the 500-op limit", async () => {
      const ids = Array.from({ length: 500 }, (_, i) => `m${i}`);
      vi.mocked(getDocs).mockResolvedValue(fakeDeleteSnapshot(ids) as any);
      const batch = arrangeBatch();

      await dao.deleteAllMessages("grid-1", "tile-1");

      // 500 is the cap, not over it → exactly one batch.
      expect(writeBatch).toHaveBeenCalledTimes(1);
      expect(batch.delete).toHaveBeenCalledTimes(500);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it("opens a second batch one past the limit", async () => {
      const ids = Array.from({ length: 501 }, (_, i) => `m${i}`);
      vi.mocked(getDocs).mockResolvedValue(fakeDeleteSnapshot(ids) as any);
      const batch = arrangeBatch();

      await dao.deleteAllMessages("grid-1", "tile-1");

      expect(writeBatch).toHaveBeenCalledTimes(2);
      expect(batch.delete).toHaveBeenCalledTimes(501);
      expect(batch.commit).toHaveBeenCalledTimes(2);
    });

    it("chunks into multiple batches beyond the 500-op limit", async () => {
      const ids = Array.from({ length: 1001 }, (_, i) => `m${i}`);
      vi.mocked(getDocs).mockResolvedValue(fakeDeleteSnapshot(ids) as any);
      const batch = arrangeBatch();

      await dao.deleteAllMessages("grid-1", "tile-1");

      // 1001 docs → 500 + 500 + 1 = three batches.
      expect(writeBatch).toHaveBeenCalledTimes(3);
      expect(batch.delete).toHaveBeenCalledTimes(1001);
      expect(batch.commit).toHaveBeenCalledTimes(3);
    });

    it("propagates errors from getDocs", async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error("read failed"));

      await expect(
        dao.deleteAllMessages("grid-1", "tile-1"),
      ).rejects.toThrow("read failed");
      expect(writeBatch).not.toHaveBeenCalled();
    });

    it("propagates errors from batch.commit", async () => {
      vi.mocked(getDocs).mockResolvedValue(
        fakeDeleteSnapshot(["a", "b"]) as any,
      );
      vi.mocked(writeBatch).mockReturnValue({
        delete: vi.fn(),
        commit: vi.fn().mockRejectedValue(new Error("commit failed")),
      } as any);

      await expect(
        dao.deleteAllMessages("grid-1", "tile-1"),
      ).rejects.toThrow("commit failed");
    });
  });
});
