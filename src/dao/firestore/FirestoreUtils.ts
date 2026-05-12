import type { Layout } from "@/types/Layout";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

// Mapper function to ensure Firestore data matches the Layout type
export function mapFirestoreToLayout(
  doc: QueryDocumentSnapshot<DocumentData, DocumentData>,
): Layout {
  const data = doc.data();
  return {
    id: doc.id, // Explicitly set the Firestore document ID
    userId: data.userId || "",
    name: data.name || "Untitled",
    colNum: data.colNum || 12,
    verticalCompact:
      data.verticalCompact !== undefined ? data.verticalCompact : true,
    tiles: Array.isArray(data.tiles) ? data.tiles : [], // Validate tiles is an array
    backgroundImageSrc: data.backgroundImageSrc || "",
    backgroundEmbed: !!data.backgroundEmbed,
    backgroundColor: data.backgroundColor || "",
    themeId: data.themeId || undefined,
    overrides:
      data.overrides && typeof data.overrides === "object"
        ? data.overrides
        : undefined,
    duplicatable: !!data.duplicatable,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastOpenedAt: data.lastOpenedAt ?? null,
  };
}
