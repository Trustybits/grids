<template>
  <p v-if="layoutStore.isLoading">Loading layout...</p>
  <grid-layout
    v-else
    class="grid-container"
    :layout="mergedLayout"
    :col-num="colNum"
    :row-height="rowHeight"
    :is-draggable="true"
    :is-resizable="true"
    :vertical-compact="false"
    :restoreOnDrag="true"
    :use-css-transforms="true"
    :margin="[margin, margin]"
    @layout-updated="handleLayoutUpdate"
    :style="{ width: `${gridWidth}px` }"
  >
    <!-- Real tiles -->
    <joju-grid-tile
      v-for="tile in layoutStore.currentLayout?.tiles || []"
      :key="tile.i"
      :tile="tile"
    />
    
    <!-- Suggestion tiles -->
    <grid-item
      v-for="suggestion in activeSuggestions"
      :key="suggestion.i"
      :x="suggestion.x"
      :y="suggestion.y"
      :w="suggestion.w"
      :h="suggestion.h"
      :i="suggestion.i"
      :static="false"
      class="suggestion-grid-tile"
      @click="handleSuggestionClick(suggestion)"
    >
      <div class="suggestion-tile-content">
        <div class="suggestion-icon">{{ suggestion.icon }}</div>
        <span class="suggestion-label">{{ suggestion.label }}</span>
      </div>
    </grid-item>
  </grid-layout>
</template>

<script lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { GridLayout, GridItem } from "vue3-grid-layout";
import JojuGridTile from "./GridTile.vue";
import { useLayoutStore } from "@/stores/layout";
import { ContentType } from "@/types/TileContent";
import { createTileContent } from "@/utils/TileUtils";
import { v4 as uuidv4 } from "uuid";
import { createTile } from "@/utils/TileUtils";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { getAuth } from "firebase/auth";

export default {
  components: {
    GridLayout,
    GridItem,
    JojuGridTile,
  },
  props: {
    rowHeight: {
      type: Number,
      default: 75,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const route = useRoute();
    const margin = 48;
    const auth = getAuth();
    const storage = getStorage();

    const colNum = computed(() => {
      return layoutStore.currentLayout?.colNum || 10;
    });

    const gridWidth = computed(() => {
      return colNum.value * props.rowHeight + (colNum.value + 1) * margin;
    });

    // Track which suggestions have been used
    const usedSuggestions = ref<Set<string>>(new Set());

    // Define all possible suggestion tiles
    const allSuggestions = [
      { i: "suggest-text", type: "text", icon: "✏️", label: "Add Text", contentType: ContentType.TEXT },
      { i: "suggest-photo", type: "photo", icon: "📷", label: "Add Photo", contentType: ContentType.IMAGE },
      { i: "suggest-link", type: "link", icon: "🔗", label: "Add Link", contentType: ContentType.LINK },
      { i: "suggest-video", type: "video", icon: "📽", label: "Add Video", contentType: ContentType.VIDEO },
      { i: "suggest-embed", type: "embed", icon: "💻", label: "Add Embed", contentType: ContentType.EMBED },
      { i: "suggest-music", type: "music", icon: "🎵", label: "Add Music", contentType: ContentType.LINK },
    ];

    // Filter out used suggestions and calculate their positions
    const activeSuggestions = computed(() => {
      const realTiles = layoutStore.currentLayout?.tiles || [];
      const lowestPoint = layoutStore.calculateLowestPoint();
      
      return allSuggestions
        .filter(s => !usedSuggestions.value.has(s.i))
        .map((suggestion, index) => {
          const col = index % 3; // 3 columns
          const row = Math.floor(index / 3);
          return {
            ...suggestion,
            x: col * 2,
            y: lowestPoint + row * 2,
            w: 2,
            h: 2,
          };
        });
    });

    // Merge real tiles with suggestion tiles for the layout
    const mergedLayout = computed(() => {
      const realTiles = layoutStore.currentLayout?.tiles || [];
      return [...realTiles, ...activeSuggestions.value];
    });

    // Handle suggestion tile click
    const handleSuggestionClick = async (suggestion: any) => {
      if (!layoutStore.currentLayout) return;

      const { x, y, w, h, contentType, type } = suggestion;

      try {
        // Different handling based on tile type
        if (type === "photo") {
          // Trigger file input for photos
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = async (e: any) => {
            const file = e.target?.files?.[0];
            if (!file) return;

            const currentUser = auth.currentUser;
            if (!currentUser) {
              alert("You must be logged in to upload an image.");
              return;
            }

            const filePath = `users/${currentUser.uid}/images/${Date.now()}_${file.name}`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);

            const content = createTileContent(ContentType.IMAGE, { src: url });
            const newTile = createTile(contentType, uuidv4(), x, y, w, h, content, "");
            
            layoutStore.currentLayout!.tiles.push(newTile);
            usedSuggestions.value.add(suggestion.i);
            layoutStore.updateLayout();
          };
          input.click();
        } else if (type === "video") {
          // Trigger file input for videos
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "video/*";
          input.onchange = async (e: any) => {
            const file = e.target?.files?.[0];
            if (!file) return;

            const currentUser = auth.currentUser;
            if (!currentUser) {
              alert("You must be logged in to upload a video.");
              return;
            }

            const filePath = `users/${currentUser.uid}/videos/${Date.now()}_${file.name}`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);

            const content = createTileContent(ContentType.VIDEO, { src: url });
            const newTile = createTile(contentType, uuidv4(), x, y, w, h, content, "");
            
            layoutStore.currentLayout!.tiles.push(newTile);
            usedSuggestions.value.add(suggestion.i);
            layoutStore.updateLayout();
          };
          input.click();
        } else if (type === "link" || type === "music") {
          // Prompt for link
          const link = prompt("Please enter a link:");
          if (link) {
            const content = createTileContent(ContentType.LINK, { link });
            const newTile = createTile(contentType, uuidv4(), x, y, w, h, content, "");
            
            layoutStore.currentLayout!.tiles.push(newTile);
            usedSuggestions.value.add(suggestion.i);
            layoutStore.updateLayout();
          }
        } else if (type === "embed") {
          // Prompt for embed URL
          const embedUrl = prompt("Please enter an embed URL:");
          if (embedUrl) {
            const content = createTileContent(ContentType.EMBED, { src: embedUrl });
            const newTile = createTile(contentType, uuidv4(), x, y, w, h, content, "");
            
            layoutStore.currentLayout!.tiles.push(newTile);
            usedSuggestions.value.add(suggestion.i);
            layoutStore.updateLayout();
          }
        } else if (type === "text") {
          // Create empty text tile
          const content = createTileContent(ContentType.TEXT, {});
          const newTile = createTile(contentType, uuidv4(), x, y, w, h, content, "");
          
          layoutStore.currentLayout!.tiles.push(newTile);
          usedSuggestions.value.add(suggestion.i);
          layoutStore.updateLayout();
        }
      } catch (error) {
        console.error("Failed to create tile:", error);
        alert("Failed to create tile. Please try again.");
      }
    };

    // Handle layout updates (for real tiles only)
    const handleLayoutUpdate = () => {
      // Only update if there are real tiles (filter out suggestions)
      if (layoutStore.currentLayout?.tiles.length) {
        layoutStore.updateLayout();
      }
    };

    // Load layout using ID from the route
    onMounted(() => {
      const layoutId = route.params.id;
      if (layoutId) {
        layoutStore.loadLayout(layoutId as string);
      } else {
        console.error("Layout ID is missing in the route.");
      }
    });

    return {
      layoutStore,
      gridWidth,
      margin,
      colNum,
      activeSuggestions,
      mergedLayout,
      handleSuggestionClick,
      handleLayoutUpdate,
    };
  },
};
</script>

<style scoped>
.vue-grid-layout {
  background-color: #ffffff00;
  position: relative;
  left: 50vw;
  transform: translate(-50%, 0);
}

.vue-grid-item {
  :not(&.resizing) {
    transition-property: transform, width, height !important;
    transition-timing-function: cubic-bezier(
      0.68,
      -0.55,
      0.27,
      1.55
    ) !important;
  }
  box-shadow: 1px 1px 15px rgb(153, 153, 153);
  border-radius: 8px;

  &.vue-draggable-dragging {
    opacity: 1 !important;
    background-color: white !important;
  }
}

.suggestion-grid-tile {
  background: rgba(255, 255, 255, 0.02) !important;
  border: 2px dashed rgba(255, 255, 255, 0.3) !important;
  box-shadow: none !important;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 255, 255, 0.5) !important;
    transform: translateY(-2px);
  }
}

.suggestion-tile-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
}

.suggestion-icon {
  font-size: 2.5rem;
  opacity: 0.7;
  transition: all 0.3s ease;
}

.suggestion-grid-tile:hover .suggestion-icon {
  opacity: 1;
  transform: scale(1.1);
}

.suggestion-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-color);
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.suggestion-grid-tile:hover .suggestion-label {
  opacity: 0.9;
}
</style>
