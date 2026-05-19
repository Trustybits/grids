import { describe, it, expect } from "vitest";
import {
  classifyFileForUpload,
  validateUploadFile,
} from "../UploadFileClassification";

function makeFile(name: string, mime: string, size = 100): File {
  return new File([new Uint8Array(size)], name, { type: mime });
}

describe("uploadFileClassification", () => {
  it("classifies PDF by mime and extension", () => {
    expect(classifyFileForUpload(makeFile("x.pdf", "application/pdf"))).toBe(
      "document",
    );
    expect(classifyFileForUpload(makeFile("x", "", 10))).toBe(null);
    expect(classifyFileForUpload(makeFile("notes.txt", "", 10))).toBe(
      "document",
    );
  });

  it("validateUploadFile accepts documents with fileType documents", () => {
    const f = makeFile("a.pdf", "application/pdf");
    expect(() =>
      validateUploadFile(f, { fileType: "documents" }),
    ).not.toThrow();
  });

  it("validateUploadFile rejects document when fileType is images", () => {
    const f = makeFile("a.pdf", "application/pdf");
    expect(() => validateUploadFile(f, { fileType: "images" })).toThrow(
      /Unsupported file type/,
    );
  });
});
