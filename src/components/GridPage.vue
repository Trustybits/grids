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
      
      <div v-if="layoutStore.isOwner" class="toolbar">
        <div class="row">
          <div class="col-md-12">
            <grid-buttons />
          </div>
        </div>
      </div>
      <grid :row-height="rowHeight" />
    </div>
  </div>

  <ShareButton />
  <GridMenu
    v-if="layoutStore.isOwner"
    @select-image="selectImage"
    @embed-background="embedBackground"
    @confirm-delete="confirmDelete"
  />
  <Divider />
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { getAuth } from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import Grid from "@/components/Grid.vue";
import GridButtons from "@/components/TileButtons.vue";
import GridMenu from "@/components/GridMenu.vue";
import ShareButton from "@/components/ShareButton.vue";
import Divider from "@/components/Divider.vue";
import { useLayoutStore } from "@/stores/layout";
import { usePageTitle } from "@/composables/usePageTitle";
import { useDragAndPaste } from "@/composables/useDragAndPaste";

export default defineComponent({
  components: {
    Grid,
    GridButtons,
    GridMenu,
    ShareButton,
    Divider,
  },
  setup() {
    const layoutStore = useLayoutStore();
    const rowHeight = 75;
    const auth = getAuth();
    const storage = getStorage();
    const imageInput = ref<HTMLInputElement | null>(null);
    const layoutContainer = ref<HTMLElement | null>(null);
    const route = useRoute();
    const router = useRouter();

    // Setup drag and drop + paste functionality
    const { isDraggingOver } = useDragAndPaste(layoutContainer);

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
        const currentUser = auth.currentUser;
        if (!currentUser) {
          alert("You must be logged in to upload an image.");
          return;
        }

        const filePath = `users/${currentUser.uid}/images/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, filePath);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        layoutStore.addBackgroundImage(url, false);
      } catch (error) {
        console.error("Failed to upload image:", error);
        alert("Failed to upload image. Please try again.");
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

    onMounted(() => {
      const layoutId = route.params.id;
      if (layoutId) {
        layoutStore.loadLayout(layoutId as string);
      } else {
        console.error("Layout ID is missing in the route.");
      }
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
      auth,
      isOwner,
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
  padding-top: 2rem;
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  
  .drag-message {
    background: var(--bs-body-bg);
    border: 2px dashed var(--bs-primary);
    border-radius: 1rem;
    padding: 3rem 4rem;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    
    svg {
      color: var(--bs-primary);
      margin-bottom: 1rem;
      animation: bounce 1s ease-in-out infinite;
    }
    
    p {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--bs-body-color);
    }
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
</style>
