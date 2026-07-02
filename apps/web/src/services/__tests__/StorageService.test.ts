// Unit tests for StorageService — the archive upload orchestration (hash →
// authorize → upload → finalize) plus passthrough helpers. StorageDao,
// CloudFunctionsDao, and UploadArchiveDao are mocked via the DAO factory
// singleton; hashing and file-classification utils are mocked; global fetch is
// mocked for the external-image path.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StorageService } from "@/services/StorageService";
import type {
  CloudFunctionsDao,
  StorageDao,
  UploadArchiveDao,
} from "@grids/contracts/dao";
import type { UploadArchiveDocument } from "@grids/contracts/types";
import { mockConsoleError, registerTestDaoFactory } from "./testHelpers";

// ── Mocks ──────────────────────────────────────────────────────────────────

const validateUploadFile = vi.fn();
vi.mock("@/utils/UploadFileClassification", () => ({
  validateUploadFile: (...args: unknown[]) => validateUploadFile(...args),
}));

const hashFile = vi.fn();
vi.mock("@/utils/FileHashing", async () => {
  const actual = await vi.importActual<typeof import("@/utils/FileHashing")>(
    "@/utils/FileHashing",
  );
  return {
    ...actual,
    hashFile: (...args: unknown[]) => hashFile(...args),
  };
});

const HASH = "a".repeat(64);

let mockStorageDao: Record<string, ReturnType<typeof vi.fn>>;
let mockCloudFunctionsDao: { callFunction: ReturnType<typeof vi.fn> };
let subscribeUploadStatus: ReturnType<typeof vi.fn>;
/** Document the mocked archive subscription emits (set per test). */
let finalizeDoc: UploadArchiveDocument | null;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function fileTypeResult(
  over: Partial<{ isImage: boolean; isVideo: boolean; isDocument: boolean }> = {},
) {
  return { isImage: false, isVideo: false, isDocument: false, ...over };
}

function activeDoc(url: string): UploadArchiveDocument {
  return {
    uid: "u1",
    hash: HASH,
    kind: "images",
    path: `users/u1/images/${HASH}.png`,
    url,
    size: 4,
    contentType: "image/png",
    ext: "png",
    status: "active",
    refCount: 0,
    shareable: false,
  };
}

beforeEach(() => {
  mockStorageDao = {
    upload: vi.fn(),
    uploadResumable: vi.fn(),
    getBytes: vi.fn(),
    getDownloadUrl: vi.fn(),
  };
  mockCloudFunctionsDao = { callFunction: vi.fn() };
  finalizeDoc = activeDoc("https://cdn/final.png");
  subscribeUploadStatus = vi.fn(
    (
      _uid: string,
      _hash: string,
      cb: (doc: UploadArchiveDocument | null) => void,
    ) => {
      // Emit asynchronously, mirroring an onSnapshot listener.
      queueMicrotask(() => cb(finalizeDoc));
      return () => {};
    },
  );

  registerTestDaoFactory({
    getStorageDao: () => mockStorageDao as unknown as StorageDao,
    getCloudFunctionsDao: () =>
      mockCloudFunctionsDao as unknown as CloudFunctionsDao,
    getUploadArchiveDao: () =>
      ({ subscribeUploadStatus }) as unknown as UploadArchiveDao,
  });

  validateUploadFile.mockReset();
  validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
  hashFile.mockReset();
  hashFile.mockResolvedValue(HASH);
  consoleErrorSpy = mockConsoleError();
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

function makeFile(name = "img.png", type = "image/png"): File {
  return new File(["data"], name, { type });
}

describe("validateFile", () => {
  it("delegates to validateUploadFile and returns its result", () => {
    const expected = fileTypeResult({ isImage: true });
    validateUploadFile.mockReturnValueOnce(expected);
    const file = makeFile();
    const service = new StorageService();
    expect(service.validateFile(file, { fileType: "images" })).toBe(expected);
    expect(validateUploadFile).toHaveBeenCalledWith(file, { fileType: "images" });
  });
});

describe("uploadArchiveFile", () => {
  it("hashes, authorizes, uploads to the canonical path, and finalizes", async () => {
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({
      uploadRequired: true,
      path: `users/u1/images/${HASH}.png`,
    });
    mockStorageDao.upload.mockResolvedValueOnce("https://cdn/uploaded.png");
    finalizeDoc = activeDoc("https://cdn/final.png");

    const service = new StorageService();
    const result = await service.uploadArchiveFile("u1", makeFile());

    expect(hashFile).toHaveBeenCalled();
    expect(mockCloudFunctionsDao.callFunction).toHaveBeenCalledWith(
      "authorizeStorageUpload",
      expect.objectContaining({
        hash: HASH,
        kind: "images",
        ext: "png",
        contentType: "image/png",
        displayName: "img.png",
      }),
    );
    expect(mockStorageDao.upload).toHaveBeenCalledWith(
      `users/u1/images/${HASH}.png`,
      expect.any(File),
      expect.objectContaining({
        customMetadata: expect.objectContaining({ published: "true" }),
      }),
    );
    // Finalize supplies the authoritative URL.
    expect(result).toEqual({
      url: "https://cdn/final.png",
      hash: HASH,
      path: `users/u1/images/${HASH}.png`,
      type: "images",
      size: 4,
      uploadRequired: true,
    });
  });

  it("short-circuits the byte upload when the file already exists (dedupe)", async () => {
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({
      uploadRequired: false,
      url: "https://cdn/existing.png",
      path: `users/u1/images/${HASH}.png`,
    });

    const service = new StorageService();
    const result = await service.uploadArchiveFile("u1", makeFile());

    expect(mockStorageDao.upload).not.toHaveBeenCalled();
    expect(subscribeUploadStatus).not.toHaveBeenCalled();
    expect(result.url).toBe("https://cdn/existing.png");
    expect(result.uploadRequired).toBe(false);
  });

  it("rejects when the server marks the upload failed (hash mismatch)", async () => {
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({
      uploadRequired: true,
      path: `users/u1/images/${HASH}.png`,
    });
    mockStorageDao.upload.mockResolvedValueOnce("https://cdn/uploaded.png");
    finalizeDoc = {
      ...activeDoc(""),
      status: "failed",
      failureReason: "hash-mismatch",
    };

    const service = new StorageService();
    await expect(service.uploadArchiveFile("u1", makeFile())).rejects.toThrow(
      /verification failed/i,
    );
  });

  it("falls back to the uploaded URL when finalization is never observed", async () => {
    vi.useFakeTimers();
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({
      uploadRequired: true,
      path: `users/u1/images/${HASH}.png`,
    });
    mockStorageDao.upload.mockResolvedValueOnce("https://cdn/uploaded.png");
    finalizeDoc = { ...activeDoc(""), status: "pending" };

    const service = new StorageService();
    const promise = service.uploadArchiveFile("u1", makeFile());
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await promise;
    expect(result.url).toBe("https://cdn/uploaded.png");
    vi.useRealTimers();
  });
});

describe("uploadArchiveResumable", () => {
  it("reports byte progress and resolves the finalized result", async () => {
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({
      uploadRequired: true,
      path: `users/u1/images/${HASH}.png`,
    });
    let progressCb: ((p: { bytesTransferred: number; totalBytes: number }) => void) | null =
      null;
    let resolveUpload!: (url: string) => void;
    mockStorageDao.uploadResumable.mockReturnValue({
      onProgress: (cb: typeof progressCb) => {
        progressCb = cb;
        return () => {};
      },
      done: () => new Promise<string>((res) => (resolveUpload = res)),
      cancel: vi.fn(),
    });
    finalizeDoc = activeDoc("https://cdn/final.png");

    const service = new StorageService();
    const task = service.uploadArchiveResumable("u1", makeFile());
    const onProgress = vi.fn();
    task.onProgress(onProgress);

    // Let hashing + authorize settle so the inner upload task is created.
    await vi.waitFor(() => expect(progressCb).not.toBeNull());
    progressCb!({ bytesTransferred: 50, totalBytes: 100 });
    expect(onProgress).toHaveBeenCalledWith({
      bytesTransferred: 50,
      totalBytes: 100,
    });

    resolveUpload("https://cdn/uploaded.png");
    const result = await task.done();
    expect(result.url).toBe("https://cdn/final.png");
    expect(result.hash).toBe(HASH);
  });
});

describe("uploadExternalImageToArchive", () => {
  it("fetches the image and routes it through the archive flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "image/png" },
        blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })),
      }),
    );
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({
      uploadRequired: false,
      url: "https://cdn/existing.png",
      path: `users/u1/images/${HASH}.png`,
    });

    const service = new StorageService();
    const result = await service.uploadExternalImageToArchive(
      "u1",
      "https://remote/x.png",
    );
    expect(result.url).toBe("https://cdn/existing.png");
  });

  it("throws for a non-image URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "text/html" },
        blob: () => Promise.resolve(new Blob([""], { type: "text/html" })),
      }),
    );
    const service = new StorageService();
    await expect(
      service.uploadExternalImageToArchive("u1", "https://remote/x.html"),
    ).rejects.toThrow(/valid image/i);
  });
});

describe("deleteArchiveUpload", () => {
  it("calls the deleteStorageUpload callable with hash and force", async () => {
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce({ deleted: true });
    const service = new StorageService();
    await service.deleteArchiveUpload(HASH, true);
    expect(mockCloudFunctionsDao.callFunction).toHaveBeenCalledWith(
      "deleteStorageUpload",
      { hash: HASH, force: true },
    );
  });
});

describe("passthrough helpers", () => {
  it("uploadToPath merges published metadata", async () => {
    mockStorageDao.upload.mockResolvedValueOnce("https://cdn/og.png");
    const service = new StorageService();
    const url = await service.uploadToPath("og-images/x.png", makeFile());
    expect(url).toBe("https://cdn/og.png");
    expect(mockStorageDao.upload).toHaveBeenCalledWith(
      "og-images/x.png",
      expect.any(File),
      expect.objectContaining({
        customMetadata: expect.objectContaining({ published: "true" }),
      }),
    );
  });

  it("getBytes and getDownloadUrl delegate to the DAO", async () => {
    mockStorageDao.getBytes.mockResolvedValueOnce(new Uint8Array([1]));
    mockStorageDao.getDownloadUrl.mockResolvedValueOnce("https://cdn/x");
    const service = new StorageService();
    expect(await service.getBytes("https://cdn/x")).toEqual(new Uint8Array([1]));
    expect(await service.getDownloadUrl("path")).toBe("https://cdn/x");
  });
});
