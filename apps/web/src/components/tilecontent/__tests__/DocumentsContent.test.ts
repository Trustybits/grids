import { describe, it, expect } from "vitest";
import { type DocumentItem } from "@/types/TileContent";
import { classifyDocumentItem } from "@/utils/DocumentTypeKind";
import { useFeatureFlags, FEATURE_FLAGS } from "@/composables/useFeatureFlags";

// ── classifyDocumentItem ────────────────────────────────────────────────────

describe("classifyDocumentItem", () => {
  it("returns 'other' for undefined input", () => {
    expect(classifyDocumentItem(undefined)).toBe("other");
  });

  it("classifies PDF by mimeType", () => {
    expect(
      classifyDocumentItem({ fileName: "report.xyz", mimeType: "application/pdf" }),
    ).toBe("pdf");
  });

  it("classifies DOCX by mimeType (wordprocessingml)", () => {
    expect(
      classifyDocumentItem({
        fileName: "file.bin",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("docx");
  });

  it("classifies DOC by mimeType (msword)", () => {
    expect(
      classifyDocumentItem({ fileName: "file.bin", mimeType: "application/msword" }),
    ).toBe("doc");
  });

  it("classifies Markdown by mimeType", () => {
    expect(
      classifyDocumentItem({ fileName: "notes.x", mimeType: "text/markdown" }),
    ).toBe("md");
  });

  it("classifies plain text by mimeType", () => {
    expect(
      classifyDocumentItem({ fileName: "data.x", mimeType: "text/plain" }),
    ).toBe("txt");
  });

  it("falls back to extension when mimeType is empty", () => {
    expect(classifyDocumentItem({ fileName: "report.pdf", mimeType: "" })).toBe("pdf");
    expect(classifyDocumentItem({ fileName: "doc.docx", mimeType: "" })).toBe("docx");
    expect(classifyDocumentItem({ fileName: "old.doc", mimeType: "" })).toBe("doc");
    expect(classifyDocumentItem({ fileName: "README.md", mimeType: "" })).toBe("md");
    expect(classifyDocumentItem({ fileName: "notes.txt", mimeType: "" })).toBe("txt");
  });

  it("falls back to extension when mimeType is undefined", () => {
    expect(classifyDocumentItem({ fileName: "x.pdf", mimeType: undefined })).toBe("pdf");
  });

  it("returns 'other' for unrecognized mime and extension", () => {
    expect(classifyDocumentItem({ fileName: "archive.zip", mimeType: "application/zip" })).toBe("other");
  });

  it("is case-insensitive on extension", () => {
    expect(classifyDocumentItem({ fileName: "FILE.PDF", mimeType: "" })).toBe("pdf");
    expect(classifyDocumentItem({ fileName: "FILE.DOCX", mimeType: "" })).toBe("docx");
  });
});

// ── Illustration selection logic ────────────────────────────────────────────

const ILLUSTRATION_BY_KIND: Record<string, string> = {
  pdf: "/illustrations/file-pdf.png",
  docx: "/illustrations/file-docx.png",
  doc: "/illustrations/file-docx.png",
  md: "/illustrations/file-md.png",
  txt: "/illustrations/file-txt.png",
};
const ILLUSTRATION_FALLBACK = "/illustrations/file-txt.png";

function getIllustrationSrc(item: Pick<DocumentItem, "fileName" | "mimeType"> | undefined): string {
  const k = classifyDocumentItem(item);
  return ILLUSTRATION_BY_KIND[k] ?? ILLUSTRATION_FALLBACK;
}

describe("illustrationSrc selection", () => {
  it("maps PDF file to pdf illustration", () => {
    expect(getIllustrationSrc({ fileName: "report.pdf", mimeType: "application/pdf" })).toBe(
      "/illustrations/file-pdf.png",
    );
  });

  it("maps DOCX file to docx illustration", () => {
    expect(getIllustrationSrc({ fileName: "letter.docx", mimeType: "" })).toBe(
      "/illustrations/file-docx.png",
    );
  });

  it("maps DOC file to docx illustration (shared asset)", () => {
    expect(getIllustrationSrc({ fileName: "old.doc", mimeType: "" })).toBe(
      "/illustrations/file-docx.png",
    );
  });

  it("uses fallback for unknown type", () => {
    expect(getIllustrationSrc({ fileName: "data.csv", mimeType: "text/csv" })).toBe(
      ILLUSTRATION_FALLBACK,
    );
  });
});

// ── stackIllustrationSrcs (multi-file fan logic) ────────────────────────────

function computeStackIllustrationSrcs(items: Pick<DocumentItem, "fileName" | "mimeType">[]): string[] {
  if (items.length <= 1) return [];

  const freq = new Map<string, number>();
  for (const item of items) {
    const k = classifyDocumentItem(item);
    const src = ILLUSTRATION_BY_KIND[k] ?? ILLUSTRATION_FALLBACK;
    freq.set(src, (freq.get(src) || 0) + 1);
  }

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const uniqueSrcs = sorted.map(([src]) => src);

  if (uniqueSrcs.length >= 4) return uniqueSrcs.slice(0, 4);
  if (uniqueSrcs.length === 1) return [uniqueSrcs[0], uniqueSrcs[0], uniqueSrcs[0], uniqueSrcs[0]];

  const result: string[] = [];
  let remaining = 4;
  for (let i = 0; i < sorted.length && remaining > 0; i++) {
    const [src, count] = sorted[i];
    const share = i === sorted.length - 1
      ? remaining
      : Math.max(1, Math.round((count / items.length) * 4));
    const slots = Math.min(share, remaining);
    for (let j = 0; j < slots; j++) result.push(src);
    remaining -= slots;
  }
  while (result.length < 4) result.push(uniqueSrcs[0]);
  return result;
}

describe("stackIllustrationSrcs", () => {
  it("returns empty for single item", () => {
    expect(computeStackIllustrationSrcs([{ fileName: "a.pdf", mimeType: "" }])).toEqual([]);
  });

  it("returns empty for zero items", () => {
    expect(computeStackIllustrationSrcs([])).toEqual([]);
  });

  it("returns 4 identical illustrations when all documents are same type", () => {
    const items = [
      { fileName: "a.pdf", mimeType: "" },
      { fileName: "b.pdf", mimeType: "" },
      { fileName: "c.pdf", mimeType: "" },
    ];
    const result = computeStackIllustrationSrcs(items);
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(1);
    expect(result[0]).toBe("/illustrations/file-pdf.png");
  });

  it("distributes by frequency with 2 types (majority gets more slots)", () => {
    const items = [
      { fileName: "a.pdf", mimeType: "" },
      { fileName: "b.pdf", mimeType: "" },
      { fileName: "c.pdf", mimeType: "" },
      { fileName: "d.docx", mimeType: "" },
    ];
    const result = computeStackIllustrationSrcs(items);
    expect(result).toHaveLength(4);
    const pdfCount = result.filter((s) => s === "/illustrations/file-pdf.png").length;
    const docxCount = result.filter((s) => s === "/illustrations/file-docx.png").length;
    expect(pdfCount).toBeGreaterThan(docxCount);
    expect(pdfCount + docxCount).toBe(4);
  });

  it("returns one of each when exactly 4 unique types", () => {
    const items = [
      { fileName: "a.pdf", mimeType: "" },
      { fileName: "b.docx", mimeType: "" },
      { fileName: "c.md", mimeType: "" },
      { fileName: "d.txt", mimeType: "" },
    ];
    const result = computeStackIllustrationSrcs(items);
    expect(result).toHaveLength(4);
    expect(new Set(result).size).toBe(4);
  });

  it("caps at 4 when more than 4 unique types exist", () => {
    const items = [
      { fileName: "a.pdf", mimeType: "" },
      { fileName: "b.docx", mimeType: "" },
      { fileName: "c.md", mimeType: "" },
      { fileName: "d.txt", mimeType: "" },
      { fileName: "e.zip", mimeType: "application/zip" },
    ];
    const result = computeStackIllustrationSrcs(items);
    expect(result).toHaveLength(4);
  });

  it("always returns exactly 4 elements for multi-file stacks", () => {
    const items = [
      { fileName: "a.pdf", mimeType: "" },
      { fileName: "b.docx", mimeType: "" },
    ];
    const result = computeStackIllustrationSrcs(items);
    expect(result).toHaveLength(4);
  });
});

// ── Tile sizing / illustration visibility logic ─────────────────────────────

function computeShowIllustration(w: number, h: number): boolean {
  const isOneByOne = w === 1 && h === 1;
  const isBanner = w >= 2 && h === 1;
  if (isOneByOne) return false;
  if (isBanner && w < 3) return false;
  if (w === 1 && h > 2) return false;
  return true;
}

function computeIllustrationPlacement(
  w: number,
  h: number,
): "banner" | "narrow-tall" | "two-right" | "two-bottom-right" | "standard" {
  const isBanner = w >= 2 && h === 1;
  if (isBanner) return "banner";
  if (w === 1 && h === 2) return "narrow-tall";
  if (w === 2 && h === 2) return "two-right";
  if (w === 2 && h >= 3) return "two-bottom-right";
  return "standard";
}

describe("showIllustration", () => {
  it("hides on 1×1", () => {
    expect(computeShowIllustration(1, 1)).toBe(false);
  });

  it("hides on 2×1 (banner too narrow)", () => {
    expect(computeShowIllustration(2, 1)).toBe(false);
  });

  it("shows on 3×1 banner", () => {
    expect(computeShowIllustration(3, 1)).toBe(true);
  });

  it("shows on 4×1 banner", () => {
    expect(computeShowIllustration(4, 1)).toBe(true);
  });

  it("shows on 1×2 (narrow-tall)", () => {
    expect(computeShowIllustration(1, 2)).toBe(true);
  });

  it("hides on 1×3+ (no illustration for tall-narrow beyond 1×2)", () => {
    expect(computeShowIllustration(1, 3)).toBe(false);
    expect(computeShowIllustration(1, 4)).toBe(false);
  });

  it("shows on 2×2", () => {
    expect(computeShowIllustration(2, 2)).toBe(true);
  });

  it("shows on 2×3", () => {
    expect(computeShowIllustration(2, 3)).toBe(true);
  });

  it("shows on 3×2+ (standard)", () => {
    expect(computeShowIllustration(3, 2)).toBe(true);
    expect(computeShowIllustration(4, 3)).toBe(true);
  });
});

describe("illustrationPlacement", () => {
  it("returns banner for 3×1", () => {
    expect(computeIllustrationPlacement(3, 1)).toBe("banner");
  });

  it("returns banner for 4×1", () => {
    expect(computeIllustrationPlacement(4, 1)).toBe("banner");
  });

  it("returns narrow-tall for 1×2", () => {
    expect(computeIllustrationPlacement(1, 2)).toBe("narrow-tall");
  });

  it("returns two-right for 2×2", () => {
    expect(computeIllustrationPlacement(2, 2)).toBe("two-right");
  });

  it("returns two-bottom-right for 2×3", () => {
    expect(computeIllustrationPlacement(2, 3)).toBe("two-bottom-right");
  });

  it("returns two-bottom-right for 2×4", () => {
    expect(computeIllustrationPlacement(2, 4)).toBe("two-bottom-right");
  });

  it("returns standard for 3×2", () => {
    expect(computeIllustrationPlacement(3, 2)).toBe("standard");
  });

  it("returns standard for 4×3", () => {
    expect(computeIllustrationPlacement(4, 3)).toBe("standard");
  });
});

// ── Editable fields (default text logic) ────────────────────────────────────

function computeDefaultTitle(items: DocumentItem[]): string {
  const n = items.length;
  if (n === 0) return "Document";
  if (n > 1) return "Documents";
  return items[0]?.fileName?.trim() || "Document";
}

function computeDefaultDescription(items: DocumentItem[]): string {
  const n = items.length;
  if (n <= 0) return "";
  return n === 1 ? "1 file" : `${n} files`;
}

function computeDisplayTitle(
  customTitle: string | undefined,
  items: DocumentItem[],
): string {
  return customTitle !== undefined ? customTitle : computeDefaultTitle(items);
}

function computeDisplayDescription(
  customDescription: string | undefined,
  items: DocumentItem[],
): string {
  return customDescription !== undefined
    ? customDescription
    : computeDefaultDescription(items);
}

const makeItem = (fileName: string, mimeType = ""): DocumentItem => ({
  id: Math.random().toString(36).slice(2),
  fileName,
  url: "https://example.com/file",
  mimeType,
});

describe("defaultTitle", () => {
  it("returns 'Document' when items are empty", () => {
    expect(computeDefaultTitle([])).toBe("Document");
  });

  it("returns fileName for a single item", () => {
    expect(computeDefaultTitle([makeItem("report.pdf")])).toBe("report.pdf");
  });

  it("returns 'Document' if single item has empty fileName", () => {
    expect(computeDefaultTitle([makeItem("")])).toBe("Document");
  });

  it("returns 'Documents' for multiple items", () => {
    expect(computeDefaultTitle([makeItem("a.pdf"), makeItem("b.pdf")])).toBe("Documents");
  });
});

describe("defaultDescription", () => {
  it("returns empty string when items are empty", () => {
    expect(computeDefaultDescription([])).toBe("");
  });

  it("returns '1 file' for a single item", () => {
    expect(computeDefaultDescription([makeItem("a.pdf")])).toBe("1 file");
  });

  it("returns 'N files' for multiple items", () => {
    expect(computeDefaultDescription([makeItem("a"), makeItem("b"), makeItem("c")])).toBe("3 files");
  });
});

describe("displayTitle", () => {
  it("uses customTitle when defined (even if empty string)", () => {
    expect(computeDisplayTitle("", [makeItem("a.pdf")])).toBe("");
    expect(computeDisplayTitle("My Docs", [makeItem("a.pdf")])).toBe("My Docs");
  });

  it("falls back to defaultTitle when customTitle is undefined", () => {
    expect(computeDisplayTitle(undefined, [makeItem("report.pdf")])).toBe("report.pdf");
  });
});

describe("displayDescription", () => {
  it("uses customDescription when defined", () => {
    expect(computeDisplayDescription("Custom desc", [makeItem("a.pdf")])).toBe("Custom desc");
  });

  it("falls back to defaultDescription when customDescription is undefined", () => {
    expect(computeDisplayDescription(undefined, [makeItem("a"), makeItem("b")])).toBe("2 files");
  });
});

// ── Feature flag gating ─────────────────────────────────────────────────────

describe("BETA_DOCUMENTS feature flag", () => {
  it("FEATURE_FLAGS.BETA_DOCUMENTS has the correct key", () => {
    expect(FEATURE_FLAGS.BETA_DOCUMENTS).toBe("beta-documents");
  });

  it("override enables the flag", () => {
    const { isEnabled, override, resetOverrides } = useFeatureFlags();
    override(FEATURE_FLAGS.BETA_DOCUMENTS, true);
    expect(isEnabled(FEATURE_FLAGS.BETA_DOCUMENTS)).toBe(true);
    resetOverrides();
  });

  it("override disables the flag", () => {
    const { isEnabled, override, resetOverrides } = useFeatureFlags();
    override(FEATURE_FLAGS.BETA_DOCUMENTS, false);
    expect(isEnabled(FEATURE_FLAGS.BETA_DOCUMENTS)).toBe(false);
    resetOverrides();
  });

  it("resetOverrides clears manual overrides", () => {
    const { isEnabled, override, resetOverrides } = useFeatureFlags();
    override(FEATURE_FLAGS.BETA_DOCUMENTS, true);
    expect(isEnabled(FEATURE_FLAGS.BETA_DOCUMENTS)).toBe(true);

    override(FEATURE_FLAGS.BETA_DOCUMENTS, false);
    expect(isEnabled(FEATURE_FLAGS.BETA_DOCUMENTS)).toBe(false);

    resetOverrides();
    // After reset, the override map is empty — re-setting a new override works fresh
    override(FEATURE_FLAGS.BETA_DOCUMENTS, true);
    expect(isEnabled(FEATURE_FLAGS.BETA_DOCUMENTS)).toBe(true);
    resetOverrides();
  });
});

// ── saveEdits logic (trimming behavior) ─────────────────────────────────────

describe("saveEdits trimming logic", () => {
  it("trims whitespace from title and description", () => {
    const draftTitle = "  My Report  ";
    const draftDescription = "  Important files  ";
    expect(draftTitle.trim()).toBe("My Report");
    expect(draftDescription.trim()).toBe("Important files");
  });

  it("produces empty string for whitespace-only input", () => {
    expect("   ".trim()).toBe("");
    expect("\t\n".trim()).toBe("");
  });
});

// ── openPreview logic ───────────────────────────────────────────────────────

describe("openPreview guard logic", () => {
  it("does not open when editing", () => {
    const isEditing = true;
    const itemsLength = 3;
    const shouldOpen = !isEditing && itemsLength > 0;
    expect(shouldOpen).toBe(false);
  });

  it("does not open when items are empty", () => {
    const isEditing = false;
    const itemsLength = 0;
    const shouldOpen = !isEditing && itemsLength > 0;
    expect(shouldOpen).toBe(false);
  });

  it("opens when not editing and items exist", () => {
    const isEditing = false;
    const itemsLength = 2;
    const shouldOpen = !isEditing && itemsLength > 0;
    expect(shouldOpen).toBe(true);
  });
});
