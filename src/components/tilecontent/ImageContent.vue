<template>
  <div class="image-container" ref="imageWrapper">
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
.image-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-lg);
  max-width: none;
  max-height: none;
  user-select: none;
  transform-origin: center;
  transition: transform 0.1s ease-out;
}
</style>
