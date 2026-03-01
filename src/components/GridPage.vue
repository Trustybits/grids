<template>
  <div class="background-image-container">
    <div :style="backgroundStyle" class="background-image-overlay"></div>

    <input
      v-if="layoutStore.isOwner"
      type="file"
      ref="imageInput"
      style="display: none"
      accept="image/*,image/svg+xml"
      @change.stop="addBackgroundImage"
    />
    <iframe
      v-if="layoutStore.currentLayout?.backgroundEmbed"
      style="width: 100%; height: 100%; position: fixed; top: 0; z-index: 0"
      scrolling="no"
      :src="layoutStore.currentLayout?.backgroundImageSrc"
      frameborder="no"
      loading="lazy"
      allowtransparency="true"
      allowfullscreen="true"
    >
      embedded background
    </iframe>

    <div class="layout-container" ref="layoutContainer" :class="{ 'drag-over': isDraggingOver }">
      <!-- Drag overlay indicator -->
      <div v-if="isDraggingOver && layoutStore.isOwner" class="drag-overlay">
        <div class="drag-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p>Drop to add to grid</p>
        </div>
      </div>
      
      <div v-if="layoutStore.isOwner && !layoutStore.activeTileId" class="toolbar">
        <div class="row">
          <div class="col-md-12">
            <grid-buttons />
          </div>
        </div>
      </div>
      <grid :row-height="rowHeight" />
    </div>
  </div>

  <BottomLeftButtons
    v-if="!layoutStore.activeTileId"
    :show-grid-menu="layoutStore.isOwner"
    :show-share-button="true"
    :show-user-menu="!!auth.currentUser"
    @select-image="selectImage"
    @embed-background="embedBackground"
    @confirm-delete="confirmDelete"
  />
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import Grid from "@/components/Grid.vue";
import GridButtons from "@/components/TileButtons.vue";
import BottomLeftButtons from "@/components/BottomLeftButtons.vue";
import { useLayoutStore } from "@/stores/layout";
import { usePageTitle } from "@/composables/usePageTitle";
import { useDragAndPaste } from "@/composables/useDragAndPaste";
import { useFileUpload } from "@/composables/useFileUpload";
import { auth } from "@/firebase";

export default defineComponent({
  components: {
    Grid,
    GridButtons,
    BottomLeftButtons,
  },
  setup() {
    const layoutStore = useLayoutStore();
    const rowHeight = 75;
    const imageInput = ref<HTMLInputElement | null>(null);
    const layoutContainer = ref<HTMLElement | null>(null);
    const route = useRoute();
    const router = useRouter();

    // Setup drag and drop + paste functionality
    const { isDraggingOver } = useDragAndPaste(layoutContainer);
    const { uploadFileToUrl } = useFileUpload();

    const isOwner = computed(() => {
      return layoutStore.isOwner;
    });

    const selectImage = () => {
      if (!layoutStore.isOwner) return;
      imageInput.value?.click();
    };

    const backgroundStyle = computed(() => {
      return {
        backgroundImage: `url(${layoutStore.currentLayout?.backgroundImageSrc})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        position: "fixed" as const,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
      };
    });

    // Dynamic page title with grid name
    const gridName = computed(() => layoutStore.currentLayout?.name);
    usePageTitle(gridName, '|');

    const addBackgroundImage = async (event: Event) => {
      if (!layoutStore.isOwner) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const url = await uploadFileToUrl(file, { fileType: "images" });
        layoutStore.addBackgroundImage(url, false);
      } catch (error: any) {
        console.error("Failed to upload image:", error);
        alert(error.message || "Failed to upload image. Please try again.");
      }
    };

    const embedBackground = () => {
      if (!layoutStore.isOwner) return;
      const link = prompt("Please enter an embed URL");
      if (link) {
        layoutStore.addBackgroundImage(link, true);
      }
    };

    const confirmDelete = async () => {
      if (!layoutStore.isOwner) return;
      if (!layoutStore.currentLayout) return;

      const confirmed = confirm("Are you sure you want to delete this layout?");
      if (!confirmed) return;

      await layoutStore.deleteLayout(layoutStore.currentLayout.id);
      router.push("/dashboard");
    };

    // Deactivate mobile-active tile when tapping outside of any tile
    const handleGlobalTouchEnd = (event: TouchEvent) => {
      if (!layoutStore.activeTileId) return;
      const target = event.target as HTMLElement;
      // If the tap landed inside a tile-wrapper or the mobile toolbar, keep it active
      if (
        target.closest('.tile-wrapper') ||
        target.closest('.mobile-tile-toolbar')
      ) {
        return;
      }
      layoutStore.clearActiveTile();
    };

    onMounted(() => {
      document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });

      const layoutId = route.params.id;
      if (layoutId) {
        layoutStore.loadLayout(layoutId as string);
      } else {
        console.error("Layout ID is missing in the route.");
      }
    });

    onUnmounted(() => {
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    });

    watch(
      () => route.params.id,
      (newId) => {
        if (newId) {
          layoutStore.loadLayout(newId as string);
        }
      }
    );

    return {
      layoutStore,
      rowHeight,
      backgroundStyle,
      addBackgroundImage,
      selectImage,
      embedBackground,
      confirmDelete,
      imageInput,
      layoutContainer,
      isDraggingOver,
      isOwner,
      auth,
    };
  },
});
</script>

<style lang="scss">
.toolbar {
  position: fixed;
  z-index: var(--z-dropdown);
  bottom: 0rem;
  left: 50vw;
  transform: translate(-50%, -10%);
}

.layout-container {
  padding-top: var(--spacing-2xl);
  padding-bottom: var(--spacing-4xl);
  position: relative;
  
  &.drag-over {
    .drag-overlay {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--color-content-background) 50%, transparent);
  backdrop-filter: blur(8px);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-out);
  
  .drag-message {
    background: var(--color-tile-background);
    border: var(--tile-border-width) solid var(--color-tile-stroke);
    border-style: dashed;
    border-radius: var(--tile-border-radius);
    padding: 2rem 3rem;
    text-align: center;
    box-shadow: var(--shadow-tile-hover);
    
    svg {
      color: var(--color-text-primary);
      margin-bottom: 0.75rem;
      opacity: 0.7;
      width: 48px;
      height: 48px;
      animation: bounce 2s ease-in-out infinite;
    }
    
    p {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text-primary);
      opacity: 0.8;
    }
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
</style>
