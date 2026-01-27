<template>
  <!-- Crop Mode Overlay -->
  <div v-if="isEditing" class="crop-overlay" @click.stop="toggleEditMode"></div>
  
  <div class="image-container" :class="{ 'crop-mode': isEditing }" ref="imageWrapper">
    <div v-if="!content.src" class="spinner"></div>
    <div v-else class="image-wrapper">
      <img
        :src="content.src"
        alt="Image"
        class="image"
        :style="imageStyle"
        draggable="false"
        @mousedown="startDragging"
        @mouseup="stopDragging"
        @mouseleave="stopDragging"
        @mousemove="dragImage"
        @wheel.prevent="handleWheel"
      />
    </div>
    
    <!-- Crop Mode Controls -->
    <div v-if="isEditing" class="crop-controls" @mousedown.stop>
      <div class="crop-controls-content">
        <input 
          type="range" 
          min="1" 
          max="3" 
          step="0.1" 
          v-model.number="zoom"
          @input="updateZoom"
        />
        <span>{{ Math.round(zoom * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from "vue";
import { type ImageContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => ImageContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();

    const isEditing = ref(false);
    const isDragging = ref(false);
    const dragStart = ref({ x: 0, y: 0 });
    const offsetX = ref(props.content.offsetX || 0);
    const offsetY = ref(props.content.offsetY || 0);
    const zoom = ref(props.content.zoom || 1);
    const imageWrapper = ref<HTMLDivElement | null>(null);

    // Toggle crop mode
    const toggleEditMode = () => {
      if (!layoutStore.isOwner) return;

      isEditing.value = !isEditing.value;

      // Save when exiting crop mode
      if (!isEditing.value) {
        props.content.offsetX = offsetX.value;
        props.content.offsetY = offsetY.value;
        props.content.zoom = zoom.value;
        layoutStore.saveLayout();
      }
    };

    const updateZoom = () => {
      // Constrain offsets when zoom changes
      constrainOffset();
    };

    const constrainOffset = () => {
      const wrapper = imageWrapper.value;
      if (!wrapper) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;
      const imageWidth = containerWidth * zoom.value;
      const imageHeight = containerHeight * zoom.value;

      // Max offset is half the difference between image and container
      const maxX = Math.max(0, (imageWidth - containerWidth) / 2);
      const maxY = Math.max(0, (imageHeight - containerHeight) / 2);

      offsetX.value = Math.min(maxX, Math.max(-maxX, offsetX.value));
      offsetY.value = Math.min(maxY, Math.max(-maxY, offsetY.value));
    };


    const startDragging = (event: MouseEvent) => {
      if (!isEditing.value) return;
      isDragging.value = true;
      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    const stopDragging = () => {
      isDragging.value = false;
    };

    const dragImage = (event: MouseEvent) => {
      if (!isDragging.value || !isEditing.value) return;

      const deltaX = event.clientX - dragStart.value.x;
      const deltaY = event.clientY - dragStart.value.y;

      offsetX.value += deltaX;
      offsetY.value += deltaY;

      constrainOffset();
      
      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    const handleWheel = (event: WheelEvent) => {
      if (!isEditing.value) return;
      
      const delta = -event.deltaY * 0.001;
      zoom.value = Math.min(3, Math.max(1, zoom.value + delta));
      constrainOffset();
    };

    const imageStyle = computed(() => ({
      transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${zoom.value})`,
      cursor: isEditing.value ? (isDragging.value ? 'grabbing' : 'grab') : 'default',
    }));

    return {
      layoutStore,
      isEditing,
      toggleEditMode,
      startDragging,
      stopDragging,
      dragImage,
      handleWheel,
      imageStyle,
      imageWrapper,
      zoom,
      updateZoom,
    };
  },
});
</script>

<style scoped lang="scss">
.crop-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 998;
  cursor: pointer;
}

.image-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  
  &.crop-mode {
    position: fixed;
    inset: 0;
    z-index: 999;
    width: auto;
    height: auto;
    overflow: visible;
  }
}

.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  
  .crop-mode & {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  max-width: none;
  max-height: none;
  user-select: none;
  transform-origin: center;
  transition: transform 0.1s ease-out;
  
  .crop-mode & {
    position: relative;
    width: auto;
    height: 80vh;
    max-width: 90vw;
    object-fit: contain;
  }
}

.crop-controls {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--color-tile-background);
  border: 2px solid var(--color-tile-stroke);
  border-radius: 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 20px;
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.crop-controls-content {
  display: flex;
  align-items: center;
  gap: 12px;
  
  label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    margin: 0;
  }
  
  input[type="range"] {
    width: 200px;
    height: 6px;
    border-radius: 3px;
    background: var(--color-content-low);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-text-primary);
      cursor: pointer;
    }
    
    &::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-text-primary);
      cursor: pointer;
      border: none;
    }
  }
  
  span {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }
}

.crop-done-btn {
  background: var(--color-text-primary);
  color: var(--color-tile-background);
  border: none;
  border-radius: 8px;
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }
  
  &:active {
    transform: scale(0.98);
  }
}
</style>
