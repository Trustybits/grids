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
    <div 
      class="card-body" 
      :class="{ 'neon-tile': isNeonVariant }"
      :style="neonStyle"
      ref="gridTileRef"
    >
      <!-- Neon glow effects (only for neon variant) -->
      <template v-if="isNeonVariant">
        <div class="neon-glow-container">
          <div class="ambient-glow"></div>
        </div>
        <div class="active-neon-glow">
          <div class="neon-glow-main"></div>
          <div class="neon-glow-core"></div>
        </div>
      </template>

      <div v-if="headerComponent" class="header-options">
        <component :is="headerComponent" :content="tile.content" />
      </div>

      <p v-if="layoutStore.showMetaData" class="meta-data">
        {{ `x: ${tile.x}, y: ${tile.y} w: ${tile.w} h: ${tile.h}` }}
      </p>

      <!-- Content directly in card-body, no extra wrapper -->
      <component
        class="tile-content"
        :is="currentComponent"
        :content="tile.content"
        ref="childComponent"
        @mousedown="startClick" 
        @mouseup="endClick"
      />

      <button
        class="btn btn-sm btn-danger btn-close"
        @click="removeElement"
      ></button>

      <TileCaption :tile="tile" />

      <div class="resize-options bkg-neutral text-primary">
        <div class="quick-resize-inner">
          <button
            class="bkg-secondary txt-neutral small me-1"
            @click="resize(5, 1)"
          >
            5x1
          </button>
          <button
            class="bkg-secondary txt-neutral small me-1"
            @click="resize(2, 2)"
          >
            2x2
          </button>
          <button
            class="bkg-secondary txt-neutral small me-1"
            @click="resize(3, 2)"
          >
            3x2
          </button>
          <button class="bkg-secondary txt-neutral small" @click="resize(2, 4)">
            2x4
          </button>
        </div>
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
    // Optional: Enable neon styling
    neonColor: {
      type: String,
      default: '',
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

    // Neon variant detection and styling
    const isNeonVariant = computed(() => {
      return !!props.neonColor;
    });

    const neonStyle = computed(() => {
      if (props.neonColor) {
        return {
          '--neon-color': props.neonColor,
        };
      }
      return {};
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
      isNeonVariant,
      neonStyle,
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
  background-color: var(--tile-color);
  border-radius: 16px;
  backdrop-filter: blur(20px);

  /* Simple border approach - no complex pseudo-elements */
  &:not(.neon-tile) {
    /* Option 1: Box shadow border */
    box-shadow: 
      inset 0 1px 2px rgba(255, 255, 255, 0.2),
      inset 0 -1px 2px rgba(0, 0, 0, 0.1);
    
    /* Option 2: Solid border (uncomment to use instead)
    border: 2px solid rgba(255, 255, 255, 0.1);
    */
  }

  /* Neon Tile Variant - simplified */
  &.neon-tile {
    border-radius: 34px;
    background: linear-gradient(135deg, #181818, #242424);
    padding: 2px;
    overflow: hidden;

    /* Inner background visible through padding "border" */
    &::before {
      content: '';
      position: absolute;
      inset: 2px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: calc(34px - 2px);
      backdrop-filter: blur(8px);
      z-index: 0;
    }
  }

  .meta-data {
    position: absolute;
    font-size: 10px;
    left: 10px;
    z-index: 10;
  }

  /* Content fills the tile */
  .tile-content {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 1;
    
    /* Content should respect tile border-radius */
    border-radius: inherit;
    overflow: hidden;
  }
}

/* Remove Button */
.card-body .btn-close {
  display: none;
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  opacity: 0.5;

  .btn-close:hover {
    z-index: 0;
  }
}

/* Resize Options */
.resize-options {
  display: none;
  margin-top: 4px;
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translate(-50%, 100%);
  border-radius: 24px;
  padding: 6px;
  justify-content: center;
  gap: 0px;
}

.resize-options::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 24px;
  padding: 2px;
  background: linear-gradient(
    to bottom right,
    #ffffff66,
    #ffffff00,
    #ffffff00,
    #ffffff1a
  );
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  /* border-image-slice: 1; */
}

/* Customizable Header Styles */
.header-options {
  display: none;
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translate(-50%, -100%);
}

.resize-options button {
  font-size: 10px;
  background-color: #ffffff1a;
  border-radius: 16px;
  height: 32px;
  width: 32px;
  align-items: center;
  justify-content: center;
  padding: 0px;
  border: solid #ffffff39 1px;
}

:deep(.hover-display) {
  display: none;
}

.card-body:hover .resize-options,
.card-body:hover .header-options,
.card-body:hover .btn-close,
.card-body:hover :deep(.hover-display) {
  display: flex;
}

/* Neon Glow Effects */
.neon-glow-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.ambient-glow {
  position: absolute;
  left: 80px;
  top: 174px;
  width: 252px;
  height: 252px;
  opacity: 0.1;
  pointer-events: none;

  &::before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: white;
    filter: blur(60px);
  }
}

.active-neon-glow {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s ease-out;
  pointer-events: none;

  .card-body.neon-tile:hover & {
    opacity: 1;
  }
}

.neon-glow-main {
  position: absolute;
  left: -100px;
  top: 140px;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background-color: var(--neon-color, #ffffff);
  opacity: 0.6;
  filter: blur(80px);
}

.neon-glow-core {
  position: absolute;
  left: -60px;
  top: 180px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background-color: var(--neon-color, #ffffff);
  filter: blur(50px);
  
  .card-body.neon-tile:hover & {
    animation: neon-flicker 0.4s linear infinite alternate;
  }
}

@keyframes neon-flicker {
  0%, 100% { opacity: 1; }
  25% { opacity: 0.9; }
  50% { opacity: 0.85; }
  75% { opacity: 0.8; }
}

.neon-icon {
  position: relative;
  width: 48px;
  height: 48px;
  
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
}

.icon-base {
  stroke: white;
  stroke-opacity: 0.34;
  stroke-width: 0.96;
  fill: white;
  fill-opacity: 0.34;
  transition: all 0.3s ease-out;
  
  .card-body.neon-tile:hover & {
    fill: var(--neon-color, #ffffff);
    fill-opacity: 1;
    filter: drop-shadow(0 0 10px var(--neon-color, #ffffff));
  }
}

.icon-lit {
  stroke: white;
  stroke-width: 1.5;
  fill: none;
  opacity: 0;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8));
  transition: opacity 0.2s ease-out;
  
  .card-body.neon-tile:hover & {
    opacity: 1;
  }
}

.neon-title {
  font-size: 16px;
  font-weight: 600;
  color: #fbfbfb;
  margin: 0;
}

.neon-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #fbfbfb;
  opacity: 0.6;
  margin: 0;
  margin-top: 3px;
}
</style>
