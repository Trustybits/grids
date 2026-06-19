import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentType } from "@grids/contracts/types";

const mocks = vi.hoisted(() => ({
  currentUserId: vi.fn(),
  storageService: {
    upload: vi.fn(),
    validateFile: vi.fn(),
    uploadResumable: vi.fn(),
    uploadExternalImage: vi.fn(),
  },
  gridStore: {
    currentGrid: { id: "grid-1" } as { id: string } | null,
    addTile: vi.fn(),
    setTileContent: vi.fn(),
    setTileUploading: vi.fn(),
    clearTileUploading: vi.fn(),
    setResolvedUrl: vi.fn(),
    setResolvedDocumentItemUrl: vi.fn(),
    updateGrid: vi.fn(),
    removeTile: vi.fn(),
    saveGrid: vi.fn(),
    patchDocumentItem: vi.fn(),
  },
  createTileContent: vi.fn(),
  ensureThumbnail: vi.fn(),
  documentItemIsPdf: vi.fn(),
  uuid: vi.fn(),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({
    getCurrentUserId: mocks.currentUserId,
  }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getStorageService: () => mocks.storageService,
  }),
}));

vi.mock("@/stores/grid", () => ({
  useGridStore: () => mocks.gridStore,
}));

vi.mock("@/utils/TileUtils", () => ({
  createTileContent: (
    type: ContentType,
    data: Record<string, unknown>,
  ) => mocks.createTileContent(type, data),
}));

vi.mock("@/composables/useDocumentThumbnail", () => ({
  ensureDocumentItemThumbnailOnServer: (
    gridId: string,
    tileId: string,
    itemId: string,
  ) => mocks.ensureThumbnail(gridId, tileId, itemId),
  documentItemIsPdf: (name: string, type: string) =>
    mocks.documentItemIsPdf(name, type),
}));

vi.mock("uuid", () => ({
  v4: () => mocks.uuid(),
}));

type Progress = { bytesTransferred: number; totalBytes: number };

function makeUploadTask(result: Promise<string>) {
  let progressHandler: ((progress: Progress) => void) | undefined;
  return {
    task: {
      onProgress: vi.fn((handler: (progress: Progress) => void) => {
        progressHandler = handler;
      }),
      done: vi.fn(() => result),
      cancel: vi.fn(),
    },
    emitProgress(progress: Progress) {
      progressHandler?.(progress);
    },
  };
}

describe("useFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUserId.mockReturnValue("user-1");
    mocks.storageService.validateFile.mockReturnValue({ isImage: true });
    mocks.storageService.upload.mockResolvedValue("https://cdn.example/file");
    mocks.storageService.uploadExternalImage.mockResolvedValue(
      "https://cdn.example/external",
    );
    mocks.gridStore.currentGrid = { id: "grid-1" };
    mocks.gridStore.addTile.mockReturnValue("tile-1");
    mocks.gridStore.saveGrid.mockResolvedValue(undefined);
    mocks.createTileContent.mockImplementation(
      (type: ContentType, data: Record<string, unknown>) => ({
        type,
        ...data,
      }),
    );
    mocks.uuid
      .mockReturnValueOnce("item-1")
      .mockReturnValueOnce("item-2");
    mocks.documentItemIsPdf.mockReturnValue(false);
    mocks.ensureThumbnail.mockResolvedValue({});
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi
        .fn()
        .mockReturnValueOnce("blob:one")
        .mockReturnValueOnce("blob:two"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("uploads directly and creates image or video tile content", async () => {
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const upload = useFileUpload();
    const image = new File(["image"], "image.png", { type: "image/png" });
    const video = new File(["video"], "video.mp4", { type: "video/mp4" });

    await expect(
      upload.uploadFileToUrl(image, { fileType: "images" }),
    ).resolves.toBe("https://cdn.example/file");
    expect(mocks.storageService.upload).toHaveBeenCalledWith(
      "user-1",
      image,
      { fileType: "images" },
    );

    await expect(upload.uploadFile(image)).resolves.toEqual({
      type: ContentType.IMAGE,
      src: "https://cdn.example/file",
    });
    await expect(upload.uploadFile(video)).resolves.toEqual({
      type: ContentType.VIDEO,
      src: "https://cdn.example/file",
    });
  });

  it("rejects direct and external uploads without authentication", async () => {
    mocks.currentUserId.mockReturnValue(null);
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const upload = useFileUpload();
    const file = new File(["image"], "image.png", { type: "image/png" });

    await expect(upload.uploadFileToUrl(file)).rejects.toThrow(
      "You must be logged in to upload.",
    );
    await expect(
      upload.uploadExternalImageToStorage("https://example.com/image.png"),
    ).rejects.toThrow("You must be logged in to upload.");
  });

  it("tracks an optimistic new-tile upload and resolves it without replacing preview content", async () => {
    let resolveUpload!: (url: string) => void;
    const result = new Promise<string>((resolve) => {
      resolveUpload = resolve;
    });
    const uploadTask = makeUploadTask(result);
    mocks.storageService.uploadResumable.mockReturnValue(uploadTask.task);
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const upload = useFileUpload();
    const file = new File(["image"], "image.png", { type: "image/png" });

    const pending = upload.uploadFileOptimistic(file, {
      fileType: "images",
    });
    expect(mocks.gridStore.addTile).toHaveBeenCalledWith({
      type: ContentType.IMAGE,
      src: "blob:one",
    });
    expect(mocks.gridStore.setTileUploading).toHaveBeenCalledWith(
      "tile-1",
      0,
    );

    uploadTask.emitProgress({ bytesTransferred: 25, totalBytes: 100 });
    expect(mocks.gridStore.setTileUploading).toHaveBeenLastCalledWith(
      "tile-1",
      0.25,
    );

    resolveUpload("https://cdn.example/image");
    await pending;

    expect(mocks.gridStore.setResolvedUrl).toHaveBeenCalledWith(
      "tile-1",
      "https://cdn.example/image",
    );
    expect(mocks.gridStore.clearTileUploading).toHaveBeenCalledWith("tile-1");
    expect(mocks.gridStore.updateGrid).toHaveBeenCalledTimes(1);
    expect(mocks.gridStore.setTileContent).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes the preview when optimistic tile creation is rejected", async () => {
    mocks.gridStore.addTile.mockReturnValue(null);
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const file = new File(["image"], "image.png", { type: "image/png" });

    await useFileUpload().uploadFileOptimistic(file);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(mocks.storageService.uploadResumable).not.toHaveBeenCalled();
  });

  it("cleans up and removes a new tile when optimistic upload fails", async () => {
    const failure = new Error("upload failed");
    const uploadTask = makeUploadTask(Promise.reject(failure));
    mocks.storageService.uploadResumable.mockReturnValue(uploadTask.task);
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const file = new File(["video"], "video.mp4", { type: "video/mp4" });
    mocks.storageService.validateFile.mockReturnValue({ isImage: false });

    await expect(
      useFileUpload().uploadFileOptimistic(file),
    ).rejects.toThrow("upload failed");

    expect(mocks.gridStore.clearTileUploading).toHaveBeenCalledWith("tile-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(mocks.gridStore.removeTile).toHaveBeenCalledWith("tile-1");
  });

  it("reverts an existing tile to a suggestion when upload fails", async () => {
    const uploadTask = makeUploadTask(
      Promise.reject(new Error("upload failed")),
    );
    mocks.storageService.uploadResumable.mockReturnValue(uploadTask.task);
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const file = new File(["image"], "image.png", { type: "image/png" });

    await expect(
      useFileUpload().uploadFileOptimisticForTile(file, "existing"),
    ).rejects.toThrow("upload failed");

    expect(mocks.gridStore.setTileContent).toHaveBeenNthCalledWith(
      1,
      "existing",
      { type: ContentType.IMAGE, src: "blob:one" },
    );
    expect(mocks.gridStore.setTileContent).toHaveBeenNthCalledWith(
      2,
      "existing",
      {
        type: ContentType.SUGGESTION,
        action: "media",
        label: "Add Media",
      },
    );
    expect(mocks.gridStore.removeTile).not.toHaveBeenCalled();
  });

  it("uploads document items sequentially, tracks aggregate progress, and saves resolved URLs", async () => {
    const firstTask = makeUploadTask(
      Promise.resolve("https://cdn.example/one"),
    );
    const secondTask = makeUploadTask(
      Promise.resolve("https://cdn.example/two"),
    );
    mocks.storageService.uploadResumable
      .mockReturnValueOnce(firstTask.task)
      .mockReturnValueOnce(secondTask.task);
    mocks.documentItemIsPdf.mockImplementation((name: string) =>
      name.endsWith(".pdf"),
    );
    mocks.ensureThumbnail.mockResolvedValue({
      thumbnailUrl: "https://cdn.example/thumb",
    });
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const files = [
      new File(["one"], "one.pdf", { type: "application/pdf" }),
      new File(["two"], "two.txt", { type: "text/plain" }),
    ];

    await useFileUpload().uploadDocumentsOptimistic(files);

    expect(mocks.storageService.validateFile).toHaveBeenCalledTimes(2);
    expect(mocks.gridStore.addTile).toHaveBeenCalledWith({
      type: ContentType.DOCUMENT,
      items: [
        {
          id: "item-1",
          fileName: "one.pdf",
          url: "blob:one",
          mimeType: "application/pdf",
        },
        {
          id: "item-2",
          fileName: "two.txt",
          url: "blob:two",
          mimeType: "text/plain",
        },
      ],
    });
    expect(mocks.gridStore.setResolvedDocumentItemUrl).toHaveBeenNthCalledWith(
      1,
      "tile-1",
      "item-1",
      "https://cdn.example/one",
    );
    expect(mocks.gridStore.setResolvedDocumentItemUrl).toHaveBeenNthCalledWith(
      2,
      "tile-1",
      "item-2",
      "https://cdn.example/two",
    );
    expect(mocks.gridStore.setTileUploading).toHaveBeenCalledWith(
      "tile-1",
      0.5,
    );
    expect(mocks.gridStore.setTileUploading).toHaveBeenCalledWith(
      "tile-1",
      1,
    );
    expect(mocks.gridStore.clearTileUploading).toHaveBeenCalledWith("tile-1");
    expect(mocks.gridStore.saveGrid).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(mocks.gridStore.patchDocumentItem).toHaveBeenCalledWith(
        "tile-1",
        "item-1",
        { thumbnailUrl: "https://cdn.example/thumb" },
      );
    });
  });

  it("revokes every document preview and removes the tile after a failed upload", async () => {
    const firstTask = makeUploadTask(
      Promise.resolve("https://cdn.example/one"),
    );
    const secondTask = makeUploadTask(
      Promise.reject(new Error("second failed")),
    );
    mocks.storageService.uploadResumable
      .mockReturnValueOnce(firstTask.task)
      .mockReturnValueOnce(secondTask.task);
    const { useFileUpload } = await import("@/composables/useFileUpload");
    const files = [
      new File(["one"], "one.pdf", { type: "application/pdf" }),
      new File(["two"], "two.pdf", { type: "application/pdf" }),
    ];

    await expect(
      useFileUpload().uploadDocumentsOptimistic(files),
    ).rejects.toThrow("second failed");

    expect(mocks.gridStore.clearTileUploading).toHaveBeenCalledWith("tile-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:two");
    expect(mocks.gridStore.removeTile).toHaveBeenCalledWith("tile-1");
  });

  it("uploads an external image for the authenticated user", async () => {
    const { useFileUpload } = await import("@/composables/useFileUpload");

    await expect(
      useFileUpload().uploadExternalImageToStorage(
        "https://example.com/image.png",
        "backgrounds",
      ),
    ).resolves.toBe("https://cdn.example/external");
    expect(mocks.storageService.uploadExternalImage).toHaveBeenCalledWith(
      "user-1",
      "https://example.com/image.png",
      "backgrounds",
    );
  });
});
