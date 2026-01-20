import { type Layout } from "@/types/Layout";
import { type LayoutService } from "./LayoutService";
import { db } from "@/firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

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
        tiles: data.tiles || [],
        backgroundImageSrc: data.backgroundImageSrc || "",
        backgroundEmbed: data.backgroundEmbed || false,
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
      await setDoc(docRef, {
        userId: layout.userId,
        name: layout.name,
        colNum: layout.colNum,
        tiles: layout.tiles,
        backgroundImageSrc: layout.backgroundImageSrc,
        backgroundEmbed: layout.backgroundEmbed,
        createdAt: layout.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastOpenedAt: layout.lastOpenedAt ?? serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error(`Error saving layout with ID ${layout.id}:`, error);
      throw error;
    }
  }

  // Update an existing layout
  async updateLayout(layout: Layout): Promise<void> {
    try {
      const docRef = doc(db, "layouts", layout.id);
      await updateDoc(docRef, {
        name: layout.name,
        colNum: layout.colNum,
        tiles: layout.tiles,
        backgroundImageSrc: layout.backgroundImageSrc,
        backgroundEmbed: layout.backgroundEmbed,
        updatedAt: serverTimestamp(),
      });
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
