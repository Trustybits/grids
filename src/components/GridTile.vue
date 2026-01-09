<template>
  <grid-item
    :i="tile.i"
    :x="tile.x"
    :y="tile.y"
    :w="tile.w"
    :h="tile.h"
    :style="tileStyle"
    :maxW="10"
    :maxH="10"
    :isDraggable="!isEditing"
    @move="onMove"
    @resized="onDragResize"
  >
    <div class="card-body" ref="gridTileRef" @mousedown="startClick" @mouseup="endClick">
      <div v-if="headerComponent" class="header-options">
        <component :is="headerComponent" :content="tile.content" />
      </div>

      <p v-if="layoutStore.showMetaData" class="meta-data">
        {{ `x: ${tile.x}, y: ${tile.y} w: ${tile.w} h: ${tile.h}` }}
      </p>

      <component
        :is="currentComponent"
        :content="tile.content"
        ref="childComponent"
      />

      <button
        class="btn btn-sm btn-danger btn-close"
        @click="removeElement"
      ></button>

      <TileCaption :tile="tile" />

      <div class="tile-toolbar" @mousedown.stop>
        <button class="toolbar-btn" @click.stop="resize(5, 1)">5x1</button>
        <button class="toolbar-btn" @click.stop="resize(2, 2)">2x2</button>
        <button class="toolbar-btn" @click.stop="resize(3, 2)">3x2</button>
        <button class="toolbar-btn" @click.stop="resize(2, 4)">2x4</button>
      </div>
    </div>
  </grid-item>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  ref,
  onUnmounted,
  watch,
  computed,
} from "vue";
import { GridItem } from "vue3-grid-layout";
import { type Tile } from "@/types/Tile";
import { useLayoutStore } from "@/stores/layout";
import TileCaption from "./TileCaption.vue";
import { getContentComponent, getOptionComponent } from "@/utils/TileUtils";

export default defineComponent({
  components: {
    GridItem,
    TileCaption,
  },
  props: {
    tile: {
      type: Object as () => Tile,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const isMoving = ref(false);
    const currentComponent = ref<any>(null);
    const headerComponent = ref<any>(null);
    const childComponent = ref<any>(null);
    const isEditing = ref(false);
    const gridTileRef = ref<HTMLElement | null>(null);

    const clickStart = ref<number | null>(null);
    const CLICK_THRESHOLD = 150;

    const loadComponent = async () => {
      currentComponent.value = await getContentComponent(props.tile.content);
      headerComponent.value = await getOptionComponent(props.tile.content);
    };

    const startClick = (event: MouseEvent) => {
      if (event.button === 0) {
        clickStart.value = Date.now();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        gridTileRef.value &&
        !gridTileRef.value.contains(event.target as Node) &&
        childComponent.value?.onExitClick
      ) {
        childComponent.value.onExitClick();
        removeClickListener();
      }
    };

    const addClickListener = () => {
      document.addEventListener("click", handleClickOutside);
    };

    const removeClickListener = () => {
      document.removeEventListener("click", handleClickOutside);
    };

    const endClick = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      const clickDuration = Date.now() - (clickStart.value || 0);

      if (clickDuration < CLICK_THRESHOLD && !isMoving.value) {
        if (childComponent.value?.onShortClick) {
          childComponent.value.onShortClick();
        }
        if (childComponent.value?.onExitClick) {
          addClickListener();
        }
      }

      clickStart.value = null;
    };

    watch(
      () => childComponent.value?.isEditing,
      (newVal) => {
        isEditing.value = newVal;
      }
    );

    const onMove = () => {
      isMoving.value = true;
      setTimeout(() => (isMoving.value = false), 300);
    };

    const resize = (w: number, h: number) => {
      layoutStore.resizeTile(props.tile.i, w, h);
      if (childComponent.value?.onResize) {
        childComponent.value.onResize();
      }
    };

    const onDragResize = () => {
      if (childComponent.value?.onResize) {
        childComponent.value.onResize();
      }
    };

    const removeElement = () => {
      layoutStore.removeTile(props.tile.i);
    };

    const tileStyle = computed(() => {
      return {
        zIndex: isEditing.value ? 1 : 0,
      };
    });

    onMounted(() => {
      loadComponent();
    });

    onUnmounted(() => {
      removeClickListener(); // Cleanup on unmount
    });

    return {
      currentComponent,
      headerComponent,
      resize,
      removeElement,
      tileStyle,
      onMove,
      startClick,
      endClick,
      childComponent,
      gridTileRef,
      layoutStore,
      isEditing,
      onDragResize,
    };
  },
});
</script>

<style scoped lang="scss">
/* Card Body Styles */
.card-body {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--tile-border-radius);
  backdrop-filter: blur(20px);
  box-sizing: border-box;
  
  /* Padding controlled by individual tile components */
  /* This allows different tile types to use different padding amounts */
  
  /* Remove transition that causes drag lag */
  /* Only apply hover effect via :hover pseudo-class */
  &:hover {
    box-shadow: var(--shadow-tile-hover);
  }
}

.meta-data {
  position: absolute;
  font-size: 10px;
  left: 10px;
  top: 10px;
}

/* Remove Button */
.card-body .btn-close {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 1;
  cursor: pointer;
  border-radius: 100%;
  padding: 3px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* Hidden by default with smooth animation properties using tokens */
  opacity: 0;
  transform: scale(0.2);
  pointer-events: none;
  transition: transform var(--duration-normal) var(--easing-spring), 
              // opacity var(--duration-fast) var(--easing-ease-out), 
              background-color var(--duration-fast) var(--easing-ease-in-out), 
              color var(--duration-fast) var(--easing-ease-in-out), 
              border-color var(--duration-fast) var(--easing-ease-in-out);
  
  /* Default state - solid colors */
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  
  /* Override Bootstrap btn-close filter to use our color token */
  filter: none;
  background-image: none;
  
  /* X icon styling - uses pseudo-element for proper color control */
  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 2px;
    background-color: var(--color-text-primary);
    transition: background-color var(--duration-normal) var(--easing-ease-in-out);
  }
  
  &::before {
    transform: rotate(45deg);
  }
  
  &::after {
    transform: rotate(-45deg);
  }

  /* Button hover state - turns red */
  &:hover {
    background-color: #ff3737;
    border-color: #ff3737;
    
    &::before,
    &::after {
      background-color: #ffffff;
    }
  }
}

/* Tile Toolbar (formerly resize options) */
.tile-toolbar {
  position: absolute;
  bottom: 4px;
  left: 50%;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-wrap: nowrap;
  
  /* Hidden by default with smooth animation properties */
  opacity: 0;
  transform: translate(-50%, calc(100% + 10px)) scale(0.9);
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-out),
              transform var(--duration-normal) var(--easing-spring);
  
  /* Toolbar styling matching close button */
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  padding: 6px;
}

/* Customizable Header Styles */
.header-options {
  display: none;
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translate(-50%, -100%);
}

.tile-toolbar .toolbar-btn {
  font-size: 10px;
  background-color: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-sm);
  height: 32px;
  min-width: 32px; /* Changed width to min-width for flexibility */
  padding: 0 4px; /* Add horizontal padding for text buttons */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-ease-in-out),
              transform var(--duration-fast) var(--easing-ease-out);
  
  &:hover {
    background-color: var(--color-content-low);
    transform: scale(1.1);
  }
}

:deep(.hover-display) {
  display: none;
}

/* Show elements on tile hover with smooth animations */
.card-body:hover .header-options,
.card-body:hover :deep(.hover-display) {
  display: flex;
}

.card-body:hover .btn-close {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.card-body:hover .tile-toolbar {
  opacity: 1;
  transform: translate(-50%, 100%) scale(1);
  pointer-events: auto;
}
</style>