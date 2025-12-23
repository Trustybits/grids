<template>
  <!-- Zoom Slider -->
  <div v-if="isEditing" class="zoom-slider">
    <input type="range" min="1" max="2" step="0.1" v-model.number="content.zoom" @input="saveLayout" />
  </div>

  <div class="video-container" :class="{ editing: isEditing }" ref="videoWrapper">
    <div v-if="!content.src" class="spinner"></div>
    <div v-else class="video-wrapper" ref="videoWrapper">
      <video
        ref="videoElement"
        :src="content.src"
        class="video contained-video"
        :style="videoStyle"
        draggable="false"
        controls
        @mousedown="startDragging"
        @mouseup="stopDragging"
        @mouseleave="stopDragging"
        @mousemove="dragVideo"
      ></video>
    </div>
    
    <video
      v-if="isEditing"
      :src="content.src"
      class="video full-video"
      :style="videoStyle"
      draggable="false"
    ></video>

    <!-- Edit Mode Button -->
    <button 
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
import { type VideoContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => VideoContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const isEditing = ref(false);
    const isDragging = ref(false);
    const dragStart = ref({ x: 0, y: 0 });
    const offset = ref({ x: props.content.offsetX || 0, y: props.content.offsetY || 0 });

    const videoWrapper = ref<HTMLDivElement | null>(null);
    const videoElement = ref<HTMLVideoElement | null>(null);

    // Toggle edit mode
    const toggleEditMode = () => {
      isEditing.value = !isEditing.value;

      if (!isEditing.value) {
        props.content.offsetX = offset.value.x;
        props.content.offsetY = offset.value.y;
        layoutStore.saveLayout();
      }
    };

    // Save layout on zoom change
    const saveLayout = () => {
      const wrapper = videoWrapper.value;
      if (!wrapper) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;
      const zoomFactor = props.content.zoom || 1;
      const videoWidth = containerWidth * zoomFactor;
      const videoHeight = containerHeight * zoomFactor;

      // Calculate bounds for dragging
      const minX = Math.min(0, containerWidth - videoWidth);
      const maxX = 0;
      const minY = Math.min(0, containerHeight - videoHeight);
      const maxY = 0;

      offset.value.x = Math.min(maxX, Math.max(minX, offset.value.x) / 1.4);
      offset.value.y = Math.min(maxY, Math.max(minY, offset.value.y) / 1.4);

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

    // Drag the video
    const dragVideo = (event: MouseEvent) => {
      if (!isDragging.value || !isEditing.value) return;

      const deltaX = event.clientX - dragStart.value.x;
      const deltaY = event.clientY - dragStart.value.y;

      const wrapper = videoWrapper.value;
      if (!wrapper) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;
      const zoomFactor = props.content.zoom || 1;
      const videoWidth = containerWidth * zoomFactor;
      const videoHeight = containerHeight * zoomFactor;

      const minX = Math.min(0, containerWidth - videoWidth) / 2;
      const maxX = 0 - minX;
      const minY = Math.min(0, containerHeight - videoHeight) / 2;
      const maxY = 0 - minY;

      offset.value.x = Math.min(maxX, Math.max(minX, offset.value.x + deltaX));
      offset.value.y = Math.min(maxY, Math.max(minY, offset.value.y + deltaY));

      dragStart.value = { x: event.clientX, y: event.clientY };
    };

    // Computed style for the video
    const videoStyle = computed(() => ({
      transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${props.content.zoom || 1})`,
      width: "100%",
      height: "100%",
      cursor: isEditing.value ? "grab" : "default",
    }));

    return {
      isEditing,
      toggleEditMode,
      startDragging,
      stopDragging,
      dragVideo,
      saveLayout,
      videoStyle,
      videoWrapper,
      videoElement,
    };
  },
});
</script>

<style scoped lang="scss">
.video-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.full-video {
  z-index: -1; 
  filter: brightness(50%);
  pointer-events: none;
}

.contained-video {
  z-index: 0;
}

.video-wrapper {
  border-radius: 8px;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.video {
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
