/**
 * Tests for UploadFileClassification.ts
 *
 * Covers:
 *  - classifyFileForUpload: image / video / document / null from mime + extension
 *  - isDocumentUploadFile: boolean convenience wrapper
 *  - validateUploadFile: type-restriction + size enforcement, throwing
 *    user-facing messages, and the flags object it returns on success
 */

import { describe, it, expect } from "vitest";
import {
  classifyFileForUpload,
  classifyUploadSize,
  isDocumentUploadFile,
  validateUploadFile,
} from "../UploadFileClassification";

function makeFile(name: string, mime: string, size = 100): File {
  return new File([new Uint8Array(size)], name, { type: mime });
}

describe("classifyFileForUpload", () => {
  it("classifies any image/* mime as image", () => {
    expect(classifyFileForUpload(makeFile("p.png", "image/png"))).toBe("image");
    expect(classifyFileForUpload(makeFile("p.webp", "image/webp"))).toBe(
      "image",
    );
  });

  it("classifies any video/* mime as video", () => {
    expect(classifyFileForUpload(makeFile("v.mp4", "video/mp4"))).toBe("video");
  });

  it.each([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
  ])("classifies known document mime %s as document", (mime) => {
    expect(classifyFileForUpload(makeFile("doc", mime))).toBe("document");
  });

  it("normalizes mime case/whitespace before matching the document set", () => {
    expect(classifyFileForUpload(makeFile("doc", "  APPLICATION/PDF  "))).toBe(
      "document",
    );
  });

  it.each(["a.pdf", "a.doc", "a.docx", "a.txt", "a.md", "A.PDF", "report.MD"])(
    "classifies %s as document by extension when mime is missing",
    (name) => {
      expect(classifyFileForUpload(makeFile(name, ""))).toBe("document");
    },
  );

  it("returns null for unsupported types with no matching extension", () => {
    expect(classifyFileForUpload(makeFile("archive.zip", ""))).toBeNull();
    expect(classifyFileForUpload(makeFile("noext", ""))).toBeNull();
    expect(
      classifyFileForUpload(makeFile("data.json", "application/json")),
    ).toBeNull();
  });

  it("prefers an image mime even when the extension is a document one", () => {
    expect(classifyFileForUpload(makeFile("weird.pdf", "image/png"))).toBe(
      "image",
    );
  });
});

describe("isDocumentUploadFile", () => {
  it("returns true for a document file", () => {
    expect(isDocumentUploadFile(makeFile("a.pdf", "application/pdf"))).toBe(
      true,
    );
  });

  it("returns false for an image file", () => {
    expect(isDocumentUploadFile(makeFile("a.png", "image/png"))).toBe(false);
  });

  it("returns false for an unsupported file", () => {
    expect(isDocumentUploadFile(makeFile("a.zip", ""))).toBe(false);
  });
});

describe("validateUploadFile", () => {
  it("throws for an unsupported file type", () => {
    expect(() => validateUploadFile(makeFile("a.zip", ""))).toThrow(
      /Unsupported file type/,
    );
  });

  it("returns kind flags for an image", () => {
    expect(validateUploadFile(makeFile("a.png", "image/png"))).toEqual({
      isImage: true,
      isVideo: false,
      isDocument: false,
    });
  });

  it("returns kind flags for a video", () => {
    expect(validateUploadFile(makeFile("a.mp4", "video/mp4"))).toEqual({
      isImage: false,
      isVideo: true,
      isDocument: false,
    });
  });

  it("returns kind flags for a document", () => {
    expect(
      validateUploadFile(makeFile("a.pdf", "application/pdf")),
    ).toEqual({
      isImage: false,
      isVideo: false,
      isDocument: true,
    });
  });

  describe("fileType restriction", () => {
    it("accepts a document when fileType is documents", () => {
      const f = makeFile("a.pdf", "application/pdf");
      expect(() =>
        validateUploadFile(f, { fileType: "documents" }),
      ).not.toThrow();
    });

    it("rejects a document when fileType is images", () => {
      const f = makeFile("a.pdf", "application/pdf");
      expect(() => validateUploadFile(f, { fileType: "images" })).toThrow(
        /Unsupported file type/,
      );
    });

    it("rejects an image when fileType is videos", () => {
      const f = makeFile("a.png", "image/png");
      expect(() => validateUploadFile(f, { fileType: "videos" })).toThrow(
        /Unsupported file type/,
      );
    });

    it("rejects an image when fileType is documents", () => {
      const f = makeFile("a.png", "image/png");
      expect(() => validateUploadFile(f, { fileType: "documents" })).toThrow(
        /Please upload a document/,
      );
    });

    it("rejects a document when fileType is videos", () => {
      const f = makeFile("a.pdf", "application/pdf");
      expect(() => validateUploadFile(f, { fileType: "videos" })).toThrow(
        /Unsupported file type/,
      );
    });

    it("accepts an image when fileType is images", () => {
      const f = makeFile("a.png", "image/png");
      expect(() =>
        validateUploadFile(f, { fileType: "images" }),
      ).not.toThrow();
    });

    it("accepts a video when fileType is videos", () => {
      const f = makeFile("a.mp4", "video/mp4");
      expect(() =>
        validateUploadFile(f, { fileType: "videos" }),
      ).not.toThrow();
    });
  });

  describe("size is advisory, never a failure", () => {
    it("does not throw for a large file (hard caps removed)", () => {
      const f = makeFile("a.mp4", "video/mp4", 2 * 1024 * 1024 * 1024);
      expect(() => validateUploadFile(f)).not.toThrow();
    });

    it("does not throw even past an explicit maxSize", () => {
      const f = makeFile("a.pdf", "application/pdf", 200);
      expect(() => validateUploadFile(f, { maxSize: 100 })).not.toThrow();
    });
  });
});

describe("classifyUploadSize", () => {
  it("does not warn for a small file", () => {
    const f = makeFile("a.png", "image/png", 1024);
    expect(classifyUploadSize(f).warn).toBe(false);
  });

  it("warns (without erroring) for an image over the advisory threshold", () => {
    const f = makeFile("a.png", "image/png", 30 * 1024 * 1024);
    const result = classifyUploadSize(f);
    expect(result.warn).toBe(true);
    expect(result.message).toMatch(/large/i);
  });

  it("honors an explicit maxSize as the warning threshold", () => {
    const f = makeFile("a.pdf", "application/pdf", 200);
    expect(classifyUploadSize(f, { maxSize: 100 }).warn).toBe(true);
    expect(classifyUploadSize(f, { maxSize: 300 }).warn).toBe(false);
  });
});
