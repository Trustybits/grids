import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { FirebaseGridDao } from "../FirebaseGridDao.js";
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

/** Build a fake Firestore QuerySnapshot with an array of docs. */
function fakeQuerySnapshot(docs: ReturnType<typeof fakeSnapshot>[]) {
  return { docs };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirebaseGridDao", () => {
  let dao: FirebaseGridDao;

  beforeEach(() => {
    dao = new FirebaseGridDao(fakeDb);
  });

  // ── getById ──────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns the mapped grid when the document exists", async () => {
      const data = {
        userId: "u1",
        name: "My Grid",
        colNum: 6,
        verticalCompact: false,
        tiles: [{ id: "t1" }],
        backgroundImageSrc: "https://img.png",
        backgroundEmbed: true,
        themeId: "dark",
        duplicatable: true,
        createdAt: null,
        updatedAt: null,
        lastOpenedAt: null,
      };

      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot("grid-1", data) as any);

      const result = await dao.getById("grid-1");

      expect(doc).toHaveBeenCalledWith(fakeDb, "grids", "grid-1");
      expect(getDoc).toHaveBeenCalledWith("docRef");
      expect(result).toEqual({
        id: "grid-1",
        userId: "u1",
        name: "My Grid",
        colNum: 6,
        verticalCompact: false,
        tiles: [{ id: "t1" }],
        backgroundImageSrc: "https://img.png",
        backgroundEmbed: true,
        backgroundColor: "",
        themeId: "dark",
        overrides: undefined,
        duplicatable: true,
        createdAt: null,
        updatedAt: null,
        lastOpenedAt: null,
      });
    });

    it("returns null when the document does not exist", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(getDoc).mockResolvedValue(fakeSnapshot("x", {}, false) as any);

      const result = await dao.getById("nonexistent");
      expect(result).toBeNull();
    });
  });

  // ── findByUserId ─────────────────────────────────────────────────────────

  describe("findByUserId", () => {
    it("returns mapped grids for the given user", async () => {
      const docs = [
        fakeSnapshot("l1", { userId: "u1", name: "A", tiles: [] }),
        fakeSnapshot("l2", { userId: "u1", name: "B", tiles: [] }),
      ];

      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(where).mockReturnValue("whereClause" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(fakeQuerySnapshot(docs) as any);

      const result = await dao.findByUserId("u1");

      expect(collection).toHaveBeenCalledWith(fakeDb, "grids");
      expect(where).toHaveBeenCalledWith("userId", "==", "u1");
      expect(query).toHaveBeenCalledWith("colRef", "whereClause");
      expect(getDocs).toHaveBeenCalledWith("queryRef");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("l1");
      expect(result[1].id).toBe("l2");
    });

    it("returns an empty array when no grids exist for the user", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(where).mockReturnValue("whereClause" as any);
      vi.mocked(query).mockReturnValue("queryRef" as any);
      vi.mocked(getDocs).mockResolvedValue(fakeQuerySnapshot([]) as any);

      const result = await dao.findByUserId("nobody");
      expect(result).toEqual([]);
    });
  });

  // ── generateId ───────────────────────────────────────────────────────────

  describe("generateId", () => {
    it("returns the id from a new document reference", () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(doc).mockReturnValue({ id: "generated-id" } as any);

      const id = dao.generateId();

      expect(collection).toHaveBeenCalledWith(fakeDb, "grids");
      expect(doc).toHaveBeenCalledWith("colRef");
      expect(id).toBe("generated-id");
    });
  });

  // ── save ──────────────────────────────────────────────────────────────────

  describe("save", () => {
    it("calls setDoc with merge: true", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      const data = { name: "Updated", tiles: [] };
      await dao.save("grid-1", data);

      expect(doc).toHaveBeenCalledWith(fakeDb, "grids", "grid-1");
      expect(setDoc).toHaveBeenCalledWith("docRef", data, { merge: true });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("calls updateDoc with the given data", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      const data = { name: "Renamed" };
      await dao.update("grid-1", data);

      expect(doc).toHaveBeenCalledWith(fakeDb, "grids", "grid-1");
      expect(updateDoc).toHaveBeenCalledWith("docRef", data);
    });
  });

  // ── updateLastOpenedAt ────────────────────────────────────────────────────

  describe("updateLastOpenedAt", () => {
    it("calls updateDoc with a serverTimestamp for lastOpenedAt", async () => {
      const fakeTimestamp = new Date();
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(serverTimestamp).mockReturnValue(fakeTimestamp as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await dao.updateLastOpenedAt("grid-1");

      expect(doc).toHaveBeenCalledWith(fakeDb, "grids", "grid-1");
      expect(serverTimestamp).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith("docRef", {
        lastOpenedAt: fakeTimestamp,
      });
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("calls deleteDoc with the correct document reference", async () => {
      vi.mocked(doc).mockReturnValue("docRef" as any);
      vi.mocked(deleteDoc).mockResolvedValue(undefined);

      await dao.delete("grid-1");

      expect(doc).toHaveBeenCalledWith(fakeDb, "grids", "grid-1");
      expect(deleteDoc).toHaveBeenCalledWith("docRef");
    });
  });
});
