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
    @resized="onDragResize"
  >
    <div
      class="tile-wrapper"
      :data-border="borderEnabled ? 'on' : 'off'"
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
              <svg v-if="suggestionAction === 'text'" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 10.5V12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M19.7867 2.35955L20.0956 2.05059C20.6075 1.53868 21.4375 1.53868 21.9494 2.05059C22.4613 2.56249 22.4613 3.39244 21.9494 3.90435L21.6404 4.2133M19.7867 2.35955C19.7867 2.35955 19.8253 3.01609 20.4046 3.59539C20.9839 4.17468 21.6404 4.2133 21.6404 4.2133M19.7867 2.35955L16.9463 5.19996C16.7539 5.39236 16.6577 5.48853 16.575 5.59459C16.4774 5.71973 16.3937 5.85509 16.3255 5.99833C16.2676 6.11976 16.2246 6.24883 16.1385 6.50693L15.7739 7.60069M21.6404 4.2133L18.8 7.05373C18.6076 7.24609 18.5115 7.34229 18.4054 7.42503C18.2803 7.52263 18.1449 7.60629 18.0017 7.67456C17.8802 7.73243 17.7512 7.77543 17.4931 7.86146L16.3993 8.22606M15.7739 7.60069L15.6848 7.86806C15.6425 7.99506 15.6755 8.13509 15.7702 8.22979C15.8649 8.32446 16.0049 8.35753 16.132 8.31519L16.3993 8.22606M15.7739 7.60069L16.3993 8.22606" stroke="currentColor" stroke-width="1.5"/>
                <path d="M7 14H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M7 17.5H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <svg v-else-if="suggestionAction === 'media'" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M16 10C17.1046 10 18 9.10457 18 8C18 6.89543 17.1046 6 16 6C14.8954 6 14 6.89543 14 8C14 9.10457 14.8954 10 16 10Z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M5 13.307L5.81051 12.5542C6.73658 11.6941 8.18321 11.7424 9.04988 12.6623L11.6974 15.4727C12.2356 16.0439 13.1166 16.1209 13.7457 15.6516C14.6522 14.9753 15.9144 15.0522 16.7322 15.8334L19 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <svg v-else-if="suggestionAction === 'link'" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M9 16C7.11438 16 6.17157 16 5.58579 15.4142C5 14.8284 5 13.8856 5 12C5 10.1144 5 9.17157 5.58579 8.58579C6.17157 8 7.11438 8 9 8C10.8856 8 11.8284 8 12.4142 8.58579C13 9.17157 13 10.1144 13 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M11 12C11 13.8856 11 14.8284 11.5858 15.4142C12.1716 16 13.1144 16 15 16C16.8856 16 17.8284 16 18.4142 15.4142C19 14.8284 19 13.8856 19 12C19 10.1144 19 9.17157 18.4142 8.58579C17.8284 8 16.8856 8 15 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="suggestionAction === 'embed'" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.5 11L15.6716 11.1716C17.0049 12.5049 17.6716 13.1716 17.6716 14C17.6716 14.8284 17.0049 15.4951 15.6716 16.8284L15.5 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M13.2939 7.17041L11.9998 12L10.7058 16.8297" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M8.50019 7L8.32861 7.17157C6.99528 8.5049 6.32861 9.1716 6.32861 10C6.32861 10.8284 6.99528 11.4951 8.32861 12.8284L8.50019 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" stroke="currentColor" stroke-width="1.5"/>
              </svg>
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

        <button class="toolbar-btn" title="Tile color" @click.stop="onToolbarAction('color')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--color-figma-purple)" />
          </svg>
        </button>

        <button class="toolbar-btn" title="More" @click.stop="onToolbarAction('menu')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="12" r="1.25" fill="currentColor" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" />
            <circle cx="18" cy="12" r="1.25" fill="currentColor" />
          </svg>
        </button>
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
  provide,
} from "vue";
import { GridItem } from "vue3-grid-layout";
import { type Tile } from "@/types/Tile";
import { useLayoutStore } from "@/stores/layout";
import TileCaption from "./TileCaption.vue";
import { getContentComponent, getOptionComponent, createTileContent } from "@/utils/TileUtils";
import { ContentType } from "@/types/TileContent";
import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

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

    // Expose the tile's current grid height to content components.
    // This is used for responsive content rendering (e.g. title line clamping).
    provide("gridTileH", computed(() => props.tile.h));

    const isMoving = ref(false);
    const currentComponent = ref<any>(null);
    const headerComponent = ref<any>(null);
    const childComponent = ref<any>(null);
    const isEditing = ref(false);
    const gridTileRef = ref<HTMLElement | null>(null);

    const showCaption = computed(() => {
      // Hide caption for Link, Text, Embed, and Suggestion tiles as requested
      const hiddenTypes = [ContentType.LINK, ContentType.TEXT, ContentType.EMBED, ContentType.SUGGESTION];
      return !hiddenTypes.includes(props.tile.content.type);
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

    const toggleBorder = () => {
      layoutStore.toggleTileBorder(props.tile.i);
    };

    const onToolbarAction = (action: string) => {
      void action;
    };

    const onDragResize = () => {
      if (childComponent.value?.onResize) {
        childComponent.value.onResize();
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
          const embedContent = createTileContent(ContentType.EMBED, { src: url });
          layoutStore.setTileContent(props.tile.i, embedContent);
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
      showCaption,
      isPresetActive,
      borderEnabled,
      toggleBorder,
      onToolbarAction,

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