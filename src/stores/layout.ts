import { defineStore } from "pinia";
import { type Layout } from "@/types/Layout";
import { getLayoutService } from "@/services/LayoutServiceFactory"; // Factory to switch services dynamically
import { ContentType, type TileContent } from "@/types/TileContent";
import { v4 as uuidv4 } from "uuid";
import { collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  mapFirestoreToLayout,
  createDefaultLayout,
} from "@/types/FirestoreMappers";
import { auth, db } from "@/firebase";
import { createTile } from "@/utils/TileUtils";
import { useToastStore } from "@/stores/toast";

const layoutService = getLayoutService();

export const useLayoutStore = defineStore("layout", {
  state: () => ({
    layouts: [] as Array<Layout>,
    currentLayout: null as Layout | null,
    isLoading: false,
    error: null as string | null,
    showMetaData: false,
    isOwner: false,
    recentLayoutIds: [] as string[],
    activeMenuTileId: null as string | null,
  }),

  getters: {
    verticalCompact(): boolean {
      return this.currentLayout?.verticalCompact ?? true;
    },
  },

  actions: {
    setActiveMenuTile(tileId: string) {
      this.activeMenuTileId = tileId;
    },

    closeAllMenus() {
      this.activeMenuTileId = null;
    },

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
        await this.loadRecents();
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
        const docRef = await addDoc(collection(db, "layouts"), {
          ...newLayout,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastOpenedAt: serverTimestamp(),
        });

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
        this.recordRecent(id);

        if (this.isOwner && (this.currentLayout?.tiles?.length ?? 0) === 0) {
          this.ensureSuggestionTiles();
        }

        try {
          const ref = doc(db, "layouts", id);
          await updateDoc(ref, { lastOpenedAt: serverTimestamp() });
        } catch (e) {
          console.error("Failed to update lastOpenedAt:", e);
        }
        // update in-memory list timestamp for immediate UI sorting
        const idx = this.layouts.findIndex((l) => l.id === id);
        if (idx !== -1) {
          this.layouts[idx] = {
            ...this.layouts[idx],
            lastOpenedAt: new Date(),
          } as Layout;
        }
      } catch (err) {
        this.error = "Failed to load layout.";
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    recordRecent(id: string) {
      const next = this.recentLayoutIds.filter((x) => x !== id);
      next.unshift(id);
      this.recentLayoutIds = next.slice(0, 3);
      // fire-and-forget persist
      this.saveRecents();
    },

    async loadRecents() {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          const arr = Array.isArray(data?.recentLayoutIds)
            ? data.recentLayoutIds.filter((x: unknown) => typeof x === "string")
            : [];
          this.recentLayoutIds = arr.slice(0, 3);
        } else {
          this.recentLayoutIds = [];
        }
      } catch (err) {
        console.error("Failed to load recent layouts:", err);
      }
    },

    async saveRecents() {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const userRef = doc(db, "users", userId);
        await setDoc(
          userRef,
          { recentLayoutIds: this.recentLayoutIds.slice(0, 3) },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to save recent layouts:", err);
      }
    },

    checkShowMetaDataCookie() {
      const cookieValue = this.getCookieValue("showMetaData");
      this.showMetaData = cookieValue === "true";
    },

    // Toggle the vertical compact (gravity) setting
    toggleVerticalCompact() {
      if (!this.currentLayout) return;
      
      this.currentLayout.verticalCompact = !this.currentLayout.verticalCompact;
      this.updateLayout();
    },

    // Set the vertical compact (gravity) setting
    setVerticalCompact(value: boolean) {
      if (!this.currentLayout) return;
      
      this.currentLayout.verticalCompact = value;
      this.updateLayout();
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

      // Validate: Only one campfire tile per grid
      if (content.type === ContentType.CAMPFIRE) {
        const hasCampfireTile = this.currentLayout.tiles.some(
          (tile) => tile.content.type === ContentType.CAMPFIRE
        );
        if (hasCampfireTile) {
          // Use toast to notify user
          const toastStore = useToastStore();
          toastStore.addToast('Only one campfire allowed per grid', 'error');
          return null;
        }
      }

      const isProfile = content.type === ContentType.PROFILE;
      const tileWidth = isProfile ? 4 : 2;
      const tileHeight = isProfile ? 4 : 2;

      // Find the first available spot (left-to-right, top-to-bottom)
      const position = this.findFirstAvailableSpot(tileWidth, tileHeight);
      // Create the new tile at the found position
      const newTile = createTile(
        content.type,
        uuidv4(),
        position.x,
        position.y,
        tileWidth,
        tileHeight,
        content,
        ""
      );

      this.currentLayout.tiles.push(newTile);
      this.updateLayout();

      return newTile.i;
    },

    setTileContent(id: string, content: TileContent) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((t) => t.i === id);
      if (!tile) return;

      tile.content = content as any;
      if (content.type === ContentType.PROFILE) {
        tile.w = 4;
        tile.h = 4;
        this.adjustTilePosition(tile);
      }
      this.updateLayout();
    },

    ensureSuggestionTiles() {
      if (!this.currentLayout) return;
      if (this.currentLayout.tiles.length !== 0) return;

      const startX = 0;

      const suggestions = [
        createTile(
          ContentType.SUGGESTION,
          uuidv4(),
          startX,
          0,
          2,
          2,
          { action: "profile", label: "Add Profile" },
          ""
        ),
        createTile(
          ContentType.SUGGESTION,
          uuidv4(),
          startX + 2,
          0,
          2,
          2,
          { action: "text", label: "Add Text" },
          ""
        ),
        createTile(
          ContentType.SUGGESTION,
          uuidv4(),
          startX + 4,
          0,
          2,
          2,
          { action: "media", label: "Add Photo/Video" },
          ""
        ),
        createTile(
          ContentType.SUGGESTION,
          uuidv4(),
          startX,
          2,
          2,
          2,
          { action: "link", label: "Add Link" },
          ""
        ),
        createTile(
          ContentType.SUGGESTION,
          uuidv4(),
          startX + 2,
          2,
          2,
          2,
          { action: "embed", label: "Add Embed" },
          ""
        ),
      ];

      this.currentLayout.tiles = suggestions;
      this.updateLayout();
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

    // Find the first available spot for a tile of given width and height
    // Scans left-to-right, top-to-bottom
    findFirstAvailableSpot(width: number, height: number): { x: number; y: number } {
      if (!this.currentLayout) {
        return { x: 0, y: 0 };
      }

      const colNum = this.currentLayout.colNum || 12;
      const maxY = this.calculateLowestPoint() + height; // Search up to current bottom + new tile height

      // Helper function to check if a position overlaps with any existing tile
      const hasOverlap = (x: number, y: number): boolean => {
        return this.currentLayout!.tiles.some(tile => {
          // Check if rectangles overlap
          return !(
            x + width <= tile.x ||  // new tile is to the left
            x >= tile.x + tile.w || // new tile is to the right
            y + height <= tile.y || // new tile is above
            y >= tile.y + tile.h    // new tile is below
          );
        });
      };

      // Scan top-to-bottom, left-to-right
      for (let y = 0; y <= maxY; y++) {
        for (let x = 0; x <= colNum - width; x++) {
          if (!hasOverlap(x, y)) {
            return { x, y };
          }
        }
      }

      // If no spot found, fall back to bottom of grid
      return { x: 0, y: this.calculateLowestPoint() };
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
        if (tile.content.type === ContentType.PROFILE) {
          tile.w = 4;
          tile.h = 4;
          this.adjustTilePosition(tile);
          this.updateLayout();
          return;
        }
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

    toggleLinkBackground(id: string) {
      if (!this.currentLayout) return;

      const tile = this.currentLayout.tiles.find((tile) => tile.i === id);
      if (!tile || tile.content.type !== ContentType.LINK) return;

      const linkContent = tile.content as any;
      const nextValue = linkContent.linkBackgroundEnabled === false;
      linkContent.linkBackgroundEnabled = nextValue;
      this.updateLayout();
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
