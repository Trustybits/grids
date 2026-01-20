import { defineStore } from "pinia";
import { type Layout } from "@/types/Layout";
import { getLayoutService } from "@/services/LayoutServiceFactory"; // Factory to switch services dynamically
import type { TileContent } from "@/types/TileContent";
import { v4 as uuidv4 } from "uuid";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import {
  mapFirestoreToLayout,
  createDefaultLayout,
} from "@/types/FirestoreMappers";
import { auth, db } from "@/firebase";
import { createTile } from "@/utils/TileUtils";

const layoutService = getLayoutService();

export const useLayoutStore = defineStore("layout", {
  state: () => ({
    layouts: [] as Array<Layout>,
    currentLayout: null as Layout | null,
    isLoading: false,
    error: null as string | null,
    showMetaData: false,
    isOwner: false,
  }),

  actions: {
    async fetchLayouts() {
      this.isLoading = true;
      this.error = null;
      this.layouts = [];

      const userId = auth.currentUser?.uid;
      if (!userId) {
        this.error = "User not authenticated";
        this.isLoading = false;
        return;
      }

      try {
        const layoutsQuery = query(
          collection(db, "layouts"),
          where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(layoutsQuery);

        this.layouts = querySnapshot.docs.map((doc) =>
          mapFirestoreToLayout(doc)
        );
        console.log("layouts", this.layouts);
      } catch (err) {
        this.error = "Failed to fetch layouts.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    // Create a new layout for the user
    async createLayout(name: string): Promise<string | null> {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        this.error = "User not authenticated";
        return null;
      }

      if (!name) {
        name = `Layout ${this.layouts.length + 1}`;
      }

      try {
        const newLayout = createDefaultLayout(userId, name);
        console.log("newLayout", newLayout);
        const docRef = await addDoc(collection(db, "layouts"), newLayout);

        // Add the new layout to the state
        this.layouts.push({ ...newLayout, id: docRef.id });

        return docRef.id;
      } catch (err) {
        this.error = "Failed to create layout.";
        console.error(err);
        return null;
      }
    },

    // Load a layout by ID
    async loadLayout(id: string) {
      this.isLoading = true;
      this.error = null;
      this.isOwner = false;

      try {
        this.currentLayout = await layoutService.fetchLayout(id);
        this.isOwner = !!(
          auth.currentUser?.uid &&
          this.currentLayout?.userId &&
          auth.currentUser.uid === this.currentLayout.userId
        );
        this.checkShowMetaDataCookie();
      } catch (err) {
        this.error = "Failed to load layout.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    checkShowMetaDataCookie() {
      const cookieValue = this.getCookieValue("showMetaData");
      this.showMetaData = cookieValue === "true";
    },

    getCookieValue(name: string): string | null {
      const cookies = document.cookie.split("; ");
      const cookie = cookies.find((row) => row.startsWith(`${name}=`));
      return cookie ? cookie.split("=")[1] : null;
    },

    setCookieValue(name: string, value: string, days = 365) {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/`;
    },

    // Save the current layout
    async saveLayout() {
      if (!this.currentLayout) {
        console.warn("No layout to save.");
        return;
      }

      if (!this.isOwner) {
        return;
      }

      try {
        await layoutService.saveLayout(this.currentLayout);
      } catch (err) {
        this.error = "Failed to save layout.";
        console.error(err);
      }
    },

    // Add a new tile
    addTile(content: TileContent): string | null {
      if (!this.currentLayout) return null;

      // TODO: Validate content before creating tile

      // Calculate the lowest point in the grid
      const lowestY = this.calculateLowestPoint();

      // Create the new tile below the lowest point
      const newTile = createTile(
        content.type,
        uuidv4(),
        0,
        lowestY,
        2,
        2,
        content,
        ""
      );

      this.currentLayout.tiles.push(newTile);
      this.updateLayout();

      return newTile.i;
    },

    patchTileContent(id: string, patch: Partial<any>) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (!tile) return;

      tile.content = {
        ...(tile.content as any),
        ...(patch as any),
      };

      this.updateLayout();
    },

    addBackgroundImage(url: string, embed: boolean) {
      if (!this.currentLayout) return;

      this.currentLayout.backgroundImageSrc = url;
      this.currentLayout.backgroundEmbed = embed;
      this.updateLayout();
    },

    // Calculate the lowest point in the grid
    calculateLowestPoint(): number {
      if (!this.currentLayout || this.currentLayout.tiles.length === 0) {
        return 0;
      }

      return this.currentLayout.tiles.reduce((max, tile) => {
        const bottom = tile.y + tile.h;
        return bottom > max ? bottom : max;
      }, 0);
    },

    // updateTile(id: string, newContent: TileContent) {
    //   if (!this.currentLayout) return;

    //   const tileIndex = this.currentLayout.tiles.findIndex((tile) => tile.i === id);
    //   if (tileIndex !== -1) {
    //     const tile = this.currentLayout.tiles[tileIndex];
    //     this.currentLayout.tiles[tileIndex] = updateTileContent(tile, newContent);
    //     this.saveLayout(); // Persist changes
    //   } else {
    //     console.warn(`Tile with ID ${id} not found.`);
    //   }
    // },

    // Remove an tile
    removeTile(id: string) {
      if (!this.currentLayout) return;

      this.currentLayout.tiles = this.currentLayout.tiles.filter(
        (tile) => tile.i !== id
      );
      this.saveLayout(); // Persist changes
    },

    // Resize an tile
    resizeTile(id: string, w: number, h: number) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((tile) => tile.i === id);
      if (tile) {
        tile.w = w;
        tile.h = h;
        this.adjustTilePosition(tile);
        this.updateLayout();
      }
    },

    toggleTileBorder(id: string) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((tile) => tile.i === id);
      if (tile) {
        tile.borderEnabled = tile.borderEnabled === false ? true : false;
        this.updateLayout();
      }
    },

    // Adjust tile's x value to ensure it doesn't extend past colNum
    adjustTilePosition(tile: { x: number; w: number }) {
      if (!this.currentLayout) {
        console.warn("Cannot adjust tile position: currentLayout is null.");
        return;
      }

      const maxX = this.currentLayout.colNum - tile.w;
      if (tile.x > maxX) {
        tile.x = Math.max(0, maxX); // Ensure x doesn't go negative
      }
    },

    // Update the entire layout
    updateLayout() {
      if (!this.isOwner) {
        return;
      }

      const gridElement =
        document.querySelector<HTMLElement>(".vue-grid-layout");
      if (gridElement) {
        const currentWidth = parseFloat(getComputedStyle(gridElement).width);
        if (!isNaN(currentWidth)) {
          gridElement.style.height = `${currentWidth + 1}px`;
        }
      }

      this.saveLayout(); // Persist changes
    },

    async deleteLayout(id: string) {
      if (!this.isOwner) {
        return;
      }

      try {
        await layoutService.deleteLayout(id);
        this.layouts = this.layouts.filter((layout) => layout.id !== id);
    
        if (this.currentLayout?.id === id) {
          this.currentLayout = null;
        }
      } catch (err) {
        this.error = "Failed to delete layout.";
        console.error(err);
      }
    },    
  },
});
