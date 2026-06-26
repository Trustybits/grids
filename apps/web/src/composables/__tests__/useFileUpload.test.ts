/**
 * Tests for useFileUpload — upload flows that turn Files into tiles (direct,
 * optimistic-new, optimistic-existing, multi-document) plus external image
 * import. Every collaborator is mocked: auth provider, storage service, grid
 * store, TileUtils.createTileContent, the document-thumbnail helpers, uuid, and
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
    upload: vi.fn(),
    validateFile: vi.fn(() => ({ isImage: true })),
    uploadResumable: vi.fn(),
    uploadExternalImage: vi.fn(),
  };
  // `controllerMock` holds the upload/tile commands now owned by the controller.
  const controllerMock = {
    addTile: vi.fn<() => string | null>(() => "tile-1"),
    setTileContent: vi.fn(),
    startUpload: vi.fn(() => "upload-1" as string | null),
    progressUpload: vi.fn(),
    resolveUpload: vi.fn(() => true),
    failUpload: vi.fn(() => true),
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
  // The grid id is read from the focused session store.
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

/** A resolvable upload task: control progress and completion explicitly. */
function makeUploadTask() {
  let progressCb: ((p: { bytesTransferred: number; totalBytes: number }) => void) | null =
    null;
  let resolveDone!: (url: string) => void;
  let rejectDone!: (err: unknown) => void;
  const donePromise = new Promise<string>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  return {
    task: {
      onProgress: vi.fn((cb) => {
        progressCb = cb;
      }),
      done: vi.fn(() => donePromise),
      cancel: vi.fn(),
    },
    emitProgress: (bytesTransferred: number, totalBytes: number) =>
      progressCb?.({ bytesTransferred, totalBytes }),
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

describe("uploadFileToUrl", () => {
  it("uploads and returns the storage URL", async () => {
    storage.upload.mockResolvedValue("https://storage/a.png");
    const { uploadFileToUrl } = useFileUpload();
    const url = await uploadFileToUrl(file(), { fileType: "images" });
    expect(storage.upload).toHaveBeenCalledWith("user-1", expect.any(File), {
      fileType: "images",
    });
    expect(url).toBe("https://storage/a.png");
  });

  it("throws when not logged in", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadFileToUrl } = useFileUpload();
    await expect(uploadFileToUrl(file())).rejects.toThrow(
      "You must be logged in to upload.",
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("logs and rethrows when the storage upload fails", async () => {
    storage.upload.mockRejectedValue(new Error("storage down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { uploadFileToUrl } = useFileUpload();
    await expect(uploadFileToUrl(file())).rejects.toThrow("storage down");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("uploadFileToUrlWithProgress", () => {
  it("uploads resumably, reports progress as a fraction, and returns the URL", async () => {
    const { task, emitProgress, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);
    const onProgress = vi.fn();

    const { uploadFileToUrlWithProgress } = useFileUpload();
    const promise = uploadFileToUrlWithProgress(
      file(),
      { fileType: "images" },
      onProgress,
    );

    expect(storage.uploadResumable).toHaveBeenCalledWith(
      "user-1",
      expect.any(File),
      { fileType: "images" },
    );

    emitProgress(25, 100);
    expect(onProgress).toHaveBeenCalledWith(0.25);

    resolveDone("https://storage/avatar.png");
    expect(await promise).toBe("https://storage/avatar.png");
  });

  it("reports a 0 fraction when total bytes are unknown", async () => {
    const { task, emitProgress, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);
    const onProgress = vi.fn();

    const { uploadFileToUrlWithProgress } = useFileUpload();
    const promise = uploadFileToUrlWithProgress(file(), {}, onProgress);

    emitProgress(0, 0);
    expect(onProgress).toHaveBeenCalledWith(0);

    resolveDone("https://x");
    await promise;
  });

  it("works without an onProgress callback", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadFileToUrlWithProgress } = useFileUpload();
    const promise = uploadFileToUrlWithProgress(file());

    expect(task.onProgress).not.toHaveBeenCalled();
    resolveDone("https://storage/avatar.png");
    expect(await promise).toBe("https://storage/avatar.png");
  });

  it("throws when not logged in", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadFileToUrlWithProgress } = useFileUpload();
    await expect(uploadFileToUrlWithProgress(file())).rejects.toThrow(
      "You must be logged in to upload.",
    );
    expect(storage.uploadResumable).not.toHaveBeenCalled();
  });

  it("logs and rethrows when the upload fails", async () => {
    const { task, rejectDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { uploadFileToUrlWithProgress } = useFileUpload();
    const promise = uploadFileToUrlWithProgress(file());
    rejectDone(new Error("storage down"));

    await expect(promise).rejects.toThrow("storage down");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("uploadFile", () => {
  it("returns IMAGE content for an image file", async () => {
    storage.upload.mockResolvedValue("https://storage/a.png");
    const { uploadFile } = useFileUpload();
    const content = await uploadFile(file("a.png", "image/png"));
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.IMAGE, {
      src: "https://storage/a.png",
    });
    expect(content).toMatchObject({ type: ContentType.IMAGE });
  });

  it("returns VIDEO content for a non-image file", async () => {
    storage.upload.mockResolvedValue("https://storage/a.mp4");
    const { uploadFile } = useFileUpload();
    const content = await uploadFile(file("a.mp4", "video/mp4"));
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.VIDEO, {
      src: "https://storage/a.mp4",
    });
    expect(content).toMatchObject({ type: ContentType.VIDEO });
  });
});

describe("uploadFileOptimistic", () => {
  it("creates a tile with a blob preview, then resolves the permanent URL", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadFileOptimistic } = useFileUpload();
    const promise = uploadFileOptimistic(file());

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(controllerMock.addTile).toHaveBeenCalled();
    expect(controllerMock.startUpload).toHaveBeenCalledWith({
      tileId: "tile-1",
      progress: 0,
      ownedObjectUrl: "blob:mock",
      task,
    });

    resolveDone("https://storage/final.png");
    await promise;

    expect(controllerMock.resolveUpload).toHaveBeenCalledWith(
      "upload-1",
      "https://storage/final.png",
    );
  });

  it("reports upload progress as a fraction", async () => {
    const { task, emitProgress, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadFileOptimistic } = useFileUpload();
    const promise = uploadFileOptimistic(file());

    emitProgress(25, 100);
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.25);

    resolveDone("https://x");
    await promise;
  });

  it("revokes the blob through the owned-URL ledger and bails when the tile cannot be created", async () => {
    controllerMock.addTile.mockReturnValue(null);
    const { uploadFileOptimistic } = useFileUpload();
    await uploadFileOptimistic(file());
    expect(controllerMock.revokeOwnedObjectUrl).toHaveBeenCalledWith("blob:mock");
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(storage.uploadResumable).not.toHaveBeenCalled();
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
    storage.uploadResumable.mockReturnValue(task);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { uploadFileOptimistic } = useFileUpload();
    const promise = uploadFileOptimistic(file());
    rejectDone(new Error("upload failed"));

    await expect(promise).rejects.toThrow("upload failed");
    expect(controllerMock.failUpload).toHaveBeenCalledWith("upload-1");
    // Cleanup is delegated to failUpload; useFileUpload never revokes directly.
    expect(controllerMock.revokeOwnedObjectUrl).not.toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(controllerMock.removeTile).toHaveBeenCalledWith("tile-1");
    errSpy.mockRestore();
  });
});

describe("uploadFileOptimisticForTile", () => {
  it("replaces the existing tile's content and resolves the permanent URL", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadFileOptimisticForTile } = useFileUpload();
    const promise = uploadFileOptimisticForTile(file(), "tile-9");

    expect(controllerMock.setTileContent).toHaveBeenCalledWith(
      "tile-9",
      expect.objectContaining({ type: ContentType.IMAGE }),
    );
    expect(controllerMock.startUpload).toHaveBeenCalledWith({
      tileId: "tile-9",
      progress: 0,
      ownedObjectUrl: "blob:mock",
      task,
    });

    resolveDone("https://storage/final.png");
    await promise;

    expect(controllerMock.resolveUpload).toHaveBeenCalledWith(
      "upload-1",
      "https://storage/final.png",
    );
  });

  it("reports upload progress as a fraction for the existing tile", async () => {
    const { task, emitProgress, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadFileOptimisticForTile } = useFileUpload();
    const promise = uploadFileOptimisticForTile(file(), "tile-9");

    emitProgress(30, 120);
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.25);

    resolveDone("https://x");
    await promise;
  });

  it("reverts the tile to a suggestion on failure", async () => {
    const { task, rejectDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { uploadFileOptimisticForTile } = useFileUpload();
    const promise = uploadFileOptimisticForTile(file(), "tile-9");
    rejectDone(new Error("boom"));

    await expect(promise).rejects.toThrow("boom");
    expect(controllerMock.failUpload).toHaveBeenCalledWith("upload-1");
    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.SUGGESTION, {
      action: "media",
      label: "Add Media",
    });
    expect(controllerMock.setTileContent).toHaveBeenLastCalledWith(
      "tile-9",
      expect.objectContaining({ type: ContentType.SUGGESTION }),
    );
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
    storage.uploadResumable.mockReturnValue(task);
    const { uploadDocumentsOptimistic } = useFileUpload();

    const promise = uploadDocumentsOptimistic([file("doc.pdf", "application/pdf")]);
    expect(storage.validateFile).toHaveBeenCalledWith(expect.any(File), {
      fileType: "documents",
    });
    resolveDone("https://storage/doc.pdf");
    await promise;
  });

  it("uploads each item and saves the grid", async () => {
    const { task, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);
    const { uploadDocumentsOptimistic } = useFileUpload();

    const promise = uploadDocumentsOptimistic([file("a.txt", "text/plain")]);
    expect(controllerMock.addTile).toHaveBeenCalledWith(
      expect.objectContaining({ type: ContentType.DOCUMENT }),
    );
    resolveDone("https://storage/a.txt");
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
      true,
    );
    expect(controllerMock.flushSaves).toHaveBeenCalled();
  });

  it("requests a server thumbnail for PDF items and patches the result", async () => {
    mockDocumentItemIsPdf.mockReturnValue(true);
    mockEnsureThumb.mockResolvedValue({ thumbnailUrl: "https://storage/thumb.png" });
    const { task, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadDocumentsOptimistic } = useFileUpload();
    const promise = uploadDocumentsOptimistic([file("doc.pdf", "application/pdf")]);
    resolveDone("https://storage/doc.pdf");
    await promise;
    // Thumbnail jobs are fire-and-forget; flush the microtask queue.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockEnsureThumb).toHaveBeenCalledWith("grid-1", "tile-1", "uuid-1");
    expect(controllerMock.patchDocumentItem).toHaveBeenCalledWith("tile-1", "uuid-1", {
      thumbnailUrl: "https://storage/thumb.png",
    });
  });

  it("waits for the document save before requesting server thumbnails", async () => {
    mockDocumentItemIsPdf.mockReturnValue(true);
    let resolveSave!: () => void;
    controllerMock.flushSaves.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { task, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadDocumentsOptimistic } = useFileUpload();
    const promise = uploadDocumentsOptimistic([file("doc.pdf", "application/pdf")]);
    resolveDone("https://storage/doc.pdf");
    await Promise.resolve();
    await Promise.resolve();

    expect(controllerMock.flushSaves).toHaveBeenCalledTimes(1);
    expect(mockEnsureThumb).not.toHaveBeenCalled();

    resolveSave();
    await promise;
    await Promise.resolve();

    expect(mockEnsureThumb).toHaveBeenCalledWith("grid-1", "tile-1", "uuid-1");
  });

  it("aggregates progress across multiple files", async () => {
    const t1 = makeUploadTask();
    const t2 = makeUploadTask();
    storage.uploadResumable
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
    t1.resolveDone("https://storage/a.txt");
    await tick();
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.5);

    // Halfway through file 2: (1 + 0.5) / 2 = 0.75
    t2.emitProgress(50, 100);
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 0.75);

    t2.resolveDone("https://storage/b.txt");
    await promise;
    expect(controllerMock.progressUpload).toHaveBeenCalledWith("upload-1", 1);
  });

  it("does not request a thumbnail for non-PDF items", async () => {
    mockDocumentItemIsPdf.mockReturnValue(false);
    const { task, resolveDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);

    const { uploadDocumentsOptimistic } = useFileUpload();
    const promise = uploadDocumentsOptimistic([file("a.txt", "text/plain")]);
    resolveDone("https://storage/a.txt");
    await promise;
    await Promise.resolve();

    expect(mockEnsureThumb).not.toHaveBeenCalled();
    expect(controllerMock.patchDocumentItem).not.toHaveBeenCalled();
  });

  it("validates files before the login check (validation runs even logged out)", async () => {
    mockGetCurrentUserId.mockReturnValue(null);
    const { uploadDocumentsOptimistic } = useFileUpload();

    await expect(
      uploadDocumentsOptimistic([file("a.txt", "text/plain")]),
    ).rejects.toThrow("You must be logged in to upload.");

    // Per source ordering, each file is validated before the auth guard runs.
    expect(storage.validateFile).toHaveBeenCalledWith(expect.any(File), {
      fileType: "documents",
    });
    expect(controllerMock.addTile).not.toHaveBeenCalled();
  });

  it("revokes all blob URLs through the owned-URL ledger and bails when the tile cannot be created", async () => {
    controllerMock.addTile.mockReturnValue(null);
    const { uploadDocumentsOptimistic } = useFileUpload();
    await uploadDocumentsOptimistic([file("a.txt"), file("b.txt")]);
    expect(controllerMock.revokeOwnedObjectUrl).toHaveBeenCalledTimes(2);
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(storage.uploadResumable).not.toHaveBeenCalled();
  });

  it("cleans up and removes the tile when a document upload fails", async () => {
    const { task, rejectDone } = makeUploadTask();
    storage.uploadResumable.mockReturnValue(task);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { uploadDocumentsOptimistic } = useFileUpload();
    const promise = uploadDocumentsOptimistic([file("a.txt")]);
    rejectDone(new Error("doc failed"));

    await expect(promise).rejects.toThrow("doc failed");
    expect(controllerMock.failUpload).toHaveBeenCalledWith("upload-1");
    // Cleanup is delegated to failUpload; useFileUpload never revokes directly.
    expect(controllerMock.revokeOwnedObjectUrl).not.toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(controllerMock.removeTile).toHaveBeenCalledWith("tile-1");
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

describe("uploadExternalImageToStorage", () => {
  it("delegates to the storage service with the default folder", async () => {
    storage.uploadExternalImage.mockResolvedValue("https://storage/ext.png");
    const { uploadExternalImageToStorage } = useFileUpload();
    const url = await uploadExternalImageToStorage("https://remote/x.png");
    expect(storage.uploadExternalImage).toHaveBeenCalledWith(
      "user-1",
      "https://remote/x.png",
      "images",
    );
    expect(url).toBe("https://storage/ext.png");
  });

  it("passes through a custom folder", async () => {
    storage.uploadExternalImage.mockResolvedValue("https://storage/ext.png");
    const { uploadExternalImageToStorage } = useFileUpload();
    await uploadExternalImageToStorage("https://remote/x.png", "avatars");
    expect(storage.uploadExternalImage).toHaveBeenCalledWith(
      "user-1",
      "https://remote/x.png",
      "avatars",
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
