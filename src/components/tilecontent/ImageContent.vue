<template>
  <div class="image-container" ref="imageWrapper">
    <div v-if="!content.src" class="spinner"></div>
    <div 
      v-else 
      class="image-wrapper" 
      :class="{ 'crop-active': isEditing }"
      @mousedown="startDragging"
      @mouseup="stopDragging"
      @mouseleave="stopDragging"
      @mousemove="dragImage"
    >
      <!-- Dimmed overflow layer - full image at reduced opacity -->
      <img
        v-if="isEditing"
        :src="content.src"
        alt="Image"
        class="image image-overflow"
        :style="imageStyle"
        draggable="false"
      />
      
      <!-- Main layer - full opacity, clipped to tile boundaries -->
      <div class="image-clip-container">
        <img
          ref="imageElement"
          :src="content.src"
          alt="Image"
          class="image image-main"
          :style="imageStyle"
          draggable="false"
          @load="onImageLoad"
        />
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
    const imageWrapper = ref<HTMLDivElement | null>(null);
    const imageElement = ref<HTMLImageElement | null>(null);
    
    // Track dimensions for future features
    const imageDimensions = ref({ width: 0, height: 0, aspectRatio: 0 });
    const tileDimensions = computed(() => {
      if (!imageWrapper.value) return { width: 0, height: 0, aspectRatio: 0 };
      const width = imageWrapper.value.clientWidth;
      const height = imageWrapper.value.clientHeight;
      return { width, height, aspectRatio: width / height };
    });

    // Toggle crop mode
    const toggleEditMode = () => {
      if (!layoutStore.isOwner) return;

      isEditing.value = !isEditing.value;

      // Prevent horizontal scrolling when in crop mode
      if (isEditing.value) {
        document.body.style.overflowX = 'hidden';
      } else {
        document.body.style.overflowX = '';
      }

      // Save when exiting crop mode
      if (!isEditing.value) {
        props.content.offsetX = offsetX.value;
        props.content.offsetY = offsetY.value;
        layoutStore.saveLayout();
      }
    };

    const constrainOffset = () => {
      const wrapper = imageWrapper.value;
      if (!wrapper || !isEditing.value) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;
      
      // Calculate actual rendered dimensions based on aspect ratio comparison
      let renderedWidth: number;
      let renderedHeight: number;
      
      if (imageDimensions.value.aspectRatio > 0 && tileDimensions.value.aspectRatio > 0) {
        if (imageDimensions.value.aspectRatio > tileDimensions.value.aspectRatio) {
          // Image is wider - constrained by height
          renderedHeight = containerHeight;
          renderedWidth = renderedHeight * imageDimensions.value.aspectRatio;
        } else {
          // Image is taller - constrained by width
          renderedWidth = containerWidth;
          renderedHeight = renderedWidth / imageDimensions.value.aspectRatio;
        }
      } else {
        // Fallback to cover behavior
        renderedWidth = containerWidth;
        renderedHeight = containerHeight;
      }
      
      // Max offset is half the difference between rendered image and container
      const maxX = Math.max(0, (renderedWidth - containerWidth) / 2);
      const maxY = Math.max(0, (renderedHeight - containerHeight) / 2);

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

    const imageStyle = computed(() => {
      const cursor = isEditing.value ? (isDragging.value ? 'grabbing' : 'grab') : 'default';
      const baseTransform = `translate(-50%, -50%) translate(${offsetX.value}px, ${offsetY.value}px)`;
      
      // Always use calculated sizing based on aspect ratios to preserve crop
      if (imageDimensions.value.aspectRatio > 0 && tileDimensions.value.aspectRatio > 0) {
        if (imageDimensions.value.aspectRatio > tileDimensions.value.aspectRatio) {
          // Image is wider - constrain by height
          return { transform: baseTransform, cursor, width: 'auto', height: '100%' };
        } else {
          // Image is taller - constrain by width
          return { transform: baseTransform, cursor, width: '100%', height: 'auto' };
        }
      }
      
      // Fallback if dimensions not loaded yet
      return { transform: baseTransform, cursor, width: '100%', height: '100%' };
    });
    
    // Overflow layer sizing - ensures full image visible based on aspect ratios
    const overflowStyle = computed(() => {
      const baseTransform = `translate(-50%, -50%) translate(${offsetX.value}px, ${offsetY.value}px)`;
      const cursor = isEditing.value ? (isDragging.value ? 'grabbing' : 'grab') : 'default';
      
      // Compare aspect ratios to determine which dimension to constrain
      if (imageDimensions.value.aspectRatio > 0 && tileDimensions.value.aspectRatio > 0) {
        if (imageDimensions.value.aspectRatio > tileDimensions.value.aspectRatio) {
          // Image is wider - constrain by height, let width extend
          return { transform: baseTransform, cursor, width: 'auto', height: '100%' };
        } else {
          // Image is taller - constrain by width, let height extend  
          return { transform: baseTransform, cursor, width: '100%', height: 'auto' };
        }
      }
      
      // Fallback to cover behavior
      return { transform: baseTransform, cursor, width: '100%', height: '100%' };
    });

    // Track image dimensions when loaded
    const onImageLoad = () => {
      if (imageElement.value) {
        imageDimensions.value = {
          width: imageElement.value.naturalWidth,
          height: imageElement.value.naturalHeight,
          aspectRatio: imageElement.value.naturalWidth / imageElement.value.naturalHeight,
        };
      }
    };

    return {
      layoutStore,
      isEditing,
      toggleEditMode,
      startDragging,
      stopDragging,
      dragImage,
      imageStyle,
      overflowStyle,
      imageWrapper,
      imageElement,
      onImageLoad,
      imageDimensions,
      tileDimensions,
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
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--tile-border-radius);
  user-select: none;
  transform-origin: center;
}

/* Overflow layer - dimmed, shown only in crop mode */
.image-overflow {
  opacity: 0.4;
  z-index: 0;
}

/* Clipping container - constrains main image to tile boundaries */
.image-clip-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--tile-border-radius);
  z-index: 1;
}
</style>
