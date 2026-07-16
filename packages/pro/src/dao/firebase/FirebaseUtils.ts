import type { Grid } from "@grids/contracts/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

// Mapper function to ensure Firestore data matches the Grid type
export function mapFirestoreToGrid(
  doc: QueryDocumentSnapshot<DocumentData, DocumentData>,
): Grid {
  const data = doc.data();
  return {
    id: doc.id, // Explicitly set the Firestore document ID
    userId: data.userId || "",
    rev: typeof data.rev === "number" ? data.rev : 0,
    name: data.name || "Untitled",
    colNum: data.colNum || 12,
    verticalCompact:
      data.verticalCompact !== undefined ? data.verticalCompact : true,
    tiles: Array.isArray(data.tiles) ? data.tiles : [], // Validate tiles is an array
    backgroundImageSrc: data.backgroundImageSrc || "",
    backgroundImageHash:
      typeof data.backgroundImageHash === "string"
        ? data.backgroundImageHash
        : undefined,
    backgroundEmbed: !!data.backgroundEmbed,
    backgroundColor: data.backgroundColor || "",
    backgroundActiveSource:
      data.backgroundActiveSource === "image" ||
      data.backgroundActiveSource === "color" ||
      data.backgroundActiveSource === "default"
        ? data.backgroundActiveSource
        : undefined,
    ogImageSrc: data.ogImageSrc || "",
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
