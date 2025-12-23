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
    <div class="card-body" ref="gridTileRef">
      <div v-if="headerComponent" class="header-options">
        <component :is="headerComponent" :content="tile.content" />
      </div>

      <p v-if="layoutStore.showMetaData" class="meta-data">
        {{ `x: ${tile.x}, y: ${tile.y} w: ${tile.w} h: ${tile.h}` }}
      </p>

      <div class="card-inner h-100" @mousedown="startClick" @mouseup="endClick">
        <component
          :is="currentComponent"
          :content="tile.content"
          ref="childComponent"
        />
      </div>

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
  background-color: var(--tile-color);
  border-radius: 16px;
  backdrop-filter: blur(20px);

  .card-inner {
    width: 100%;
    height: 100%;

    // overflow: hidden;
  }

  .card-inner::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 16px;
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

  .meta-data {
    position: absolute;
    font-size: 10px;
    left: 10px;
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
</style>
