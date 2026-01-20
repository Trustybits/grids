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
    :isDraggable="layoutStore.isOwner && !isEditing"
    @move="onMove"
    @resized="onDragResize"
  >
    <div
      class="tile-wrapper"
      :data-border="borderEnabled ? 'on' : 'off'"
      ref="gridTileRef"
      @mousedown="startClick"
      @mouseup="endClick"
    >
      <!-- Visual Frame with Overflow Hidden -->
      <div class="card-body">
        <component
          :is="currentComponent"
          :content="tile.content"
          ref="childComponent"
        />
      </div>

      <!-- UI Layer -->
      <div v-if="layoutStore.isOwner && headerComponent" class="header-options">
        <component :is="headerComponent" :content="tile.content" />
      </div>

      <p v-if="layoutStore.showMetaData" class="meta-data">
        {{ `x: ${tile.x}, y: ${tile.y} w: ${tile.w} h: ${tile.h}` }}
      </p>

      <button
        v-if="layoutStore.isOwner"
        class="btn btn-sm btn-danger btn-close"
        @click="removeElement"
      ></button>

      <TileCaption v-if="showCaption" :tile="tile" />

      <div v-if="layoutStore.isOwner" class="tile-toolbar" @mousedown.stop>
        <button
          class="toolbar-btn"
          :class="{ 'is-active': isPresetActive(5, 1) }"
          title="Resize to 5x1"
          @click.stop="resize(5, 1)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="10" width="18" height="4" rx="1.5" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <button
          class="toolbar-btn"
          :class="{ 'is-active': isPresetActive(2, 2) }"
          title="Resize to 2x2"
          @click.stop="resize(2, 2)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <button
          class="toolbar-btn"
          :class="{ 'is-active': isPresetActive(3, 2) }"
          title="Resize to 3x2"
          @click.stop="resize(3, 2)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <button
          class="toolbar-btn"
          :class="{ 'is-active': isPresetActive(2, 4) }"
          title="Resize to 2x4"
          @click.stop="resize(2, 4)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="4" width="8" height="16" rx="2" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <div class="toolbar-divider"></div>

        <button
          class="toolbar-btn toolbar-btn--border"
          :class="{ 'is-active': borderEnabled }"
          :title="borderEnabled ? 'Hide border' : 'Show border'"
          @click.stop="toggleBorder"
        >
          <svg
            class="toolbar-icon-border"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="3"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <rect
              x="7"
              y="7"
              width="10"
              height="10"
              rx="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              class="border-slash"
              d="M7 17L17 7"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <button class="toolbar-btn" title="Tile color" @click.stop="onToolbarAction('color')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--color-figma-purple)" />
          </svg>
        </button>

        <button class="toolbar-btn" title="More" @click.stop="onToolbarAction('menu')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="12" r="1.25" fill="currentColor" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" />
            <circle cx="18" cy="12" r="1.25" fill="currentColor" />
          </svg>
        </button>
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
import { ContentType } from "@/types/TileContent";

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

    const showCaption = computed(() => {
      // Hide caption for Link, Text, and Embed tiles as requested
      const hiddenTypes = [ContentType.LINK, ContentType.TEXT, ContentType.EMBED];
      return !hiddenTypes.includes(props.tile.content.type);
    });

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

    const isPresetActive = (w: number, h: number) => {
      return props.tile.w === w && props.tile.h === h;
    };

    const borderEnabled = computed(() => {
      return props.tile.borderEnabled !== false;
    });

    const toggleBorder = () => {
      layoutStore.toggleTileBorder(props.tile.i);
    };

    const onToolbarAction = (action: string) => {
      void action;
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
      showCaption,
      isPresetActive,
      borderEnabled,
      toggleBorder,
      onToolbarAction,
    };
  },
});
</script>

<style scoped lang="scss">
.tile-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Card Body Styles - Visual Frame */
.card-body {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--color-tile-background);
  /* Border handled by pseudo-element to allow content to clip UNDER the border */
  border-radius: var(--tile-border-radius);
  backdrop-filter: blur(20px);
  box-sizing: border-box;
  overflow: hidden; /* Clip content to border-radius */
  isolation: isolate; /* Force clipping context */
  transform: translateZ(0); /* Fix for Safari border-radius clipping */
  
  /* Border Overlay */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border: var(--tile-border-width) solid var(--color-tile-stroke);
    border-radius: inherit;
    pointer-events: none;
    box-sizing: border-box;
    z-index: 2;
    opacity: 1;
    transition: opacity var(--duration-fast) var(--easing-ease-in-out);
  }

  .tile-wrapper[data-border='off'] &::after {
    opacity: 0;
  }
  
  /* Padding controlled by individual tile components */
  /* This allows different tile types to use different padding amounts */
  
  /* Remove transition that causes drag lag */
  /* Only apply hover effect via :hover pseudo-class */
  .tile-wrapper:hover & {
    box-shadow: var(--shadow-tile-hover);
  }
}

.tile-wrapper[data-border='off'] {
  .card-body {
    background-color: var(--color-content-background);
  }
}

.meta-data {
  position: absolute;
  font-size: 10px;
  left: 10px;
  top: 10px;
}

/* Remove Button */
.btn-close {
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
  border-radius: 12px;
  padding: 4px;
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
  background-color: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-sm);
  height: 36px;
  width: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-ease-in-out),
              transform var(--duration-fast) var(--easing-ease-out),
              color var(--duration-fast) var(--easing-ease-in-out);

  svg {
    width: 28px;
    height: 28px;
    display: block;
  }

  &:hover {
    background-color: var(--color-content-low);
    transform: scale(1.05);
  }

  &.is-active {
    background-color: var(--color-text-primary);
    color: var(--color-tile-background);
    border-radius: var(--radius-sm);
    transform: none;
  }
}

.tile-wrapper[data-border='off'] {
  .tile-toolbar .toolbar-btn--border {
    color: var(--color-content-default);
  }

  .tile-toolbar .toolbar-btn--border .toolbar-icon-border .border-slash {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

.tile-toolbar .toolbar-btn--border .toolbar-icon-border .border-slash {
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
  opacity: 0;
  transition: stroke-dashoffset var(--duration-normal) var(--easing-spring),
    opacity var(--duration-fast) var(--easing-ease-in-out);
}

.tile-toolbar .toolbar-divider {
  width: 1px;
  height: 24px;
  margin: 2px;
  background-color: var(--color-tile-stroke);
  border-radius: 20px;
}

:deep(.hover-display) {
  display: none;
}

/* Show elements on tile hover with smooth animations */
.tile-wrapper:hover .header-options,
.tile-wrapper:hover :deep(.hover-display) {
  display: flex;
}

.tile-wrapper:hover .btn-close {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.tile-wrapper:hover .tile-toolbar {
  opacity: 1;
  transform: translate(-50%, 100%) scale(1);
  pointer-events: auto;
}
</style>