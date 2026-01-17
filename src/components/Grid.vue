<template>
  <p v-if="layoutStore.isLoading">Loading layout...</p>
  <grid-layout
    v-else-if="layoutStore.currentLayout?.tiles?.length ?? 0"
    class="grid-container"
    :layout="layoutStore.currentLayout?.tiles || []"
    :col-num="colNum"
    :row-height="rowHeight"
    :is-draggable="true"
    :is-resizable="true"
    :vertical-compact="false"
    :restoreOnDrag="true"
    :use-css-transforms="true"
    :margin="[margin, margin]"
    @layout-updated="layoutStore.updateLayout"
    :style="{ width: `${gridWidth}px` }"
  >
    <grid-tile
      v-for="tile in layoutStore.currentLayout?.tiles || []"
      :key="tile.i"
      :tile="tile"
    />
  </grid-layout>
  <grid-layout
    v-else
    class="grid-container"
    :layout="suggestionLayout"
    :col-num="colNum"
    :row-height="rowHeight"
    :is-draggable="false"
    :is-resizable="false"
    :vertical-compact="false"
    :use-css-transforms="true"
    :margin="[margin, margin]"
    :style="{ width: `${gridWidth}px` }"
  >
    <grid-item
      v-for="suggestion in suggestionLayout"
      :key="suggestion.i"
      :x="suggestion.x"
      :y="suggestion.y"
      :w="suggestion.w"
      :h="suggestion.h"
      :i="suggestion.i"
      :static="true"
      class="suggestion-grid-tile"
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
// import VueGridLayout from "vue-grid-layout-v3";
import GridTile from "./GridTile.vue";
import { useLayoutStore } from "@/stores/layout";

export default {
  components: {
    GridLayout,
    GridItem,
    GridTile,
  },
  props: {
    rowHeight: {
      type: Number,
      default: 75,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const route = useRoute(); // Access route parameters
    const margin = 48;

    const colNum = computed(() => {
      return layoutStore.currentLayout?.colNum || 10;
    });

    const gridWidth = computed(() => {
      return colNum.value * props.rowHeight + (colNum.value + 1) * margin;
    });

    // Define suggestion tiles as grid items
    const suggestionLayout = [
      { i: "suggest-1", x: 0, y: 0, w: 2, h: 2, icon: "✏️", label: "Add Text" },
      { i: "suggest-2", x: 2, y: 0, w: 2, h: 2, icon: "📷", label: "Add Photo" },
      { i: "suggest-3", x: 4, y: 0, w: 2, h: 2, icon: "🔗", label: "Add Link" },
      { i: "suggest-4", x: 0, y: 2, w: 2, h: 2, icon: "📽", label: "Add Video" },
      { i: "suggest-5", x: 2, y: 2, w: 2, h: 2, icon: "💻", label: "Add Embed" },
      { i: "suggest-6", x: 4, y: 2, w: 2, h: 2, icon: "🎵", label: "Add Music" },
    ];

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
      suggestionLayout,
    };
  },

  // mounted() {
  //   document.body.style.backgroundImage = 'url("https://images.pexels.com/photos/247599/pexels-photo-247599.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1")';
  //   document.body.style.backgroundRepeat = 'no-repeat';
  //   // document.body.style.backgroundColor = 'lightblue';
  //   // document.body.style.fontFamily = 'Arial';
  //   // Add more styles as needed
  // },
  // beforeUnmount() {
  //   // Reset styles when the component is destroyed (optional)
  //   // document.body.style.backgroundColor = '#ffffff00';
  //   document.body.style.backgroundImage = 'none';
  //   // document.body.style.backgroundColor = 'blue';
  //   // document.body.style.fontFamily = 'Inter';
  // }
};
</script>

<style scoped>
.vue-grid-layout {
  background-color: #ffffff00;
  position: relative;
  left: 50vw;
  transform: translate(-50%, 0);
}

/* Visual styling handled by custom.scss globally */
/* Grid only handles animation behavior */
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
