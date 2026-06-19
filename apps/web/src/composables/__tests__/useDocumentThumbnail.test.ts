/**
 * Tests for useDocumentThumbnail helpers:
 *  - documentItemIsPdf: pure PDF detection from mime type and/or file extension.
 *  - ensureDocumentItemThumbnailOnServer: thin wrapper that forwards to the
 *    CloudFunctions service. The service factory is mocked so we can assert the
 *    function name and payload and control the response.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  documentItemIsPdf,
  ensureDocumentItemThumbnailOnServer,
} from "@/composables/useDocumentThumbnail";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";

const { mockCallFunction } = vi.hoisted(() => ({
  mockCallFunction: vi.fn(),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: vi.fn(() => ({
    getCloudFunctionsService: () => ({ callFunction: mockCallFunction }),
  })),
}));

beforeEach(() => {
  mockCallFunction.mockReset();
});

describe("documentItemIsPdf", () => {
  it("returns true when the mime type contains 'pdf'", () => {
    expect(documentItemIsPdf("file", "application/pdf")).toBe(true);
  });

  it("is case-insensitive on the mime type", () => {
    expect(documentItemIsPdf("file", "Application/PDF")).toBe(true);
  });

  it("returns true when the extension is .pdf and no mime is given", () => {
    expect(documentItemIsPdf("report.pdf")).toBe(true);
  });

  it("is case-insensitive on the extension", () => {
    expect(documentItemIsPdf("REPORT.PDF")).toBe(true);
  });

  it("uses the last extension for multi-dot filenames", () => {
    expect(documentItemIsPdf("archive.pdf.zip")).toBe(false);
    expect(documentItemIsPdf("archive.zip.pdf")).toBe(true);
  });

  it("returns false for a non-pdf file with no pdf mime", () => {
    expect(documentItemIsPdf("photo.png", "image/png")).toBe(false);
  });

  it("returns false for a filename with no extension and no mime", () => {
    expect(documentItemIsPdf("README")).toBe(false);
  });

  it("returns false for a trailing-dot filename (empty extension)", () => {
    expect(documentItemIsPdf("file.")).toBe(false);
  });

  it("treats a dotfile named .pdf as a pdf", () => {
    expect(documentItemIsPdf(".pdf")).toBe(true);
  });

  it("trusts the mime type even when the extension disagrees", () => {
    expect(documentItemIsPdf("document.docx", "application/pdf")).toBe(true);
  });
});

describe("ensureDocumentItemThumbnailOnServer", () => {
  it("calls the ensureDocumentItemThumbnail cloud function with ids", async () => {
    mockCallFunction.mockResolvedValue({ thumbnailUrl: "https://x/thumb.png" });

    const result = await ensureDocumentItemThumbnailOnServer(
      "grid-1",
      "tile-1",
      "item-1",
    );

    expect(getServiceFactory).toHaveBeenCalled();
    expect(mockCallFunction).toHaveBeenCalledWith("ensureDocumentItemThumbnail", {
      gridId: "grid-1",
      tileId: "tile-1",
      itemId: "item-1",
    });
    expect(result).toEqual({ thumbnailUrl: "https://x/thumb.png" });
  });

  it("propagates a skipped/cached response unchanged", async () => {
    mockCallFunction.mockResolvedValue({ skipped: true, cached: false });
    const result = await ensureDocumentItemThumbnailOnServer("g", "t", "i");
    expect(result).toEqual({ skipped: true, cached: false });
  });

  it("rejects when the cloud function rejects", async () => {
    mockCallFunction.mockRejectedValue(new Error("function failed"));
    await expect(
      ensureDocumentItemThumbnailOnServer("g", "t", "i"),
    ).rejects.toThrow("function failed");
  });
});
