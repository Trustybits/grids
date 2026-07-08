/**
 * Unit tests for FirebaseStorageDao
 *
 * Covers:
 *  - upload: uploadBytes then download URL
 *  - uploadResumable: progress mapping via task.on("state_changed"), done()
 *    resolves to the download URL, cancel() forwards to the task
 *  - getBytes: Firebase v0 download URLs go through the SDK (with percent
 *    decoding and "+" → space), non-Firebase URLs and undecodable paths fall
 *    back to fetch; non-ok fetch responses throw `HTTP {status}`
 *  - getDownloadUrl: ref + SDK call passthrough
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  getBytes,
} from "firebase/storage";
import { FirebaseStorageDao } from "../FirebaseStorageDao.js";
import type { FirebaseStorage } from "firebase/storage";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeStorage = {} as FirebaseStorage;
const fakeBlob = { size: 3 } as unknown as Blob;

describe("FirebaseStorageDao", () => {
  let dao: FirebaseStorageDao;

  beforeEach(() => {
    dao = new FirebaseStorageDao(fakeStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── upload ────────────────────────────────────────────────────────────────

  describe("upload", () => {
    it("uploads the bytes with metadata and resolves to the download URL", async () => {
      vi.mocked(storageRef).mockReturnValue("ref" as any);
      vi.mocked(uploadBytes).mockResolvedValue({} as any);
      vi.mocked(getDownloadURL).mockResolvedValue("https://cdn/file.png");

      const metadata = { contentType: "image/png" };
      const url = await dao.upload("avatars/u1.png", fakeBlob, metadata);

      expect(storageRef).toHaveBeenCalledWith(fakeStorage, "avatars/u1.png");
      expect(uploadBytes).toHaveBeenCalledWith("ref", fakeBlob, metadata);
      expect(getDownloadURL).toHaveBeenCalledWith("ref");
      expect(url).toBe("https://cdn/file.png");
    });

    it("propagates upload errors and does not request a download URL", async () => {
      vi.mocked(storageRef).mockReturnValue("ref" as any);
      vi.mocked(uploadBytes).mockRejectedValue(new Error("quota exceeded"));

      await expect(dao.upload("p", fakeBlob)).rejects.toThrow("quota exceeded");
      expect(getDownloadURL).not.toHaveBeenCalled();
    });
  });

  // ── uploadResumable ───────────────────────────────────────────────────────

  describe("uploadResumable", () => {
    function fakeTask() {
      // `await task` must work, so base the fake on a resolved promise.
      return Object.assign(Promise.resolve({}), {
        on: vi.fn().mockReturnValue(vi.fn()),
        cancel: vi.fn(),
      });
    }

    it("starts a resumable upload for the path with metadata", () => {
      const task = fakeTask();
      vi.mocked(storageRef).mockReturnValue("ref" as any);
      vi.mocked(uploadBytesResumable).mockReturnValue(task as any);

      dao.uploadResumable("videos/v1.mp4", fakeBlob, { contentType: "video/mp4" });

      expect(storageRef).toHaveBeenCalledWith(fakeStorage, "videos/v1.mp4");
      expect(uploadBytesResumable).toHaveBeenCalledWith("ref", fakeBlob, {
        contentType: "video/mp4",
      });
    });

    it("onProgress maps snapshots to { bytesTransferred, totalBytes } and returns the unsubscribe", () => {
      const task = fakeTask();
      const unsubFn = vi.fn();
      task.on.mockImplementation((_event: string, handler: any) => {
        handler({ bytesTransferred: 10, totalBytes: 100, state: "running" });
        return unsubFn;
      });
      vi.mocked(storageRef).mockReturnValue("ref" as any);
      vi.mocked(uploadBytesResumable).mockReturnValue(task as any);

      const progressCallback = vi.fn();
      const handle = dao.uploadResumable("p", fakeBlob);
      const unsubscribe = handle.onProgress(progressCallback);

      expect(task.on).toHaveBeenCalledWith("state_changed", expect.any(Function));
      expect(progressCallback).toHaveBeenCalledWith({
        bytesTransferred: 10,
        totalBytes: 100,
      });
      expect(unsubscribe).toBe(unsubFn);
    });

    it("done() awaits the task and resolves to the download URL", async () => {
      const task = fakeTask();
      vi.mocked(storageRef).mockReturnValue("ref" as any);
      vi.mocked(uploadBytesResumable).mockReturnValue(task as any);
      vi.mocked(getDownloadURL).mockResolvedValue("https://cdn/v1.mp4");

      const handle = dao.uploadResumable("p", fakeBlob);
      const url = await handle.done();

      expect(getDownloadURL).toHaveBeenCalledWith("ref");
      expect(url).toBe("https://cdn/v1.mp4");
    });

    it("cancel() forwards to the underlying task", () => {
      const task = fakeTask();
      vi.mocked(storageRef).mockReturnValue("ref" as any);
      vi.mocked(uploadBytesResumable).mockReturnValue(task as any);

      const handle = dao.uploadResumable("p", fakeBlob);
      handle.cancel();

      expect(task.cancel).toHaveBeenCalledTimes(1);
    });
  });

  // ── getBytes ──────────────────────────────────────────────────────────────

  describe("getBytes", () => {
    it("uses the SDK for Firebase v0 download URLs, decoding the object path", async () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      vi.mocked(storageRef).mockReturnValue("objRef" as any);
      vi.mocked(getBytes).mockResolvedValue(buffer);
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const url =
        "https://firebasestorage.googleapis.com/v0/b/my-bucket/o/users%2Fu1%2Ffile+name.png?alt=media&token=abc";
      const result = await dao.getBytes(url);

      // %2F decodes to "/" and "+" is treated as a space.
      expect(storageRef).toHaveBeenCalledWith(fakeStorage, "users/u1/file name.png");
      expect(getBytes).toHaveBeenCalledWith("objRef");
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("falls back to fetch for non-Firebase URLs", async () => {
      const buffer = new Uint8Array([9, 8]).buffer;
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer),
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await dao.getBytes("https://example.com/file.bin");

      expect(fetchSpy).toHaveBeenCalledWith("https://example.com/file.bin");
      expect(getBytes).not.toHaveBeenCalled();
      expect(result).toEqual(new Uint8Array([9, 8]));
    });

    it("throws `HTTP {status}` when the fetch fallback fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 404 }),
      );

      await expect(dao.getBytes("https://example.com/missing")).rejects.toThrow(
        "HTTP 404",
      );
    });

    it("falls back to fetch when the object path cannot be percent-decoded", async () => {
      const buffer = new Uint8Array([7]).buffer;
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer),
      });
      vi.stubGlobal("fetch", fetchSpy);

      // "%E0%A4%A" is a truncated escape sequence → decodeURIComponent throws.
      const url =
        "https://firebasestorage.googleapis.com/v0/b/bucket/o/%E0%A4%A?alt=media";
      const result = await dao.getBytes(url);

      expect(fetchSpy).toHaveBeenCalledWith(url);
      expect(getBytes).not.toHaveBeenCalled();
      expect(result).toEqual(new Uint8Array([7]));
    });
  });

  // ── getDownloadUrl ────────────────────────────────────────────────────────

  describe("getDownloadUrl", () => {
    it("resolves the download URL for the given path", async () => {
      vi.mocked(storageRef).mockReturnValue("ref" as any);
      vi.mocked(getDownloadURL).mockResolvedValue("https://cdn/x");

      const url = await dao.getDownloadUrl("docs/x.pdf");

      expect(storageRef).toHaveBeenCalledWith(fakeStorage, "docs/x.pdf");
      expect(getDownloadURL).toHaveBeenCalledWith("ref");
      expect(url).toBe("https://cdn/x");
    });
  });
});
