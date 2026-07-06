// Unit tests for StubbedStorageDao — files are stored in memory by path with a
// reverse url->path index. Covers upload, resumable upload (progress/done/
// cancel), byte retrieval (stored + network fallback), and download urls.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StubbedStorageDao } from "../StubbedStorageDao";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase } from "./memoryTestUtils";

let dao: StubbedStorageDao;
let urlCounter = 0;

beforeEach(() => {
  resetMemoryDatabase();
  // jsdom's URL.createObjectURL validates its argument against the real Blob
  // type and our arrayBuffer-capable double is not one, so mock the object-URL
  // boundary to keep tests in control of the path<->url mapping.
  urlCounter = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(
    () => `blob:mock/${++urlCounter}`,
  );
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  dao = new StubbedStorageDao();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom's Blob does not implement arrayBuffer(), so we use a minimal Blob-like
// test double that satisfies the only members StubbedStorageDao touches: size
// and arrayBuffer().
function blob(text = "hello"): Blob {
  const bytes = new TextEncoder().encode(text);
  return {
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Blob;
}

describe("StubbedStorageDao.upload", () => {
  it("stores the file and returns a url resolvable to the same path", async () => {
    const url = await dao.upload("path/file.txt", blob());

    expect(typeof url).toBe("string");
    expect(memoryDatabase.storageByPath.has("path/file.txt")).toBe(true);
    expect(await dao.getDownloadUrl("path/file.txt")).toBe(url);
  });

  it("stores the provided metadata alongside the file", async () => {
    await dao.upload("path/file.txt", blob(), {
      contentType: "text/plain",
    } as never);

    expect(memoryDatabase.storageByPath.get("path/file.txt")?.metadata).toEqual(
      { contentType: "text/plain" },
    );
  });

  it("overwrites a file already stored at the same path", async () => {
    await dao.upload("path/file.txt", blob("first"));
    await dao.upload("path/file.txt", blob("second"));

    const bytes = await dao.getBytes(
      await dao.getDownloadUrl("path/file.txt"),
    );
    expect(new TextDecoder().decode(bytes)).toBe("second");
  });

  it("revokes and unindexes the previous url when overwriting a path", async () => {
    const firstUrl = await dao.upload("path/file.txt", blob("first"));
    await dao.upload("path/file.txt", blob("second"));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    expect(memoryDatabase.storagePathByUrl.has(firstUrl)).toBe(false);
  });
});

describe("StubbedStorageDao.uploadResumable", () => {
  it("reports initial progress immediately on subscribe", () => {
    const data = blob("hello");
    const task = dao.uploadResumable("path/file.txt", data);
    const onProgress = vi.fn();

    task.onProgress(onProgress);

    expect(onProgress).toHaveBeenCalledWith({
      bytesTransferred: 0,
      totalBytes: data.size,
    });
  });

  it("resolves done() with the stored url and reports full progress", async () => {
    const data = blob("hello");
    const task = dao.uploadResumable("path/file.txt", data);
    const onProgress = vi.fn();
    task.onProgress(onProgress);

    const url = await task.done();

    expect(url).toBe(await dao.getDownloadUrl("path/file.txt"));
    expect(onProgress).toHaveBeenLastCalledWith({
      bytesTransferred: data.size,
      totalBytes: data.size,
    });
  });

  it("defers the actual store until done() resolves", async () => {
    const task = dao.uploadResumable("path/file.txt", blob());

    // Synchronously after the call the file is not yet stored.
    expect(memoryDatabase.storageByPath.has("path/file.txt")).toBe(false);

    await task.done();
    expect(memoryDatabase.storageByPath.has("path/file.txt")).toBe(true);
  });

  it("rejects done() when the upload is canceled", async () => {
    const task = dao.uploadResumable("path/file.txt", blob());
    task.cancel();

    await expect(task.done()).rejects.toThrow("Upload canceled");
  });

  it("does not store the file when canceled", async () => {
    const task = dao.uploadResumable("path/file.txt", blob());
    task.cancel();
    await task.done().catch(() => undefined);

    expect(memoryDatabase.storageByPath.has("path/file.txt")).toBe(false);
  });

  it("onProgress returns an unsubscribe that detaches the callback", async () => {
    const task = dao.uploadResumable("path/file.txt", blob());
    const onProgress = vi.fn();
    const off = task.onProgress(onProgress);
    onProgress.mockClear();

    off();
    await task.done();

    // After detaching, the completion progress event should not be delivered.
    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe("StubbedStorageDao.getBytes", () => {
  it("returns the stored bytes for an uploaded file's url", async () => {
    const url = await dao.upload("path/file.txt", blob("hello"));
    const bytes = await dao.getBytes(url);

    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });

  it("falls back to fetching when the url is not stored locally", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("remote").buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const bytes = await dao.getBytes("https://cdn.example.com/file.txt");

    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.com/file.txt");
    expect(new TextDecoder().decode(bytes)).toBe("remote");
  });

  it("throws with the HTTP status when the network fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    await expect(dao.getBytes("https://cdn.example.com/missing")).rejects.toThrow(
      "HTTP 404",
    );
  });
});

describe("StubbedStorageDao.getDownloadUrl", () => {
  it("returns the path itself when nothing is stored there", async () => {
    expect(await dao.getDownloadUrl("unknown/path")).toBe("unknown/path");
  });
});

