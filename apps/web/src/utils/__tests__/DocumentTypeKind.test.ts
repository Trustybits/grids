/**
 * Tests for DocumentTypeKind.ts
 *
 * Covers classifyDocumentItem — deriving a DocumentKind ("pdf" | "docx" | "doc"
 * | "md" | "txt" | "other") from a document item's mimeType (preferred) or,
 * failing that, its fileName extension.
 */

import { describe, it, expect } from "vitest";
import { classifyDocumentItem } from "../DocumentTypeKind";

describe("classifyDocumentItem", () => {
  describe("missing input", () => {
    it("returns 'other' when item is undefined", () => {
      expect(classifyDocumentItem(undefined)).toBe("other");
    });
  });

  describe("classification by mime type", () => {
    it("classifies any pdf mime as 'pdf'", () => {
      expect(
        classifyDocumentItem({ fileName: "x", mimeType: "application/pdf" }),
      ).toBe("pdf");
    });

    it("classifies wordprocessingml mime as 'docx'", () => {
      expect(
        classifyDocumentItem({
          fileName: "x",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ).toBe("docx");
    });

    it("classifies msword mime as 'doc'", () => {
      expect(
        classifyDocumentItem({ fileName: "x", mimeType: "application/msword" }),
      ).toBe("doc");
    });

    it("classifies markdown mime as 'md'", () => {
      expect(
        classifyDocumentItem({ fileName: "x", mimeType: "text/markdown" }),
      ).toBe("md");
    });

    it("classifies text/plain mime as 'txt'", () => {
      expect(
        classifyDocumentItem({ fileName: "x", mimeType: "text/plain" }),
      ).toBe("txt");
    });

    it("is case-insensitive on the mime type", () => {
      expect(
        classifyDocumentItem({ fileName: "x", mimeType: "APPLICATION/PDF" }),
      ).toBe("pdf");
    });

    it("matches a pdf mime as a substring (e.g. application/x-pdf)", () => {
      expect(
        classifyDocumentItem({ fileName: "x", mimeType: "application/x-pdf" }),
      ).toBe("pdf");
    });

    it("prefers the mime type over a conflicting extension", () => {
      // mime says pdf, extension says txt — mime wins.
      expect(
        classifyDocumentItem({
          fileName: "report.txt",
          mimeType: "application/pdf",
        }),
      ).toBe("pdf");
    });

    // Documents a quirk: ANY "officedocument" mime maps to "docx", including
    // spreadsheets/presentations, not just Word documents.
    it("classifies any officedocument mime as 'docx' (over-broad match)", () => {
      expect(
        classifyDocumentItem({
          fileName: "sheet",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ).toBe("docx");
    });
  });

  describe("fallback to file extension when mime is absent/unrecognized", () => {
    it("falls back to extension when mimeType is undefined", () => {
      expect(classifyDocumentItem({ fileName: "doc.pdf" })).toBe("pdf");
    });

    it("falls back to extension when mimeType is an empty string", () => {
      expect(classifyDocumentItem({ fileName: "doc.docx", mimeType: "" })).toBe(
        "docx",
      );
    });

    it.each([
      ["a.pdf", "pdf"],
      ["a.docx", "docx"],
      ["a.doc", "doc"],
      ["a.md", "md"],
      ["a.txt", "txt"],
    ])("classifies %s by extension as '%s'", (fileName, expected) => {
      expect(classifyDocumentItem({ fileName })).toBe(expected);
    });

    it("lowercases the extension before matching", () => {
      expect(classifyDocumentItem({ fileName: "REPORT.PDF" })).toBe("pdf");
    });

    it("uses only the last extension segment", () => {
      expect(classifyDocumentItem({ fileName: "archive.pdf.txt" })).toBe("txt");
    });

    it("treats a leading-dot name as having an extension", () => {
      // lastIndexOf('.') === 0, so ".pdf" -> ext "pdf"
      expect(classifyDocumentItem({ fileName: ".pdf" })).toBe("pdf");
    });

    it("returns 'other' for an unknown extension", () => {
      expect(classifyDocumentItem({ fileName: "image.png" })).toBe("other");
    });

    it("returns 'other' when the fileName has no extension", () => {
      expect(classifyDocumentItem({ fileName: "README" })).toBe("other");
    });

    it("returns 'other' when both mime and extension are unrecognized", () => {
      expect(
        classifyDocumentItem({ fileName: "x", mimeType: "image/png" }),
      ).toBe("other");
    });
  });
});
