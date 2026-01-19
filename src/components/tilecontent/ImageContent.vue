<template>
  <!-- Zoom Slider -->
  <div v-if="layoutStore.isOwner && isEditing" class="zoom-slider">
    <input type="range" min="1" max="2" step="0.1" v-model.number="content.zoom" @input="saveLayout" />
  </div>
  <div class="image-container" :class="{ editing: isEditing }" ref="imageWrapper">
    <div v-if="!content.src" class="spinner"></div>
    <div v-else class="image-wrapper" ref="imageWrapper">
      <img
        :src="content.src"
        alt="Contained Image"
        class="image contained-image"
        :style="imageStyle"
        draggable="false"
        @mousedown="startDragging"
        @mouseup="stopDragging"
        @mouseleave="stopDragging"
        @mousemove="dragImage"
      />
    </div>
    
    <img
      v-if="isEditing"
      :src="content.src"
      alt="Darkened Image"
      class="image full-image"
      :style="imageStyle"
      draggable="false"
    />

    <!-- Edit Mode Button -->
    <button 
      v-if="layoutStore.isOwner"
      class="edit-button hover-display" 
      :style="{ display: isEditing ? 'flex' : '' }"
      @click="toggleEditMode"
    >
      {{ isEditing ? 'Done' : 'Edit' }}
    </button>
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
    const offset = ref({ x: props.content.offsetX || 0, y: props.content.offsetY || 0 });

    const imageWrapper = ref<HTMLDivElement | null>(null);

    // Toggle edit mode
    const toggleEditMode = () => {
      if (!layoutStore.isOwner) {
        return;
      }

      isEditing.value = !isEditing.value;

      // Save layout when leaving edit mode
      if (!isEditing.value) {
        props.content.offsetX = offset.value.x;
        props.content.offsetY = offset.value.y;
        layoutStore.saveLayout();
      }
    };

    // Save layout on slider change
    const saveLayout = () => {
      const wrapper = imageWrapper.value;
      if (!wrapper) return;

      // Container dimensions
      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;

      // Zoomed image dimensions
      const zoomFactor = props.content.zoom || 1;
      const imageWidth = containerWidth * zoomFactor;
      const imageHeight = containerHeight * zoomFactor;

      // Calculate bounds for dragging
      const minX = Math.min(0, containerWidth - imageWidth); // Left limit
      const maxX = 0; // Right limit (cannot move past the container)
      const minY = Math.min(0, containerHeight - imageHeight); // Top limit
      const maxY = 0; // Bottom limit (cannot move past the container)

      // Apply constraints to offsets
      offset.value.x = Math.min(maxX, Math.max(minX, offset.value.x) / 1.4);
      offset.value.y = Math.min(maxY, Math.max(minY, offset.value.y) / 1.4);

      // Save updated layout
      props.content.offsetX = offset.value.x;
      props.content.offsetY = offset.value.y;
    };


    // Start dragging
    const startDragging = (event: MouseEvent) => {
      if (!isEditing.value) return;
      isDragging.value = true;
      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    // Stop dragging
    const stopDragging = () => {
      isDragging.value = false;
    };

    // Drag the image
    const dragImage = (event: MouseEvent) => {
      if (!isDragging.value || !isEditing.value) return;

      const deltaX = event.clientX - dragStart.value.x;
      const deltaY = event.clientY - dragStart.value.y;

      const wrapper = imageWrapper.value;
      if (!wrapper) return;

      // Container dimensions
      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;

      // Zoomed image dimensions
      const zoomFactor = props.content.zoom || 1;
      const imageWidth = containerWidth * zoomFactor;
      const imageHeight = containerHeight * zoomFactor;

      // Calculate bounds for dragging
      const minX = Math.min(0, containerWidth - imageWidth) / 2; // Left limit
      const maxX = 0 - minX; // Right limit (cannot move past the container)
      const minY = Math.min(0, containerHeight - imageHeight) / 2; // Top limit
      const maxY = 0 - minY; // Bottom limit (cannot move past the container)

      // Apply constraints to offsets
      offset.value.x = Math.min(maxX, Math.max(minX, offset.value.x + deltaX));
      offset.value.y = Math.min(maxY, Math.max(minY, offset.value.y + deltaY));
      
      // Update the drag start position
      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    const onExitClick = () => {
      if (!layoutStore.isOwner) {
        return;
      }
      isEditing.value = false;
      layoutStore.saveLayout();
    }

    // Computed style for the image
    const imageStyle = computed(() => ({
      transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${props.content.zoom || 1})`,
      width: "100%",
      height: "100%",
      cursor: isEditing.value ? "grab" : "default",
    }));

    return {
      layoutStore,
      isEditing,
      toggleEditMode,
      startDragging,
      stopDragging,
      dragImage,
      saveLayout,
      imageStyle,
      imageWrapper,
      onExitClick,
    };
  },
});
</script>

<style scoped lang="scss">
.image-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.full-image {
  z-index: -1; 
  filter: brightness(50%);
  pointer-events: none;
}

.contained-image {
  z-index: 0;
}

.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.image {
  position: absolute;
  top: 0;
  left: 0;
  object-fit: cover;
  max-width: none;
  max-height: none;
  user-select: none;
}

.zoom-slider {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.edit-button {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
