import { type Layout } from "@/types/Layout";
import { type LayoutService } from "./LayoutService";
import { db } from "@/firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const sanitizeFirestoreValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const sanitized = sanitizeFirestoreValue(item);
      return sanitized === undefined ? null : sanitized;
    });
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, val]) => [key, sanitizeFirestoreValue(val)] as const)
      .filter(([, val]) => val !== undefined);
    return Object.fromEntries(entries);
  }

  return value;
};

/**
 * Safety net: strip any remaining blob: URLs before persisting to Firestore.
 * Normally the layout store substitutes resolved Firebase URLs before calling
 * the service, but this catches any edge cases where a blob URL slips through.
 */
const stripBlobUrls = (tiles: unknown[]): unknown[] => {
  return tiles.map((tile) => {
    if (!isPlainObject(tile)) return tile;
    const content = tile.content;
    if (!isPlainObject(content)) return tile;
    const src = content.src;
    if (typeof src === "string" && src.startsWith("blob:")) {
      return {
        ...tile,
        content: { ...content, src: "" },
      };
    }
    return tile;
  });
};

export class FirestoreLayoutService implements LayoutService {
  // Fetch a layout by ID
  async fetchLayout(id: string): Promise<Layout> {
    try {
      const docRef = doc(db, "layouts", id);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        throw new Error(`Layout with ID ${id} does not exist`);
      }

      const data = docSnapshot.data();

      // Ensure data matches the Layout type
      return {
        id: docSnapshot.id,
        userId: data.userId || "",
        name: data.name || "Untitled",
        colNum: data.colNum || 12,
        verticalCompact: data.verticalCompact ?? false,
        tiles: data.tiles || [],
        backgroundImageSrc: data.backgroundImageSrc || "",
        backgroundEmbed: data.backgroundEmbed || false,
        themeId: data.themeId || undefined,
        overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : undefined,
        duplicatable: !!data.duplicatable,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
        lastOpenedAt: data.lastOpenedAt ?? null,
      };
    } catch (error) {
      console.error(`Error fetching layout with ID ${id}:`, error);
      throw error;
    }
  }

  // Save a new layout
  async saveLayout(layout: Layout): Promise<void> {
    try {
      console.log(layout);
      const docRef = doc(db, "layouts", layout.id);
      const payload = sanitizeFirestoreValue({
        userId: layout.userId,
        name: layout.name,
        colNum: layout.colNum,
        verticalCompact: layout.verticalCompact,
        // Safety net: strip any blob: URLs that weren't already resolved
        tiles: stripBlobUrls(layout.tiles as unknown[]),
        backgroundImageSrc: layout.backgroundImageSrc,
        backgroundEmbed: layout.backgroundEmbed,
        themeId: layout.themeId ?? 'dark',
        overrides: layout.overrides ?? {},
        duplicatable: layout.duplicatable ?? false,
        createdAt: layout.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastOpenedAt: layout.lastOpenedAt ?? serverTimestamp(),
      }) as Record<string, unknown>;
      await setDoc(docRef, payload, { merge: true });
    } catch (error) {
      console.error(`Error saving layout with ID ${layout.id}:`, error);
      throw error;
    }
  }

  // Update an existing layout
  async updateLayout(layout: Layout): Promise<void> {
    try {
      const docRef = doc(db, "layouts", layout.id);
      const payload = sanitizeFirestoreValue({
        name: layout.name,
        colNum: layout.colNum,
        verticalCompact: layout.verticalCompact,
        // Safety net: strip any blob: URLs that weren't already resolved
        tiles: stripBlobUrls(layout.tiles as unknown[]),
        backgroundImageSrc: layout.backgroundImageSrc,
        backgroundEmbed: layout.backgroundEmbed,
        themeId: layout.themeId ?? 'dark',
        overrides: layout.overrides ?? {},
        duplicatable: layout.duplicatable ?? false,
        updatedAt: serverTimestamp(),
      }) as Record<string, unknown>;
      await updateDoc(docRef, payload);
    } catch (error) {
      console.error(`Error updating layout with ID ${layout.id}:`, error);
      throw error;
    }
  }

  // Delete a layout by ID
  async deleteLayout(id: string): Promise<void> {
    try {
      const docRef = doc(db, "layouts", id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting layout with ID ${id}:`, error);
      throw error;
    }
  }
}
