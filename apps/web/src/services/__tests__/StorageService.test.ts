// Unit tests for StorageService — StorageDao is mocked via the DAO factory
// singleton, the file-classification util is mocked, and global fetch is mocked
// for the external-image path. console.error is spied on for the error paths.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StorageService } from "@/services/StorageService";
import type { StorageDao } from "@grids/contracts/dao";
import { mockConsoleError, registerTestDaoFactory } from "./testHelpers";

// ── Mock file classification ─────────────────────────────────────────────

const validateUploadFile = vi.fn();
vi.mock("@/utils/UploadFileClassification", () => ({
  validateUploadFile: (...args: unknown[]) => validateUploadFile(...args),
}));

let mockStorageDao: Record<string, ReturnType<typeof vi.fn>>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function fileTypeResult(over: Partial<{ isImage: boolean; isVideo: boolean; isDocument: boolean }> = {}) {
  return { isImage: false, isVideo: false, isDocument: false, ...over };
}

beforeEach(() => {
  mockStorageDao = {
    upload: vi.fn(),
    uploadResumable: vi.fn(),
    getBytes: vi.fn(),
    getDownloadUrl: vi.fn(),
    delete: vi.fn(),
    // Deterministic, joinable path so assertions can verify composition.
    buildFilePath: vi.fn(
      (root: string, userId: string, folder: string, name: string) =>
        `${root}/${userId}/${folder}/${name}`,
    ),
  };

  registerTestDaoFactory({
    getStorageDao: () => mockStorageDao as unknown as StorageDao,
  });

  validateUploadFile.mockReset();
  validateUploadFile.mockReturnValue(fileTypeResult());
  consoleErrorSpy = mockConsoleError();
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

function makeFile(name = "doc.pdf", type = "application/pdf"): File {
  return new File(["content"], name, { type });
}

// ── validateFile ─────────────────────────────────────────────────────────

describe("validateFile", () => {
  it("delegates to validateUploadFile and returns its result", () => {
    const expected = fileTypeResult({ isImage: true });
    validateUploadFile.mockReturnValueOnce(expected);
    const file = makeFile("p.png", "image/png");

    const service = new StorageService();
    const result = service.validateFile(file, { fileType: "images" });

    expect(validateUploadFile).toHaveBeenCalledWith(file, { fileType: "images" });
    expect(result).toBe(expected);
  });

  it("passes an empty options object by default", () => {
    const file = makeFile();

    const service = new StorageService();
    service.validateFile(file);

    expect(validateUploadFile).toHaveBeenCalledWith(file, {});
  });
});

// ── upload ───────────────────────────────────────────────────────────────

describe("upload", () => {
  it("uploads images under the images folder and merges published metadata", async () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
    mockStorageDao.upload.mockResolvedValueOnce("https://cdn/img.png");
    const file = makeFile("img.png", "image/png");

    const service = new StorageService();
    const url = await service.upload("u1", file);

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "images",
      "img.png",
    );
    expect(mockStorageDao.upload).toHaveBeenCalledWith(
      "users/u1/images/img.png",
      file,
      { customMetadata: { published: "true" } },
    );
    expect(url).toBe("https://cdn/img.png");
  });

  it("routes videos to the videos folder", async () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isVideo: true }));
    mockStorageDao.upload.mockResolvedValueOnce("url");
    const file = makeFile("clip.mp4", "video/mp4");

    const service = new StorageService();
    await service.upload("u1", file);

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "videos",
      "clip.mp4",
    );
  });

  it("falls back to the documents folder when neither image nor video", async () => {
    validateUploadFile.mockReturnValue(fileTypeResult());
    mockStorageDao.upload.mockResolvedValueOnce("url");
    const file = makeFile("notes.pdf", "application/pdf");

    const service = new StorageService();
    await service.upload("u1", file);

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "documents",
      "notes.pdf",
    );
  });

  it("honors an explicit fileType override", async () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
    mockStorageDao.upload.mockResolvedValueOnce("url");
    const file = makeFile("thing.bin", "application/octet-stream");

    const service = new StorageService();
    await service.upload("u1", file, { fileType: "documents" });

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "documents",
      "thing.bin",
    );
  });

  it("merges caller metadata while keeping published=true", async () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
    mockStorageDao.upload.mockResolvedValueOnce("url");
    const file = makeFile("img.png", "image/png");

    const service = new StorageService();
    await service.upload("u1", file, {}, {
      contentType: "image/png",
      customMetadata: { alt: "logo" },
    });

    expect(mockStorageDao.upload).toHaveBeenCalledWith(
      "users/u1/images/img.png",
      file,
      {
        contentType: "image/png",
        customMetadata: { published: "true", alt: "logo" },
      },
    );
  });

  it("logs and rethrows when the DAO upload fails", async () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
    mockStorageDao.upload.mockRejectedValueOnce(new Error("upload boom"));
    const file = makeFile("img.png", "image/png");

    const service = new StorageService();
    await expect(service.upload("u1", file)).rejects.toThrow("upload boom");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "StorageService upload failed:",
      expect.any(Error),
    );
  });
});

// ── uploadResumable ──────────────────────────────────────────────────────

describe("uploadResumable", () => {
  it("returns the resumable task with the composed path and merged metadata", () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
    const task = { pause: vi.fn() };
    mockStorageDao.uploadResumable.mockReturnValueOnce(task);
    const file = makeFile("img.png", "image/png");

    const service = new StorageService();
    const result = service.uploadResumable("u1", file);

    expect(mockStorageDao.uploadResumable).toHaveBeenCalledWith(
      "users/u1/images/img.png",
      file,
      { customMetadata: { published: "true" } },
    );
    expect(result).toBe(task);
  });

  it("uses the documents folder for non-media files", () => {
    validateUploadFile.mockReturnValue(fileTypeResult());
    mockStorageDao.uploadResumable.mockReturnValueOnce({});
    const file = makeFile("a.txt", "text/plain");

    const service = new StorageService();
    service.uploadResumable("u1", file);

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "documents",
      "a.txt",
    );
  });

  it("merges caller metadata while keeping published=true", () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
    mockStorageDao.uploadResumable.mockReturnValueOnce({});
    const file = makeFile("img.png", "image/png");

    const service = new StorageService();
    service.uploadResumable("u1", file, {}, {
      customMetadata: { alt: "logo" },
    });

    expect(mockStorageDao.uploadResumable).toHaveBeenCalledWith(
      "users/u1/images/img.png",
      file,
      { customMetadata: { published: "true", alt: "logo" } },
    );
  });

  it("does not wrap DAO errors (no try/catch, unlike upload)", () => {
    validateUploadFile.mockReturnValue(fileTypeResult({ isImage: true }));
    mockStorageDao.uploadResumable.mockImplementation(() => {
      throw new Error("resumable boom");
    });
    const file = makeFile("img.png", "image/png");

    const service = new StorageService();
    expect(() => service.uploadResumable("u1", file)).toThrow("resumable boom");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// ── uploadExternalImage ──────────────────────────────────────────────────

describe("uploadExternalImage", () => {
  function stubFetch(response: Partial<Response> & { ok: boolean }) {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("fetches, derives the extension from content-type, and uploads the blob", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    stubFetch({
      ok: true,
      headers: { get: () => "image/png" } as unknown as Headers,
      blob: () => Promise.resolve(blob),
    } as Partial<Response> & { ok: boolean });
    mockStorageDao.upload.mockResolvedValueOnce("https://cdn/external.png");

    const service = new StorageService();
    const url = await service.uploadExternalImage(
      "u1",
      "https://example.com/pic.png",
    );

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "images",
      "external.png",
    );
    expect(mockStorageDao.upload).toHaveBeenCalledWith(
      "users/u1/images/external.png",
      blob,
      {
        contentType: "image/png",
        customMetadata: { published: "true" },
      },
    );
    expect(url).toBe("https://cdn/external.png");
  });

  it("respects a custom folder argument", async () => {
    stubFetch({
      ok: true,
      headers: { get: () => "image/jpeg" } as unknown as Headers,
      blob: () => Promise.resolve(new Blob([], { type: "image/jpeg" })),
    } as Partial<Response> & { ok: boolean });
    mockStorageDao.upload.mockResolvedValueOnce("url");

    const service = new StorageService();
    await service.uploadExternalImage("u1", "https://x/y.jpg", "avatars");

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "avatars",
      "external.jpeg",
    );
  });

  it("strips charset parameters when deriving the extension", async () => {
    stubFetch({
      ok: true,
      headers: { get: () => "image/webp; charset=binary" } as unknown as Headers,
      blob: () => Promise.resolve(new Blob([], { type: "image/webp" })),
    } as Partial<Response> & { ok: boolean });
    mockStorageDao.upload.mockResolvedValueOnce("url");

    const service = new StorageService();
    await service.uploadExternalImage("u1", "https://x/y.webp");

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "images",
      "external.webp",
    );
  });

  it('falls back to a "jpg" extension when the content-type has no subtype', async () => {
    // "image/" passes the startsWith("image/") guard but yields an empty
    // subtype, exercising the `|| "jpg"` fallback in the extension derivation.
    stubFetch({
      ok: true,
      headers: { get: () => "image/" } as unknown as Headers,
      blob: () => Promise.resolve(new Blob([], { type: "image/" })),
    } as Partial<Response> & { ok: boolean });
    mockStorageDao.upload.mockResolvedValueOnce("url");

    const service = new StorageService();
    await service.uploadExternalImage("u1", "https://x/y");

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "images",
      "external.jpg",
    );
  });

  it("defaults the content-type to image/jpeg when the header is missing", async () => {
    stubFetch({
      ok: true,
      headers: { get: () => null } as unknown as Headers,
      blob: () => Promise.resolve(new Blob([], { type: "" })),
    } as Partial<Response> & { ok: boolean });
    mockStorageDao.upload.mockResolvedValueOnce("url");

    const service = new StorageService();
    await service.uploadExternalImage("u1", "https://x/y");

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "images",
      "external.jpeg",
    );
  });

  it("throws when the fetch response is not ok", async () => {
    stubFetch({ ok: false } as Partial<Response> & { ok: boolean });

    const service = new StorageService();
    await expect(
      service.uploadExternalImage("u1", "https://x/y"),
    ).rejects.toThrow("Failed to fetch image from the provided URL.");
    expect(mockStorageDao.upload).not.toHaveBeenCalled();
  });

  it("throws when the URL does not point to an image", async () => {
    stubFetch({
      ok: true,
      headers: { get: () => "text/html" } as unknown as Headers,
      blob: () => Promise.resolve(new Blob([])),
    } as Partial<Response> & { ok: boolean });

    const service = new StorageService();
    await expect(
      service.uploadExternalImage("u1", "https://x/y"),
    ).rejects.toThrow("The URL does not point to a valid image.");
    expect(mockStorageDao.upload).not.toHaveBeenCalled();
  });

  it("logs and rethrows when the DAO upload fails", async () => {
    stubFetch({
      ok: true,
      headers: { get: () => "image/png" } as unknown as Headers,
      blob: () => Promise.resolve(new Blob([], { type: "image/png" })),
    } as Partial<Response> & { ok: boolean });
    mockStorageDao.upload.mockRejectedValueOnce(new Error("store boom"));

    const service = new StorageService();
    await expect(
      service.uploadExternalImage("u1", "https://x/y.png"),
    ).rejects.toThrow("store boom");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "StorageService uploadExternalImage failed:",
      expect.any(Error),
    );
  });
});

// ── getBytes ─────────────────────────────────────────────────────────────

describe("getBytes", () => {
  it("delegates to the DAO and returns the bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    mockStorageDao.getBytes.mockResolvedValueOnce(bytes);

    const service = new StorageService();
    const result = await service.getBytes("path/to/file");

    expect(mockStorageDao.getBytes).toHaveBeenCalledWith("path/to/file");
    expect(result).toBe(bytes);
  });

  it("logs and rethrows on failure", async () => {
    mockStorageDao.getBytes.mockRejectedValueOnce(new Error("bytes boom"));

    const service = new StorageService();
    await expect(service.getBytes("p")).rejects.toThrow("bytes boom");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "StorageService getBytes failed:",
      expect.any(Error),
    );
  });
});

// ── getDownloadUrl ───────────────────────────────────────────────────────

describe("getDownloadUrl", () => {
  it("delegates to the DAO and returns the URL", async () => {
    mockStorageDao.getDownloadUrl.mockResolvedValueOnce("https://cdn/file");

    const service = new StorageService();
    const result = await service.getDownloadUrl("path");

    expect(mockStorageDao.getDownloadUrl).toHaveBeenCalledWith("path");
    expect(result).toBe("https://cdn/file");
  });

  it("logs and rethrows on failure", async () => {
    mockStorageDao.getDownloadUrl.mockRejectedValueOnce(new Error("url boom"));

    const service = new StorageService();
    await expect(service.getDownloadUrl("p")).rejects.toThrow("url boom");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "StorageService getDownloadUrl failed:",
      expect.any(Error),
    );
  });
});

// ── delete ───────────────────────────────────────────────────────────────

describe("delete", () => {
  it("delegates to the DAO", async () => {
    mockStorageDao.delete.mockResolvedValueOnce(undefined);

    const service = new StorageService();
    await service.delete("path");

    expect(mockStorageDao.delete).toHaveBeenCalledWith("path");
  });

  it("logs and rethrows on failure", async () => {
    mockStorageDao.delete.mockRejectedValueOnce(new Error("del boom"));

    const service = new StorageService();
    await expect(service.delete("p")).rejects.toThrow("del boom");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "StorageService delete failed:",
      expect.any(Error),
    );
  });
});

// ── buildFilePath ────────────────────────────────────────────────────────

describe("buildFilePath", () => {
  it("delegates to the DAO and returns the composed path", () => {
    const service = new StorageService();
    const result = service.buildFilePath("users", "u1", "images", "a.png");

    expect(mockStorageDao.buildFilePath).toHaveBeenCalledWith(
      "users",
      "u1",
      "images",
      "a.png",
    );
    expect(result).toBe("users/u1/images/a.png");
  });
});
