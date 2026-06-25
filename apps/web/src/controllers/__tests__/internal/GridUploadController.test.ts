import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GridUploadController } from "../../internal/GridUploadController";
import {
  createHarness,
  makeDocumentTile,
  makeGrid,
  makeImageTile,
  type InternalHarness,
} from "./harness";

/**
 * Tests for GridUploadController — the upload lifecycle gatekeeper. It guards
 * the uploads store against stale/invalid uploads (wrong scope, missing
 * target, superseded generation) and wires resolved urls into history +
 * persistence.
 */

describe("GridUploadController", () => {
  let h: InternalHarness;
  let scheduleSave: Mock<() => void>;
  let controller: GridUploadController;

  beforeEach(() => {
    vi.clearAllMocks();
    h = createHarness();
    scheduleSave = vi.fn<() => void>();
    controller = new GridUploadController(h.stores, scheduleSave);
  });

  function seedImageGrid(tileId = "tile-1") {
    h.stores.session.setCurrentGrid(
      makeGrid({ tiles: [makeImageTile({ i: tileId })] }),
    );
  }

  describe("startUpload", () => {
    it("returns null when there is no active grid (no persistence scope)", () => {
      expect(controller.startUpload({ tileId: "tile-1" })).toBeNull();
    });

    it("returns null when the target tile does not exist", () => {
      seedImageGrid("tile-1");
      expect(controller.startUpload({ tileId: "missing" })).toBeNull();
    });

    it("returns null when the document item target does not exist", () => {
      h.stores.session.setCurrentGrid(
        makeGrid({ tiles: [makeDocumentTile({ i: "tile-doc" })] }),
      );
      expect(
        controller.startUpload({ tileId: "tile-doc", itemId: "ghost" }),
      ).toBeNull();
    });

    it("rejects a document item target on a non-document tile", () => {
      seedImageGrid("tile-1");
      expect(
        controller.startUpload({ tileId: "tile-1", itemId: "item-1" }),
      ).toBeNull();
    });

    it("starts an upload scoped to the active grid and session", () => {
      seedImageGrid("tile-1");
      const generation = h.stores.session.sessionGeneration;

      const id = controller.startUpload({
        tileId: "tile-1",
        ownedObjectUrl: "blob:owned",
        progress: 0.25,
      });

      expect(id).toBe("upload-1");
      expect(h.stores.uploads.uploadRecords["upload-1"]).toEqual(
        expect.objectContaining({
          gridId: "grid-1",
          sessionGeneration: generation,
          tileId: "tile-1",
          status: "active",
          progress: 0.25,
        }),
      );
    });

    it("uses a caller-supplied upload id verbatim", () => {
      seedImageGrid("tile-1");

      const id = controller.startUpload({
        tileId: "tile-1",
        uploadId: "custom-id",
      });

      expect(id).toBe("custom-id");
      expect(h.stores.uploads.uploadRecords["custom-id"]).toBeDefined();
    });

    it("accepts a document item upload when the item exists", () => {
      h.stores.session.setCurrentGrid(
        makeGrid({ tiles: [makeDocumentTile({ i: "tile-doc" })] }),
      );
      const id = controller.startUpload({
        tileId: "tile-doc",
        itemId: "item-1",
      });
      expect(id).not.toBeNull();
    });
  });

  describe("progressUpload", () => {
    it("updates progress for a valid active upload", () => {
      seedImageGrid("tile-1");
      const id = controller.startUpload({ tileId: "tile-1" })!;
      expect(controller.progressUpload(id, 0.5)).toBe(true);
      expect(h.stores.uploads.uploadingTiles["tile-1"]).toBe(0.5);
    });

    it("abandons and reports false for an unknown upload id", () => {
      const abandon = vi.spyOn(h.stores.uploads, "abandonUpload");
      expect(controller.progressUpload("nope", 0.5)).toBe(false);
      expect(abandon).toHaveBeenCalledWith("nope");
    });

    it("abandons an upload whose tile was removed from the grid", () => {
      seedImageGrid("tile-1");
      const id = controller.startUpload({ tileId: "tile-1" })!;
      h.stores.session.currentGrid!.tiles = [];

      expect(controller.progressUpload(id, 0.5)).toBe(false);
      expect(h.stores.uploads.uploadRecords[id]?.status).toBe("abandoned");
    });
  });

  describe("resolveUpload", () => {
    it("resolves a media upload and patches history with the final url", () => {
      seedImageGrid("tile-1");
      const replaceBlobUrl = vi.spyOn(h.stores.history, "replaceBlobUrl");
      const id = controller.startUpload({ tileId: "tile-1" })!;

      expect(controller.resolveUpload(id, "https://cdn/media")).toBe(true);
      expect(h.stores.uploads.resolvedUrls["tile-1"]).toBe(
        "https://cdn/media",
      );
      expect(replaceBlobUrl).toHaveBeenCalledWith(
        "tile-1",
        "https://cdn/media",
      );
      expect(scheduleSave).toHaveBeenCalledTimes(1);
    });

    it("keeps the tile marked uploading when not final", () => {
      seedImageGrid("tile-1");
      const id = controller.startUpload({ tileId: "tile-1" })!;
      controller.progressUpload(id, 0.5);
      expect(h.stores.uploads.uploadingTiles["tile-1"]).toBe(0.5);

      expect(controller.resolveUpload(id, "https://cdn/media", false)).toBe(
        true,
      );

      // final=false leaves the uploading indicator in place for the tile.
      expect(h.stores.uploads.uploadingTiles["tile-1"]).toBe(0.5);
      expect(h.stores.uploads.resolvedUrls["tile-1"]).toBe(
        "https://cdn/media",
      );
    });

    it("resolves a document item upload and passes the item id to history", () => {
      h.stores.session.setCurrentGrid(
        makeGrid({ tiles: [makeDocumentTile({ i: "tile-doc" })] }),
      );
      const replaceBlobUrl = vi.spyOn(h.stores.history, "replaceBlobUrl");
      const id = controller.startUpload({
        tileId: "tile-doc",
        itemId: "item-1",
      })!;

      expect(controller.resolveUpload(id, "https://cdn/doc")).toBe(true);
      expect(replaceBlobUrl).toHaveBeenCalledWith(
        "tile-doc",
        "https://cdn/doc",
        "item-1",
      );
    });

    it("abandons and returns false when the active session changed", () => {
      seedImageGrid("tile-1");
      const id = controller.startUpload({ tileId: "tile-1" })!;
      const replaceBlobUrl = vi.spyOn(h.stores.history, "replaceBlobUrl");
      h.stores.session.setCurrentGrid(makeGrid({ id: "grid-2" }));

      expect(controller.resolveUpload(id, "https://cdn/media")).toBe(false);
      expect(h.stores.uploads.uploadRecords[id]?.status).toBe("abandoned");
      expect(replaceBlobUrl).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("returns false without history/persistence when the store cannot resolve", () => {
      seedImageGrid("tile-1");
      const id = controller.startUpload({ tileId: "tile-1" })!;
      // A superseded upload validates by scope but the store refuses to resolve.
      vi.spyOn(h.stores.uploads, "resolveUpload").mockReturnValueOnce(false);
      const replaceBlobUrl = vi.spyOn(h.stores.history, "replaceBlobUrl");

      expect(controller.resolveUpload(id, "https://cdn/media")).toBe(false);
      expect(replaceBlobUrl).not.toHaveBeenCalled();
      expect(scheduleSave).not.toHaveBeenCalled();
    });

    it("abandons an upload superseded by a newer upload on the same target", () => {
      seedImageGrid("tile-1");
      const first = controller.startUpload({ tileId: "tile-1" })!;
      const second = controller.startUpload({ tileId: "tile-1" })!;

      // The first upload is no longer the current generation for the tile.
      expect(controller.resolveUpload(first, "https://cdn/a")).toBe(false);
      expect(controller.resolveUpload(second, "https://cdn/b")).toBe(true);
    });
  });

  describe("failUpload", () => {
    it("fails a valid active upload", () => {
      seedImageGrid("tile-1");
      const id = controller.startUpload({ tileId: "tile-1" })!;
      expect(controller.failUpload(id)).toBe(true);
      expect(h.stores.uploads.uploadRecords[id]?.status).toBe("failed");
    });

    it("abandons and returns false for an invalid upload", () => {
      const abandon = vi.spyOn(h.stores.uploads, "abandonUpload");
      expect(controller.failUpload("nope")).toBe(false);
      expect(abandon).toHaveBeenCalledWith("nope");
    });
  });

  describe("plain store delegation", () => {
    it("abandonUpload, cancelUpload and revokeOwnedObjectUrl pass through", () => {
      const abandon = vi
        .spyOn(h.stores.uploads, "abandonUpload")
        .mockReturnValue(true);
      const cancel = vi
        .spyOn(h.stores.uploads, "cancelUpload")
        .mockReturnValue(true);
      const revoke = vi
        .spyOn(h.stores.uploads, "revokeOwnedObjectUrl")
        .mockReturnValue(true);

      expect(controller.abandonUpload("u")).toBe(true);
      expect(abandon).toHaveBeenCalledWith("u");
      expect(controller.cancelUpload("u")).toBe(true);
      expect(cancel).toHaveBeenCalledWith("u");
      expect(controller.revokeOwnedObjectUrl("blob:x")).toBe(true);
      expect(revoke).toHaveBeenCalledWith("blob:x");
    });

    it("set/clear tile uploading delegates to the store", () => {
      controller.setTileUploading("tile-1", 0.3);
      expect(h.stores.uploads.uploadingTiles["tile-1"]).toBe(0.3);
      controller.clearTileUploading("tile-1");
      expect(h.stores.uploads.uploadingTiles["tile-1"]).toBeUndefined();
    });

    it("setResolvedUrl stores the url then patches history", () => {
      const setResolved = vi.spyOn(h.stores.uploads, "setResolvedUrl");
      const replace = vi.spyOn(h.stores.history, "replaceBlobUrl");

      controller.setResolvedUrl("tile-1", "https://cdn/media");

      expect(h.stores.uploads.resolvedUrls["tile-1"]).toBe(
        "https://cdn/media",
      );
      expect(replace).toHaveBeenCalledWith("tile-1", "https://cdn/media");
      expect(
        setResolved.mock.invocationCallOrder[0]!,
      ).toBeLessThan(replace.mock.invocationCallOrder[0]!);
    });

    it("setResolvedDocumentItemUrl stores then patches history with item id", () => {
      const replace = vi.spyOn(h.stores.history, "replaceBlobUrl");

      controller.setResolvedDocumentItemUrl(
        "tile-doc",
        "item-1",
        "https://cdn/doc",
      );

      expect(
        h.stores.uploads.resolvedDocumentItemUrls["tile-doc"]?.["item-1"],
      ).toBe("https://cdn/doc");
      expect(replace).toHaveBeenCalledWith(
        "tile-doc",
        "https://cdn/doc",
        "item-1",
      );
    });

    it("get/clear resolved url delegates to the store", () => {
      h.stores.uploads.setResolvedUrl("tile-1", "https://cdn/x");
      expect(controller.getResolvedUrl("tile-1")).toBe("https://cdn/x");
      controller.clearResolvedUrl("tile-1");
      expect(controller.getResolvedUrl("tile-1")).toBeUndefined();
    });

    it("clearResolvedDocumentItemsForTile delegates to the store", () => {
      h.stores.uploads.setResolvedDocumentItemUrl(
        "tile-doc",
        "item-1",
        "https://cdn/x",
      );
      controller.clearResolvedDocumentItemsForTile("tile-doc");
      expect(
        h.stores.uploads.resolvedDocumentItemUrls["tile-doc"],
      ).toBeUndefined();
    });
  });
});
