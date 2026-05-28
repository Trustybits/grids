import { describe, it, expect, vi, beforeEach } from "vitest";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { FirestoreUserDao } from "../FirestoreUserDao.js";
import type { Firestore } from "firebase/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeDb = {} as Firestore;

/** Build a fake Firestore DocumentSnapshot. */
function fakeSnapshot(
  id: string,
  data: Record<string, unknown>,
  exists = true,
) {
  return {
    id,
    exists: () => exists,
    data: () => data,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirestoreUserDao", () => {
  let dao: FirestoreUserDao;

  beforeEach(() => {
    dao = new FirestoreUserDao(fakeDb);
  });

  // ── getById ──────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns user data when the document exists", async () => {
      const data = { displayName: "Alice", email: "alice@example.com" };

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot("user-1", data) as any);

      const result = await dao.getById("user-1");

      expect(doc).toHaveBeenCalledWith(fakeDb, "users", "user-1");
      expect(getDoc).toHaveBeenCalledWith("docRef");
      expect(result).toEqual(data);
    });

    it("returns null when the document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot("x", {}, false) as any);

      const result = await dao.getById("nonexistent");
      expect(result).toBeNull();
    });
  });

  // ── save ──────────────────────────────────────────────────────────────────

  describe("save", () => {
    it("calls setDoc with merge: true", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const data = { displayName: "Bob", plan: "pro" };
      await dao.save("user-1", data);

      expect(doc).toHaveBeenCalledWith(fakeDb, "users", "user-1");
      expect(setDoc).toHaveBeenCalledWith("docRef", data, { merge: true });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("calls updateDoc with the given data", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const data = { displayName: "Charlie" };
      await dao.update("user-1", data);

      expect(doc).toHaveBeenCalledWith(fakeDb, "users", "user-1");
      expect(updateDoc).toHaveBeenCalledWith("docRef", data);
    });
  });

  // ── subscribe ─────────────────────────────────────────────────────────────

  describe("subscribe", () => {
    it("calls onSnapshot and invokes callback with data when document exists", () => {
      const data = { displayName: "Alice", email: "alice@example.com" };
      const callback = vi.fn();

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockImplementation((_ref: any, handler: any) => {
        handler(fakeSnapshot("user-1", data));
        return vi.fn(); // unsubscribe
      });

      const unsubscribe = dao.subscribe("user-1", callback);

      expect(doc).toHaveBeenCalledWith(fakeDb, "users", "user-1");
      expect(onSnapshot).toHaveBeenCalledWith("docRef", expect.any(Function));
      expect(callback).toHaveBeenCalledWith(data);
      expect(typeof unsubscribe).toBe("function");
    });

    it("invokes callback with null when document does not exist", () => {
      const callback = vi.fn();

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockImplementation((_ref: any, handler: any) => {
        handler(fakeSnapshot("user-1", {}, false));
        return vi.fn();
      });

      dao.subscribe("user-1", callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it("returns the unsubscribe function from onSnapshot", () => {
      const unsubFn = vi.fn();

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(onSnapshot).mockReturnValue(unsubFn as any);

      const result = dao.subscribe("user-1", vi.fn());

      expect(result).toBe(unsubFn);
    });
  });
});
