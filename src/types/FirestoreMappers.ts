// src/types/FirestoreMappers.ts
import type { Layout } from "./Layout";

// Mapper function to ensure Firestore data matches the Layout type
export function mapFirestoreToLayout(doc: any): Layout {
  const data = doc.data();
  return {
    id: doc.id, // Explicitly set the Firestore document ID
    userId: data.userId || "",
    name: data.name || "Untitled",
    colNum: data.colNum || 12,
    verticalCompact: data.verticalCompact !== undefined ? data.verticalCompact : true,
    tiles: Array.isArray(data.tiles) ? data.tiles : [], // Validate tiles is an array
    backgroundImageSrc: data.backgroundImageSrc || "",
    backgroundEmbed: !!data.backgroundEmbed,
    themeId: data.themeId || undefined,
    overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : undefined,
    duplicatable: !!data.duplicatable,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastOpenedAt: data.lastOpenedAt ?? null,
  };
}

// Mapper for new layouts
export function createDefaultLayout(userId: string, name: string): Layout {
  if (!name) {
    name = "";
  }

  return {
    id: "", // Firestore will provide the ID later
    userId,
    name,
    colNum: 12, // Default number of columns
    verticalCompact: true, // Default to gravity ON
    tiles: [], // Start with no tiles
    backgroundImageSrc: "",
    backgroundEmbed: false,
    duplicatable: false,
  };
}
