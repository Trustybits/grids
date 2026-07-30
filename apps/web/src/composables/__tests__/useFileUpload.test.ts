/**
 * Tests for useFileUpload — upload flows that turn Files into tiles (direct,
 * optimistic-new, optimistic-existing, multi-document) plus external image
 * import. Uploads now route through the archive flow: the storage service
 * hashes, authorizes, uploads, and finalizes, returning {url, hash, ...}. Every
 * collaborator is mocked: auth provider, storage service, grid store,
 * TileUtils.createTileContent, the document-thumbnail helpers, uuid, and
 * URL.createObjectURL/revokeObjectURL.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentType } from "@grids/contracts/types";
import { useFileUpload } from "@/composables/useFileUpload";
import { createTileContent } from "@/utils/TileUtils";
import {
  documentItemIsPdf,
  ensureDocumentItemThumbnailOnServer,
} from "@/composables/useDocumentThumbnail";
import type { ArchiveUploadResult } from "@/types/UploadFileTypes";

const {
  mockGetAuthProvider,
  mockGetCurrentUserId,
  mockGetServiceFactory,
  mockGetStorageService,
  mockUseGridSessionStore,
  mockUseGridController,
  storage,
  sessionStore,
  controllerMock,
} = vi.hoisted(() => {
  const mockGetCurrentUserId = vi.fn<() => string | null>(() => "user-1");
  const storage = {
    uploadArchiveFile: vi.fn(),
    validateFile: vi.fn(() => ({ isImage: true })),
    uploadArchiveResumable: vi.fn(),
    uploadExternalImageToArchive: vi.fn(),
  };
  const controllerMock = {
    addTile: vi.fn<() => string | null>(() => "tile-1"),
    setTileContent: vi.fn(),
    startUpload: vi.fn(() => "upload-1" as string | null),
    progressUpload: vi.fn(),
    resolveUpload: vi.fn(() => true),
    failUpload: vi.fn(() => true),
    failUploadAndRemoveTile: vi.fn(() => true),
    failUploadAndRestoreTileContent: vi.fn(() => true),
    revokeOwnedObjectUrl: vi.fn(() => true),
    setTileUploading: vi.fn(),
    clearTileUploading: vi.fn(),
    setResolvedUrl: vi.fn(),
    setResolvedDocumentItemUrl: vi.fn(),
    patchDocumentItem: vi.fn(),
    updateGrid: vi.fn(),
    saveGrid: vi.fn(),
    flushSaves: vi.fn(() => Promise.resolve()),
    removeTile: vi.fn(),
  };
  const sessionStore = {
    currentGrid: { id: "grid-1" } as { id: string } | null,
  };
  const mockGetAuthProvider = vi.fn(() => ({ getCurrentUserId: mockGetCurrentUserId }));
  const mockGetStorageService = vi.fn(() => storage);
  const mockGetServiceFactory = vi.fn(() => ({
    getStorageService: mockGetStorageService,
  }));
  const mockUseGridSessionStore = vi.fn(() => sessionStore);
  const mockUseGridController = vi.fn(() => controllerMock);
  return {
    mockGetAuthProvider,
    mockGetCurrentUserId,
    mockGetServiceFactory,
    mockGetStorageService,
    mockUseGridSessionStore,
    mockUseGridController,
    storage,
    sessionStore,
    controllerMock,
  };
});

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: mockGetAuthProvider,
}));
vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: mockGetServiceFactory,
}));
vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: mockUseGridSessionStore,
}));
vi.mock("@/controllers/useGridController", () => ({
  useGridController: mockUseGridController,
}));
vi.mock("@/utils/TileUtils", () => ({
  createTileContent: vi.fn((type, data) => ({ type, ...data })),
}));
vi.mock("@/composables/useDocumentThumbnail", () => ({
  documentItemIsPdf: vi.fn(() => false),
  ensureDocumentItemThumbnailOnServer: vi.fn(),
}));
const uuidState = vi.hoisted(() => ({ n: 0 }));
vi.mock("uuid", () => ({ v4: vi.fn(() => `uuid-${++uuidState.n}`) }));

const mockCreateTileContent = vi.mocked(createTileContent);
const mockDocumentItemIsPdf = vi.mocked(documentItemIsPdf);
const mockEnsureThumb = vi.mocked(ensureDocumentItemThumbnailOnServer);

function archiveResult(
  url: string,
  hash: string,
  overrides: Partial<ArchiveUploadResult> = {},
): ArchiveUploadResult {
  return {
    url,
    hash,
    path: `users/user-1/images/${hash}.png`,
    type: "images",
    size: 4,
    uploadRequired: true,
    ...overrides,
  };
}

/** A resolvable archive upload task: control hash/upload progress and completion. */
function makeUploadTask() {
  let progressCb: ((p: { bytesTransferred: number; totalBytes: number }) => void) | null =
    null;
  let hashCb: ((fraction: number) => void) | null = null;
  let resolveDone!: (result: ArchiveUploadResult) => void;
  let rejectDone!: (err: unknown) => void;
  const donePromise = new Promise<ArchiveUploadResult>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  return {
    task: {
      onProgress: vi.fn((cb) => {
        progressCb = cb;
        return () => {};
      }),
      onHashProgress: vi.fn((cb) => {
        hashCb = cb;
        return () => {};
      }),
      done: vi.fn(() => donePromise),
      cancel: vi.fn(),
    },
    emitProgress: (bytesTransferred: number, totalBytes: number) =>
      progressCb?.({ bytesTransferred, totalBytes }),
    emitHashProgress: (fraction: number) => hashCb?.(fraction),
    resolveDone,
    rejectDone,
  };
}

function file(name = "a.png", type = "image/png"): File {
  return new File(["data"], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  uuidState.n = 0;
  mockGetCurrentUserId.mockReturnValue("user-1");
  storage.validateFile.mockReturnValue({ isImage: true });
  controllerMock.addTile.mockReturnValue("tile-1");
  controllerMock.startUpload.mockReturnValue("upload-1");
  controllerMock.resolveUpload.mockReturnValue(true);
  controllerMock.failUpload.mockReturnValue(true);
  sessionStore.currentGrid = { id: "grid-1" };
  mockDocumentItemIsPdf.mockReturnValue(false);
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("setup", () => {
  it("does not resolve live upload dependencies until an upload command runs", () => {
    const api = useFileUpload();

    expect(api.uploadFileToUrl).toEqual(expect.any(Function));
    expect(api.uploadFileOptimistic).toEqual(expect.any(Function));
    expect(mockGetAuthProvider).not.toHaveBeenCalled();
    expect(mockGetServiceFactory).not.toHaveBeenCalled();
    expect(mockGetStorageService).not.toHaveBeenCalled();
    expect(mockUseGridSessionStore).not.toHaveBeenCalled();
    expect(mockUseGridController).not.toHaveBeenCalled();
  });
});

describe("uploadFileToUrl / uploadFileToArchive", () => {
  it("uploads through the archive flow and returns the storage URL", async () => {
    storage.uploadArchiveFile.mockResolvedValue(
      archiveResult("https://storage/a.png", "hash-a"),
    );
    const { uploadFileToUrl } = useFileUpload();
    const url = await uploadFileToUrl(file(), { fileType: "images" });
    expect(storage.uploadArchiveFile).toHaveBeenCalledWith(
      "user-1",
      expect.any(File),
      { fileType: "images" },
    );
    expect(url).toBe("https://storage/a.png");
  });

  it("returns the structured archive result (url + hash)", async () => {
    const result = archiveResult("https://storage/a.png", "hash-a");
    storage.uploadArchiveFile.mockResolvedValue(result);
    const { uploadFileToArchive } = useFileUpload();
    expect(await uploadFileToArchive(file())).toEqual(result);
  });

  it("throws when not logged in", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadFileToUrl } = useFileUpload();
    await expect(uploadFileToUrl(file())).rejects.toThrow(
      "You must be logged in to upload.",
    );
    expect(storage.uploadArchiveFile).not.toHaveBeenCalled();
  });

  it("logs and rethrows when the archive upload fails", async () => {
    storage.uploadArchiveFile.mockRejectedValue(new Error("storage down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { uploadFileToUrl } = useFileUpload();
    await expect(uploadFileToUrl(file())).rejects.toThrow("storage down");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("uploadFileToArchiveWithProgress", () => {
  it("reports combined hash+upload progress and returns the result", async () => {
    const { task, emitHashProgress, emitProgress, resolveDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);
    const onProgress = vi.fn();

    const { uploadFileToArchiveWithProgress } = useFileUpload();
    const promise = uploadFileToArchiveWithProgress(
      file(),
      { fileType: "images" },
      onProgress,
    );

    expect(storage.uploadArchiveResumable).toHaveBeenCalledWith(
      "user-1",
      expect.any(File),
      { fileType: "images" },
    );

    // Hashing fills the first half of the bar.
    emitHashProgress(0.5);
    expect(onProgress).toHaveBeenCalledWith(0.25);
    // Byte transfer fills the second half.
    emitProgress(50, 100);
    expect(onProgress).toHaveBeenCalledWith(0.75);

    const result = archiveResult("https://storage/avatar.png", "hash-av");
    resolveDone(result);
    expect(await promise).toEqual(result);
  });

  it("throws when not logged in", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadFileToArchiveWithProgress } = useFileUpload();
    await expect(uploadFileToArchiveWithProgress(file())).rejects.toThrow(
      "You must be logged in to upload.",
    );
    expect(storage.uploadArchiveResumable).not.toHaveBeenCalled();
  });
});

describe("uploadFile", () => {
  it("returns IMAGE content with src and srcHash for an image file", async () => {
    storage.uploadArchiveFile.mockResolvedValue(
      archiveResult("https://storage/a.png", "hash-a"),
    );
    const { uploadFile } = useFileUpload();
    const content = await uploadFile(file("a.png", "image/png"));
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.IMAGE, {
      src: "https://storage/a.png",
      srcHash: "hash-a",
    });
    expect(content).toMatchObject({ type: ContentType.IMAGE });
  });

  it("returns VIDEO content for a non-image file", async () => {
    storage.uploadArchiveFile.mockResolvedValue(
      archiveResult("https://storage/a.mp4", "hash-v", { type: "videos" }),
    );
    const { uploadFile } = useFileUpload();
    const content = await uploadFile(file("a.mp4", "video/mp4"));
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.VIDEO, {
      src: "https://storage/a.mp4",
      srcHash: "hash-v",
    });
    expect(content).toMatchObject({ type: ContentType.VIDEO });
  });
});

describe("uploadFileOptimistic", () => {
  it("creates a tile with a blob preview, then resolves the URL and hash", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);

    const { uploadFileOptimistic } = useFileUpload();
    const promise = uploadFileOptimistic(file());

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.IMAGE, {
      src: "blob:mock",
    });
    expect(controllerMock.addTile).toHaveBeenCalled();
    expect(controllerMock.startUpload).toHaveBeenCalledWith({
      tileId: "tile-1",
      progress: 0,
      ownedObjectUrl: "blob:mock",
      task,
    });

    resolveDone(archiveResult("https://storage/final.png", "hash-final"));
    await promise;

    expect(controllerMock.resolveUpload).toHaveBeenCalledWith(
      "upload-1",
      "https://storage/final.png",
      "hash-final",
    );
  });

  it("reports combined hash+upload progress", async () => {
    const { task, emitHashProgress, emitProgress, resolveDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);

    const { uploadFileOptimistic } = useFileUpload();
    const promise = uploadFileOptimistic(file());

    emitHashProgress(0.5);
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.25);
    emitProgress(25, 100);
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.625);

    resolveDone(archiveResult("https://x", "hash-x"));
    await promise;
  });

  it("revokes the blob through the owned-URL ledger and bails when the tile cannot be created", async () => {
    controllerMock.addTile.mockReturnValue(null);
    const { uploadFileOptimistic } = useFileUpload();
    await uploadFileOptimistic(file());
    expect(controllerMock.revokeOwnedObjectUrl).toHaveBeenCalledWith("blob:mock");
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(storage.uploadArchiveResumable).not.toHaveBeenCalled();
  });

  it("throws when not logged in (before creating a tile)", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadFileOptimistic } = useFileUpload();
    await expect(uploadFileOptimistic(file())).rejects.toThrow(
      "You must be logged in to upload.",
    );
    expect(controllerMock.addTile).not.toHaveBeenCalled();
  });

  it("cleans up and removes the tile when the upload fails", async () => {
    const { task, rejectDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { uploadFileOptimistic } = useFileUpload();
    const promise = uploadFileOptimistic(file());
    rejectDone(new Error("upload failed"));

    await expect(promise).rejects.toThrow("upload failed");
    expect(controllerMock.failUploadAndRemoveTile).toHaveBeenCalledWith(
      "upload-1",
    );
    expect(controllerMock.revokeOwnedObjectUrl).not.toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(controllerMock.removeTile).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("uploadFileOptimisticForTile", () => {
  it("replaces the existing tile's content and resolves URL + hash", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);

    const { uploadFileOptimisticForTile } = useFileUpload();
    const promise = uploadFileOptimisticForTile(file(), "tile-9");

    expect(controllerMock.setTileContent).toHaveBeenCalledWith(
      "tile-9",
      expect.objectContaining({ type: ContentType.IMAGE, src: "blob:mock" }),
    );
    expect(controllerMock.startUpload).toHaveBeenCalledWith({
      tileId: "tile-9",
      progress: 0,
      ownedObjectUrl: "blob:mock",
      task,
    });

    resolveDone(archiveResult("https://storage/final.png", "hash-final"));
    await promise;

    expect(controllerMock.resolveUpload).toHaveBeenCalledWith(
      "upload-1",
      "https://storage/final.png",
      "hash-final",
    );
  });

  it("reverts the tile to a suggestion on failure", async () => {
    const { task, rejectDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { uploadFileOptimisticForTile } = useFileUpload();
    const promise = uploadFileOptimisticForTile(file(), "tile-9");
    rejectDone(new Error("boom"));

    await expect(promise).rejects.toThrow("boom");
    expect(
      controllerMock.failUploadAndRestoreTileContent,
    ).toHaveBeenCalledWith(
      "upload-1",
      expect.objectContaining({ type: ContentType.SUGGESTION }),
    );
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.SUGGESTION, {
      action: "media",
      label: "Add Media",
    });
    expect(controllerMock.setTileContent).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });
});

describe("uploadDocumentsOptimistic", () => {
  it("returns immediately for an empty file list", async () => {
    const { uploadDocumentsOptimistic } = useFileUpload();
    await uploadDocumentsOptimistic([]);
    expect(controllerMock.addTile).not.toHaveBeenCalled();
  });

  it("validates each file as a document", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);
    const { uploadDocumentsOptimistic } = useFileUpload();

    const promise = uploadDocumentsOptimistic([file("doc.pdf", "application/pdf")]);
    expect(storage.validateFile).toHaveBeenCalledWith(expect.any(File), {
      fileType: "documents",
    });
    resolveDone(archiveResult("https://storage/doc.pdf", "hash-doc"));
    await promise;
  });

  it("uploads each item, persists the item hash, and saves the grid", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);
    const { uploadDocumentsOptimistic } = useFileUpload();

    const promise = uploadDocumentsOptimistic([file("a.txt", "text/plain")]);
    expect(controllerMock.addTile).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ContentType.DOCUMENT,
        items: [
          expect.objectContaining({
            id: "uuid-1",
            fileName: "a.txt",
            url: "blob:mock",
          }),
        ],
      }),
    );
    resolveDone(archiveResult("https://storage/a.txt", "hash-a", { type: "documents" }));
    await promise;

    expect(controllerMock.startUpload).toHaveBeenCalledWith({
      tileId: "tile-1",
      itemId: "uuid-1",
      progress: 0,
      ownedObjectUrl: "blob:mock",
      task,
    });
    expect(controllerMock.resolveUpload).toHaveBeenCalledWith(
      "upload-1",
      "https://storage/a.txt",
      "hash-a",
      true,
    );
    expect(controllerMock.flushSaves).toHaveBeenCalled();
  });

  it("requests a server thumbnail for PDF items and patches the result", async () => {
    mockDocumentItemIsPdf.mockReturnValue(true);
    mockEnsureThumb.mockResolvedValue({ thumbnailUrl: "https://storage/thumb.png" });
    const { task, resolveDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);

    const { uploadDocumentsOptimistic } = useFileUpload();
    const promise = uploadDocumentsOptimistic([file("doc.pdf", "application/pdf")]);
    resolveDone(archiveResult("https://storage/doc.pdf", "hash-doc", { type: "documents" }));
    await promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(mockEnsureThumb).toHaveBeenCalledWith("grid-1", "tile-1", "uuid-1");
    expect(controllerMock.patchDocumentItem).toHaveBeenCalledWith("tile-1", "uuid-1", {
      thumbnailUrl: "https://storage/thumb.png",
    });
  });

  it("aggregates upload progress across multiple files", async () => {
    const t1 = makeUploadTask();
    const t2 = makeUploadTask();
    storage.uploadArchiveResumable
      .mockReturnValueOnce(t1.task)
      .mockReturnValueOnce(t2.task);

    const { uploadDocumentsOptimistic } = useFileUpload();
    const promise = uploadDocumentsOptimistic([
      file("a.txt", "text/plain"),
      file("b.txt", "text/plain"),
    ]);
    const tick = () => new Promise((r) => setTimeout(r, 0));

    // Halfway through file 1 of 2: (0 + 0.5) / 2 = 0.25
    t1.emitProgress(50, 100);
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.25);

    // Finish file 1: completed becomes 1 → 1/2 = 0.5
    t1.resolveDone(archiveResult("https://storage/a.txt", "hash-a", { type: "documents" }));
    await tick();
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.5);

    // Halfway through file 2: (1 + 0.5) / 2 = 0.75
    t2.emitProgress(50, 100);
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.75);

    t2.resolveDone(archiveResult("https://storage/b.txt", "hash-b", { type: "documents" }));
    await promise;
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 1);
  });

  it("cleans up and removes the tile when a document upload fails", async () => {
    const { task, rejectDone } = makeUploadTask();
    storage.uploadArchiveResumable.mockReturnValue(task);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { uploadDocumentsOptimistic } = useFileUpload();
    const promise = uploadDocumentsOptimistic([file("a.txt")]);
    rejectDone(new Error("doc failed"));

    await expect(promise).rejects.toThrow("doc failed");
    expect(controllerMock.failUploadAndRemoveTile).toHaveBeenCalledWith(
      "upload-1",
    );
    expect(controllerMock.removeTile).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("throws when not logged in", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadDocumentsOptimistic } = useFileUpload();
    await expect(
      uploadDocumentsOptimistic([file("a.txt")]),
    ).rejects.toThrow("You must be logged in to upload.");
  });
});

describe("uploadExternalImageToStorage / uploadExternalImageToArchive", () => {
  it("delegates to the storage service and returns the URL", async () => {
    storage.uploadExternalImageToArchive.mockResolvedValue(
      archiveResult("https://storage/ext.png", "hash-ext"),
    );
    const { uploadExternalImageToStorage } = useFileUpload();
    const url = await uploadExternalImageToStorage("https://remote/x.png");
    expect(storage.uploadExternalImageToArchive).toHaveBeenCalledWith(
      "user-1",
      "https://remote/x.png",
    );
    expect(url).toBe("https://storage/ext.png");
  });

  it("returns the structured result (url + hash)", async () => {
    const result = archiveResult("https://storage/ext.png", "hash-ext");
    storage.uploadExternalImageToArchive.mockResolvedValue(result);
    const { uploadExternalImageToArchive } = useFileUpload();
    expect(await uploadExternalImageToArchive("https://remote/x.png")).toEqual(
      result,
    );
  });

  it("throws when not logged in", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadExternalImageToStorage } = useFileUpload();
    await expect(
      uploadExternalImageToStorage("https://remote/x.png"),
    ).rejects.toThrow("You must be logged in to upload.");
  });
});
