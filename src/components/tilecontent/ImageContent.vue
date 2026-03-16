<template>
  <div class="image-container" ref="imageWrapper">
    <div v-if="!content.src" class="spinner"></div>
    <div
      v-else
      class="image-wrapper"
      :class="{
        'crop-active': isEditing,
        'owner-view': layoutStore.isOwner,
        'viewer-view': !layoutStore.isOwner,
        'has-link': tileLinkExists,
      }"
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
        <div
          v-if="overlayColor"
          class="image-color-overlay"
          :style="{ backgroundColor: overlayColor }"
          aria-hidden="true"
        />
      </div>

      <!-- Upload progress overlay - shown while file is uploading to Firebase -->
      <div v-if="isUploading" class="upload-overlay">
        <div class="upload-progress-track">
          <div
            class="upload-progress-fill"
            :style="{ width: `${uploadPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- Link indicator -->
      <div
        v-if="tileLinkExists"
        class="tile-link-indicator"
        aria-hidden="true"
        @click.stop="handleFollowLink"
      >
        <LinkIndicatorIcon class="tile-link-indicator-icon" />
      </div>
    </div>
  </div>
  <AddLinkModal
    :show="showLinkModal"
    @close="closeLinkModal"
    @add="handleAddLink"
  />
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  inject,
} from "vue";
import { type ImageContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import { useColorPicker } from "@/composables/useColorPicker";
import { useTileLink } from "@/composables/useTileLink";
import AddLinkModal from "../AddLinkModal.vue";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import type { ComputedRef } from "vue";

export default defineComponent({
  components: {
    AddLinkModal,
    LinkIndicatorIcon,
  },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => ImageContent,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();

    // Upload progress tracking — injected tile ID lets us look up our upload state
    const tileId = inject<string>("tileId", "");
    const isUploading = computed(() => {
      return (
        tileId != null && tileId !== "" && tileId in layoutStore.uploadingTiles
      );
    });
    const uploadPercent = computed(() => {
      if (!tileId) return 0;
      const progress = layoutStore.uploadingTiles[tileId] ?? 0;
      return Math.round(progress * 100);
    });

    const isEditing = ref(false);
    const isDragging = ref(false);
    const dragStart = ref({ x: 0, y: 0 });
    const offsetX = ref(props.content.offsetX || 0);
    const offsetY = ref(props.content.offsetY || 0);
    const imageWrapper = ref<HTMLDivElement | null>(null);
    const imageElement = ref<HTMLImageElement | null>(null);

    // Track dimensions for future features
    const imageDimensions = ref({ width: 0, height: 0, aspectRatio: 0 });
    const tileDimensions = ref({ width: 0, height: 0, aspectRatio: 0 });
    const resizeObserver = ref<ResizeObserver | null>(null);

    const updateTileDimensions = () => {
      if (!imageWrapper.value) return;
      const width = imageWrapper.value.clientWidth;
      const height = imageWrapper.value.clientHeight;
      tileDimensions.value = {
        width,
        height,
        aspectRatio: width && height ? width / height : 0,
      };
    };

    // Toggle crop mode
    const toggleEditMode = () => {
      if (!layoutStore.canEdit) return;

      isEditing.value = !isEditing.value;

      // Prevent horizontal scrolling when in crop mode
      if (isEditing.value) {
        document.body.style.overflowX = "hidden";
      } else {
        document.body.style.overflowX = "";
      }

      // Save when exiting crop mode
      if (!isEditing.value) {
        // Use patchTileContent to properly persist the offset changes to Firestore
        if (tileId && tileId !== "") {
          layoutStore.patchTileContent(tileId, {
            offsetX: offsetX.value,
            offsetY: offsetY.value,
          });
        }
      }
    };

    const constrainOffset = (force = false) => {
      const wrapper = imageWrapper.value;
      if (!wrapper || (!isEditing.value && !force)) return;

      // Don't constrain until image dimensions are loaded - prevents resetting saved offsets to 0
      if (
        imageDimensions.value.aspectRatio === 0 ||
        tileDimensions.value.aspectRatio === 0
      ) {
        return;
      }

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;

      // Calculate actual rendered dimensions based on aspect ratio comparison
      let renderedWidth: number;
      let renderedHeight: number;

      if (
        imageDimensions.value.aspectRatio > tileDimensions.value.aspectRatio
      ) {
        // Image is wider - constrained by height
        renderedHeight = containerHeight;
        renderedWidth = renderedHeight * imageDimensions.value.aspectRatio;
      } else {
        // Image is taller - constrained by width
        renderedWidth = containerWidth;
        renderedHeight = renderedWidth / imageDimensions.value.aspectRatio;
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
      const cursor = isEditing.value
        ? isDragging.value
          ? "grabbing"
          : "grab"
        : !layoutStore.isOwner && tileLinkExists.value
          ? "pointer"
          : "default";
      const baseTransform = `translate(-50%, -50%) translate(${offsetX.value}px, ${offsetY.value}px)`;

      if (
        imageDimensions.value.aspectRatio > 0 &&
        tileDimensions.value.aspectRatio > 0
      ) {
        if (
          imageDimensions.value.aspectRatio > tileDimensions.value.aspectRatio
        ) {
          return {
            transform: baseTransform,
            cursor,
            width: "auto",
            height: "100%",
          };
        }
        return {
          transform: baseTransform,
          cursor,
          width: "100%",
          height: "auto",
        };
      }

      return {
        transform: baseTransform,
        cursor,
        width: "100%",
        height: "100%",
      };
    });

    // Track image dimensions when loaded
    const onImageLoad = () => {
      if (imageElement.value) {
        imageDimensions.value = {
          width: imageElement.value.naturalWidth,
          height: imageElement.value.naturalHeight,
          aspectRatio:
            imageElement.value.naturalWidth / imageElement.value.naturalHeight,
        };
      }
    };

    onMounted(() => {
      updateTileDimensions();

      if (imageWrapper.value && typeof ResizeObserver !== "undefined") {
        resizeObserver.value = new ResizeObserver(() => {
          updateTileDimensions();
          constrainOffset(true);
        });
        resizeObserver.value.observe(imageWrapper.value);
      }
    });

    onUnmounted(() => {
      resizeObserver.value?.disconnect();
    });

    watch(imageDimensions, () => {
      constrainOffset(true);
    });

    const { overlayColor, handleBackgroundColorChange } = useColorPicker(
      tileId,
      props.content,
      emit,
      "overlay",
    );

    const {
      showLinkModal,
      tileLinkExists,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleFollowLink,
      clearLink,
    } = useTileLink(tileId || null, props.content);

    const onShortClick = () => {
      if (!layoutStore.isOwner && tileLinkExists.value) {
        handleFollowLink();
      }
    };

    return {
      layoutStore,
      isEditing,
      isUploading,
      uploadPercent,
      toggleEditMode,
      startDragging,
      stopDragging,
      dragImage,
      imageStyle,
      imageWrapper,
      imageElement,
      onImageLoad,
      imageDimensions,
      tileDimensions,
      overlayColor,
      handleBackgroundColorChange,
      showLinkModal,
      tileLinkExists,
      openUrlInput,
      closeLinkModal,
      handleAddLink,
      handleFollowLink,
      clearLink,
      onShortClick,
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

/* Color blend overlay - applied on top of image when a chromatic color is selected */
.image-color-overlay {
  position: absolute;
  inset: 0;
  mix-blend-mode: color;
  pointer-events: none;
  border-radius: var(--tile-border-radius);
}

/* Upload progress overlay — sits on top of the image preview during background upload */
.upload-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 0px;
  pointer-events: none;
  /* Subtle darkening so the progress bar is visible over any image */
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.35) 0%,
    transparent 40%
  );
  border-radius: var(--tile-border-radius);
}

.upload-progress-track {
  width: 100%;
  max-width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  overflow: hidden;
}

.upload-progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  transition: width 0.2s ease-out;
}

/* Link indicator */
.tile-link-indicator {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 24px;
  height: 24px;
  color: white;
  opacity: 0.21;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
  pointer-events: auto;
  z-index: 4;
}

.image-wrapper.viewer-view.has-link:hover .tile-link-indicator {
  opacity: 1;
}

.image-wrapper.viewer-view.has-link:hover {
  cursor: pointer !important;
}

.image-wrapper.owner-view .tile-link-indicator:hover {
  opacity: 1;
}

.tile-link-indicator:hover {
  cursor: pointer;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
