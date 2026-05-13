import type { DocumentItem } from "@/types/TileContent";

export type DocumentKind = "pdf" | "docx" | "doc" | "md" | "txt" | "other";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function classifyDocumentItem(
  item: Pick<DocumentItem, "fileName" | "mimeType"> | undefined,
): DocumentKind {
  if (!item) return "other";
  const mime = (item.mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument")
  ) {
    return "docx";
  }
  if (mime.includes("msword")) return "doc";
  if (mime.includes("markdown")) return "md";
  if (mime.includes("text/plain")) return "txt";

  const e = extOf(item.fileName);
  if (e === "pdf") return "pdf";
  if (e === "docx") return "docx";
  if (e === "doc") return "doc";
  if (e === "md") return "md";
  if (e === "txt") return "txt";
  return "other";
}
