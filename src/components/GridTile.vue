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
    :isDraggable="layoutStore.isOwner && !isEditing && !isSuggestion"
    @move="onMove"
    @moved="onMoved"
    @resized="onResized"
  >
    <div
      class="tile-wrapper"
      :data-border="borderVisible ? 'on' : 'off'"
      :data-link-background="linkBackgroundEnabled ? 'on' : 'off'"
      :data-suggestion="isSuggestion ? 'true' : 'false'"
      ref="gridTileRef"
      @mousedown="startClick"
      @mouseup="endClick"
    >
      <!-- Visual Frame with Overflow Hidden -->
      <div class="card-body">
        <template v-if="!isSuggestion">
          <component
            :is="currentComponent"
            :content="tile.content"
            ref="childComponent"
          />
        </template>
        <template v-else>
          <div class="suggestion-cta">
            <div class="suggestion-icon">
              <TextIcon v-if="suggestionAction === 'text'" :size="48" />
              <ImageIcon v-else-if="suggestionAction === 'media'" :size="48" />
              <LinkIcon v-else-if="suggestionAction === 'link'" :size="48" />
              <EmbedIcon v-else-if="suggestionAction === 'embed'" :size="48" />
            </div>
            <span class="suggestion-label">{{ suggestionLabel }}</span>
          </div>
          <input
            v-if="layoutStore.isOwner"
            type="file"
            ref="mediaInput"
            style="display: none"
            accept="image/*,video/*"
            @change.stop="onMediaSelected"
          />
        </template>
      </div>

      <!-- UI Layer -->
      <div v-if="layoutStore.isOwner && headerComponent && !isSuggestion" class="header-options">
        <component :is="headerComponent" :content="tile.content" />
      </div>

      <p v-if="layoutStore.showMetaData" class="meta-data">
        {{ `x: ${tile.x}, y: ${tile.y} w: ${tile.w} h: ${tile.h}` }}
      </p>

      <button
        v-if="layoutStore.isOwner"
        class="btn btn-sm btn-danger btn-close"
        @mousedown.stop
        @mouseup.stop
        @click.stop="removeElement"
      ></button>

      <TileCaption v-if="showCaption && (layoutStore.isOwner || tile.caption)" :tile="tile" />

      <div v-if="layoutStore.isOwner && !isSuggestion" class="tile-toolbar" @mousedown.stop>
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

        <button
          class="toolbar-btn"
          :class="{ 'is-active': isLinkContent && linkBackgroundEnabled }"
          :title="
            isLinkContent
              ? linkBackgroundEnabled
                ? 'Hide background image'
                : 'Show background image'
              : 'Tile color'
          "
          @click.stop="onColorClick"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--color-figma-purple)" />
          </svg>
        </button>

        <button
          ref="toolbarMoreRef"
          class="toolbar-btn"
          title="More"
          @click.stop="onToolbarAction('menu')"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="12" r="1.25" fill="currentColor" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" />
            <circle cx="18" cy="12" r="1.25" fill="currentColor" />
          </svg>
        </button>
      </div>

      <teleport to="body">
        <div
          v-if="layoutStore.isOwner && isLinkContent && showToolbarMenu"
          ref="toolbarMenuRef"
          class="tile-toolbar-menu"
          :style="toolbarMenuStyle"
          @mousedown.stop
        >
          <button type="button" class="tile-toolbar-menu-item" @click.stop="handleToolbarUpload">
            Upload image
          </button>
          <button type="button" class="tile-toolbar-menu-item" @click.stop="handleToolbarUseUrl">
            Use image URL
          </button>
          <button
            v-if="hasCustomLinkImage"
            type="button"
            class="tile-toolbar-menu-item tile-toolbar-menu-item--danger"
            @click.stop="handleToolbarRemove"
          >
            Remove image
          </button>
        </div>
      </teleport>
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
  provide,
  nextTick,
} from "vue";

import { GridItem } from "vue3-grid-layout";
import { type Tile } from "@/types/Tile";
import { useLayoutStore } from "@/stores/layout";
import TileCaption from "./TileCaption.vue";
import {
  getContentComponent,
  getOptionComponent,
  createTileContent,
  createTileContentFromEmbedUrl,
} from "@/utils/TileUtils";
import { ContentType, type LinkContent } from "@/types/TileContent";
import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import TextIcon from "./icons/TextIcon.vue";
import ImageIcon from "./icons/ImageIcon.vue";
import LinkIcon from "./icons/LinkIcon.vue";
import EmbedIcon from "./icons/EmbedIcon.vue";

export default defineComponent({
  components: {
    GridItem,
    TileCaption,
    TextIcon,
    ImageIcon,
    LinkIcon,
    EmbedIcon,
  },
  props: {
    tile: {
      type: Object as () => Tile,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();

    // Expose the tile's current grid height to content components.
    // This is used for responsive content rendering (e.g. title line clamping).
    provide("gridTileH", computed(() => props.tile.h));
    provide("gridTileW", computed(() => props.tile.w));

    const isMoving = ref(false);
    const currentComponent = ref<any>(null);
    const headerComponent = ref<any>(null);
    const childComponent = ref<any>(null);
    const isEditing = ref(false);
    const gridTileRef = ref<HTMLElement | null>(null);
    const toolbarMenuRef = ref<HTMLDivElement | null>(null);
    const toolbarMoreRef = ref<HTMLButtonElement | null>(null);
    const showToolbarMenu = ref(false);
    const toolbarMenuPosition = ref({ x: 0, y: 0 });

    const showCaption = computed(() => {
      // Hide caption for Link, Text, Embed, Map, and Suggestion tiles as requested
      const hiddenTypes = [
        ContentType.LINK,
        ContentType.TEXT,
        ContentType.EMBED,
        ContentType.MAP,
        ContentType.SUGGESTION,
      ];
      return !hiddenTypes.includes(props.tile.content.type);
    });

    const isLinkContent = computed(() => props.tile.content.type === ContentType.LINK);
    const linkBackgroundEnabled = computed(() => {
      if (!isLinkContent.value) return true;
      const content = props.tile.content as LinkContent;
      return content.linkBackgroundEnabled !== false;
    });
    const hasCustomLinkImage = computed(() => {
      if (!isLinkContent.value) return false;
      return !!(props.tile.content as LinkContent).customImageUrl;
    });

    const clickStart = ref<number | null>(null);
    const CLICK_THRESHOLD = 150;

    const isSuggestion = computed(() => props.tile.content.type === ContentType.SUGGESTION);
    const suggestionAction = computed(() => (props.tile.content as any)?.action ?? "text");
    const suggestionLabel = computed(() => (props.tile.content as any)?.label ?? "");

    const mediaInput = ref<HTMLInputElement | null>(null);
    const auth = getAuth();
    const storage = getStorage();

    const loadComponent = async () => {
      currentComponent.value = await getContentComponent(props.tile.content);
      headerComponent.value = await getOptionComponent(props.tile.content);
    };

    const startClick = (event: MouseEvent) => {
      if (event.button === 0) {
        clickStart.value = Date.now();
      }
    };

    const clampMenuToViewport = (x: number, y: number, menuWidth: number, menuHeight: number) => {
      const padding = 8;
      const maxX = window.innerWidth - menuWidth - padding;
      const maxY = window.innerHeight - menuHeight - padding;
      return {
        x: Math.max(padding, Math.min(x, maxX)),
        y: Math.max(padding, Math.min(y, maxY)),
      };
    };

    const toolbarMenuStyle = computed(() => ({
      top: `${toolbarMenuPosition.value.y}px`,
      left: `${toolbarMenuPosition.value.x}px`,
    }));

    const positionToolbarMenu = () => {
      const button = toolbarMoreRef.value;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const fallbackWidth = 190;
      const fallbackHeight = hasCustomLinkImage.value ? 112 : 76;
      const fallbackX = rect.right - fallbackWidth;
      let fallbackY = rect.top - fallbackHeight - 8;
      if (fallbackY < 8) {
        fallbackY = rect.bottom + 8;
      }
      toolbarMenuPosition.value = clampMenuToViewport(
        fallbackX,
        fallbackY,
        fallbackWidth,
        fallbackHeight
      );

      nextTick(() => {
        const menu = toolbarMenuRef.value;
        if (!menu) return;
        const { width, height } = menu.getBoundingClientRect();
        const nextX = rect.right - width;
        let nextY = rect.top - height - 8;
        if (nextY < 8) {
          nextY = rect.bottom + 8;
        }
        toolbarMenuPosition.value = clampMenuToViewport(nextX, nextY, width, height);
      });
    };

    const closeToolbarMenu = () => {
      showToolbarMenu.value = false;
    };

    const handleToolbarUpload = () => {
      closeToolbarMenu();
      childComponent.value?.openCustomImagePicker?.();
    };

    const handleToolbarUseUrl = () => {
      closeToolbarMenu();
      childComponent.value?.openUrlInput?.();
    };

    const handleToolbarRemove = () => {
      closeToolbarMenu();
      childComponent.value?.removeCustomImage?.();
    };

    const handleToolbarMenuClickOutside = (event: MouseEvent) => {
      if (!showToolbarMenu.value) return;
      const target = event.target as Node;
      if (toolbarMenuRef.value?.contains(target)) return;
      if (toolbarMoreRef.value?.contains(target)) return;
      closeToolbarMenu();
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
        if (isSuggestion.value) {
          onSuggestionShortClick();
        } else {
          if (childComponent.value?.onShortClick) {
            childComponent.value.onShortClick();
          }
          if (childComponent.value?.onExitClick) {
            addClickListener();
          }
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

    // Watch for content type changes (e.g., suggestion -> text/image/link)
    watch(
      () => props.tile.content.type,
      () => {
        loadComponent();
      }
    );

    const onMove = () => {
      isMoving.value = true;
      setTimeout(() => (isMoving.value = false), 300);
    };

    const onMoved = () => {
      // Called when drag operation completes - save the final positions
      if (!layoutStore.isOwner) return;
      layoutStore.updateLayout();
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

    const borderVisible = computed(() => {
      if (!isLinkContent.value) {
        return borderEnabled.value;
      }
      return linkBackgroundEnabled.value ? borderEnabled.value : true;
    });

    const toggleBorder = () => {
      layoutStore.toggleTileBorder(props.tile.i);
    };

    const onToolbarAction = (action: string) => {
      if (action === "menu") {
        if (!isLinkContent.value) return;
        showToolbarMenu.value = !showToolbarMenu.value;
        if (showToolbarMenu.value) {
          positionToolbarMenu();
        }
        return;
      }
      void action;
    };

    const onColorClick = () => {
      if (isLinkContent.value) {
        layoutStore.toggleLinkBackground(props.tile.i);
        return;
      }
      onToolbarAction("color");
    };

    const onResized = () => {
      // Called when resize operation completes
      if (childComponent.value?.onResize) {
        childComponent.value.onResize();
      }
      // Save the layout with the new size
      if (layoutStore.isOwner) {
        layoutStore.updateLayout();
      }
    };

    const onSuggestionShortClick = () => {
      if (!layoutStore.isOwner) return;
      const action = (props.tile.content as any)?.action as "text" | "media" | "link" | "embed";
      switch (action) {
        case "text": {
          const content = createTileContent(ContentType.TEXT, {});
          layoutStore.setTileContent(props.tile.i, content);
          break;
        }
        case "media": {
          mediaInput.value?.click();
          break;
        }
        case "link": {
          const link = prompt("Please enter a link");
          if (!link) return;
          const linkContent = createTileContent(ContentType.LINK, { link });
          layoutStore.setTileContent(props.tile.i, linkContent);
          (async () => {
            try {
              const getLinkPreview = httpsCallable(functions, "getLinkPreview");
              const result = await getLinkPreview({ url: (linkContent as any).link });
              const data = result.data as any;

              layoutStore.patchTileContent(props.tile.i, {
                link: data?.url,
                domain: data?.domain,
                faviconUrl: data?.faviconUrl || (linkContent as any).faviconUrl,
                metaTitle: data?.title,
                metaDescription: data?.description,
                metaImageUrl: data?.imageUrl,
                metaSiteName: data?.siteName,
              });
            } catch (error) {
              console.error("Failed to fetch link preview:", error);
            }
          })();
          break;
        }
        case "embed": {
          const url = prompt("Please enter an embed URL");
          if (!url) return;
          const content = createTileContentFromEmbedUrl(url);
          layoutStore.setTileContent(props.tile.i, content);
          break;
        }
      }
    };

    const onMediaSelected = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

      if (!isImage && !isVideo) {
        alert("Unsupported file type. Please upload an image or video.");
        return;
      }

      if (file.size > maxSize) {
        alert(`File is too large! Maximum size: ${isImage ? "10MB" : "50MB"}`);
        return;
      }

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          alert("You must be logged in to upload.");
          return;
        }

        const filePath = `users/${currentUser.uid}/${isImage ? "images" : "videos"}/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, filePath);

        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        const contentType = isImage ? ContentType.IMAGE : ContentType.VIDEO;
        const content = createTileContent(contentType, { src: url });
        layoutStore.setTileContent(props.tile.i, content);
      } catch (error) {
        console.error("File upload failed:", error);
        alert("Failed to upload file. Please try again.");
      } finally {
        if (mediaInput.value) mediaInput.value.value = "";
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
      document.addEventListener("click", handleToolbarMenuClickOutside);
      document.addEventListener("contextmenu", handleToolbarMenuClickOutside);
    });

    onUnmounted(() => {
      removeClickListener(); // Cleanup on unmount
      document.removeEventListener("click", handleToolbarMenuClickOutside);
      document.removeEventListener("contextmenu", handleToolbarMenuClickOutside);
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
      onMoved,
      onResized,
      showCaption,
      isPresetActive,
      borderEnabled,
      borderVisible,
      toggleBorder,
      onToolbarAction,
      onColorClick,
      isLinkContent,
      linkBackgroundEnabled,
      hasCustomLinkImage,
      toolbarMenuRef,
      toolbarMoreRef,
      showToolbarMenu,
      toolbarMenuStyle,
      handleToolbarUpload,
      handleToolbarUseUrl,
      handleToolbarRemove,

      isSuggestion,
      suggestionAction,
      suggestionLabel,
      mediaInput,
      onMediaSelected,
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
  -webkit-mask-image: -webkit-radial-gradient(white, black);
  mask-image: radial-gradient(white, black);
  transform: translateZ(0);
  will-change: transform;
  
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

.tile-toolbar-menu {
  position: fixed;
  z-index: 1200;
  min-width: 180px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-tile-hover);
}

.tile-toolbar-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  text-align: left;
  font-size: 12px;
  line-height: 1;
}

.tile-toolbar-menu-item:hover {
  background: var(--color-content-low);
}

.tile-toolbar-menu-item--danger {
  color: #ff3737;
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

/* Suggestion tile specific styling */
.tile-wrapper[data-suggestion='true'] .card-body {
  border: 2px dashed var(--color-tile-stroke);
  background: rgba(255, 255, 255, 0.02);
}

.tile-wrapper[data-suggestion='true'] .card-body::after {
  opacity: 0;
}

/* Suggestion CTA styles */
.suggestion-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  cursor: pointer;
}

.suggestion-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: all 0.3s ease;
  color: var(--color-text-primary);
}

.tile-wrapper[data-suggestion='true']:hover .suggestion-icon {
  opacity: 1;
  transform: scale(1.05);
}

.suggestion-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
  opacity: 0.7;
  transition: opacity 0.3s ease;
}

.tile-wrapper[data-suggestion='true']:hover .suggestion-label {
  opacity: 1;
}
</style>