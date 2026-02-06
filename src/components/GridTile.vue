<template>
  <!-- Crop Mode Overlay - blurs everything outside the tile -->
  <div 
    v-if="(isEditing || isExitingCropMode) && isCroppable" 
    class="crop-mode-overlay" 
    :class="{ 'exiting': isExitingCropMode }"
    @click.stop="toggleCropMode"
  ></div>
  
  <div class="grid-item-container" :class="{ 'crop-mode-elevated': (isEditing || isExitingCropMode) && isCroppable }">
    <grid-item
      :i="tile.i"
      :x="tile.x"
      :y="tile.y"
      :w="tile.w"
      :h="tile.h"
      :style="tileStyle"
      :minW="1"
      :minH="1"
      :maxW="10"
      :maxH="10"
      :isDraggable="layoutStore.isOwner && !isEditing"
      :isResizable="isTileResizable"
      @move="onMove"
      @moved="onMoved"
      @resize="onResize"
      @resized="onResized"
    >
    <div
      class="tile-wrapper"
      :class="{ 
        'crop-mode-active': isEditing && isCroppable,
        'crop-mode-exiting': isExitingCropMode && isCroppable,
        'is-dragging': isDragging,
        'is-exiting': isExiting
      }"
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
            v-bind="contentProps"
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
              <ProfileIcon v-else-if="suggestionAction === 'profile'" :size="48" />
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
      <div v-if="layoutStore.isOwner && headerComponent" class="header-options">
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

      <!-- Resize indicator nubbin - shows on hover to indicate drag-to-resize capability -->
      <div v-if="isTileResizable" class="resize-indicator"></div>

      <!-- Resize indicator nubbin - shows on hover to indicate drag-to-resize capability -->
      <div v-if="isTileResizable" class="resize-indicator"></div>

      <div v-if="layoutStore.isOwner && !isSuggestion" class="tile-toolbar" :class="{ 'tile-toolbar-force-show': showToolbarMenu }" @mousedown.stop>
        <template v-if="!isProfileTile">
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
        </template>

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
          v-if="isCroppable"
          class="toolbar-btn"
          :class="{ 'is-active': isEditing }"
          title="Crop / Zoom"
          @click.stop="toggleCropMode"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 3v4H3v2h4v8a2 2 0 0 0 2 2h8v4h2v-4h4v-2h-4V9a2 2 0 0 0-2-2H9V3H7zm2 6h8v8H9V9z" fill="currentColor"/>
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
        <div
          v-if="layoutStore.isOwner && isTextContent && showToolbarMenu"
          ref="toolbarMenuRef"
          class='tile-toolbar-menu'
          :style="toolbarMenuStyle"
          @mousedown.stop
        >
          <button type="button" class="tile-toolbar-menu-item" @click.stop="handleToolbarUseUrl">
            <LinkIcon />
          </button>
        </div>
      </teleport>
    
    </div>
    </grid-item>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  computed,
  provide,
  nextTick,
  watch,
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
import ProfileIcon from "./icons/ProfileIcon.vue";

export default defineComponent({
  components: {
    GridItem,
    TileCaption,
    TextIcon,
    ImageIcon,
    LinkIcon,
    EmbedIcon,
    ProfileIcon,
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
    const isDragging = ref(false);
    const isExiting = ref(false);
    const currentComponent = ref<any>(null);
    const headerComponent = ref<any>(null);
    const childComponent = ref<any>(null);
    const isEditing = ref(false);
    const isExitingCropMode = ref(false);
    const gridTileRef = ref<HTMLElement | null>(null);
    const toolbarMenuRef = ref<HTMLDivElement | null>(null);
    const toolbarMoreRef = ref<HTMLButtonElement | null>(null);
    const showToolbarMenu = computed(() => layoutStore?.activeMenuTileId === props.tile.i);
    const toolbarMenuPosition = ref({ x: 0, y: 0 });
    let stopChildEditingWatch: (() => void) | null = null;

    const showCaption = computed(() => {
      // Hide caption for Link, Text, Chat, Embed, Map, Campfire, RPG, and Suggestion tiles as requested
      const hiddenTypes = [
        ContentType.LINK,
        ContentType.TEXT,
        ContentType.CHAT,
        ContentType.EMBED,
        ContentType.CAMPFIRE,
        ContentType.RPG,
        ContentType.MAP,
        ContentType.SUGGESTION,
        ContentType.PROFILE,
      ];
      return !hiddenTypes.includes(props.tile.content.type);
    });

    const isLinkContent = computed(() => props.tile.content.type === ContentType.LINK);
    const isTextContent = computed(() => props.tile.content.type === ContentType.TEXT);
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
    const contentProps = computed(() => {
      if (props.tile.content.type === ContentType.CHAT) {
        return {
          content: props.tile.content,
          tileId: props.tile.i,
        };
      }
      return { content: props.tile.content };
    });
    const suggestionAction = computed(() => (props.tile.content as any)?.action ?? "text");
    const suggestionLabel = computed(() => (props.tile.content as any)?.label ?? "");

    const isProfileTile = computed(() => props.tile.content.type === ContentType.PROFILE);
    const isTileResizable = computed(() => {
      if (!layoutStore.isOwner || isSuggestion.value || isProfileTile.value) {
        return false;
      }
      return !isEditing.value;
    });

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
        // Set dragging state immediately when user grabs the tile
        // This triggers the scale animation right away
        if (layoutStore.isOwner && !isEditing.value && !isSuggestion.value) {
          isDragging.value = true;
          event.preventDefault();
        }
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
      let fallbackY = rect.bottom + 8;
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
        let nextY = rect.bottom + 8;
        if (nextY < 8) {
          nextY = rect.bottom + 8;
        }
        toolbarMenuPosition.value = clampMenuToViewport(nextX, nextY, width, height);
      });
    };

    const closeToolbarMenu = () => {
      layoutStore.closeAllMenus();
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

      // Clear dragging state when user releases the mouse
      // This ensures the tile scales back down even if dragged to original position
      isDragging.value = false;

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
      // isDragging is now set in startClick, but keep this as a safety backup
      isDragging.value = true;
      setTimeout(() => (isMoving.value = false), 300);
    };

    const onMoved = () => {
      // Called when drag operation completes - save the final positions
      // isDragging is now cleared in endClick, but keep this as a safety backup
      isDragging.value = false;
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
        if (!isLinkContent.value && !isTextContent.value) return;
        if (showToolbarMenu.value) {
          layoutStore.closeAllMenus();
        } else {
          layoutStore.setActiveMenuTile(props.tile.i);
        }

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

    const onResize = (i: string, newH: number, newW: number, newHPx: number, newWPx: number) => {
      // Called during resize operation - snap to whole grid units for clean resizing
      const tile = layoutStore.currentLayout?.tiles.find((t) => t.i === i);
      if (tile) {
        // Round to nearest whole number to snap to grid units
        const roundedH = Math.round(newH);
        const roundedW = Math.round(newW);
        
        // Only update if the rounded values have changed to avoid unnecessary updates
        if (tile.h !== roundedH || tile.w !== roundedW) {
          tile.h = roundedH;
          tile.w = roundedW;
        }
      }
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
      const action = (props.tile.content as any)?.action as
        | "text"
        | "media"
        | "link"
        | "embed"
        | "profile";
      switch (action) {
        case "profile": {
          const content = createTileContent(ContentType.PROFILE, {});
          layoutStore.setTileContent(props.tile.i, content);
          break;
        }
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
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      
      // Reset input immediately so the same file can be selected again
      input.value = "";
      
      if (!file) return;

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const maxSize = isImage ? 10 * 1024 * 1024 : 500 * 1024 * 1024;

      if (!isImage && !isVideo) {
        alert("Unsupported file type. Please upload an image or video.");
        return;
      }

      if (file.size > maxSize) {
        alert(`File is too large! Maximum size: ${isImage ? "10MB" : "500MB"}`);
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
      } catch (error: any) {
        console.error("File upload failed:", error);
        // Show more specific error message to help with debugging
        const errorMessage = error?.message || error?.code || "Unknown error";
        alert(`Failed to upload file: ${errorMessage}\n\nCheck console for details.`);
      }
    };

    const removeElement = () => {
      // Trigger exit animation
      isExiting.value = true;
      
      // Wait for animation to complete before actually removing the tile
      setTimeout(() => {
        layoutStore.removeTile(props.tile.i);
      }, 250); // var(--duration-normal) = 250ms
    };

    const tileStyle = computed(() => {
      return {
        zIndex: isEditing.value ? 1 : 0,
      };
    });

    // Check if tile supports crop/zoom (IMAGE or VIDEO)
    const isCroppable = computed(() => {
      return props.tile.content.type === ContentType.IMAGE || props.tile.content.type === ContentType.VIDEO;
    });

    // Toggle crop/zoom mode for image/video tiles
    const toggleCropMode = () => {
      if (!childComponent.value?.toggleEditMode) return;
      
      // If currently editing, trigger exit animations first
      if (isEditing.value) {
        isExitingCropMode.value = true;
        
        // Wait for exit animations to complete (400ms + 50ms buffer)
        setTimeout(() => {
          childComponent.value?.toggleEditMode();
          if (childComponent.value?.isEditing !== undefined) {
            isEditing.value = childComponent.value.isEditing;
          }
          isExitingCropMode.value = false;
        }, 450);
      } else {
        // Entering crop mode - no delay needed
        childComponent.value.toggleEditMode();
        if (childComponent.value.isEditing !== undefined) {
          isEditing.value = childComponent.value.isEditing;
        }
      }
    };

    // Watch for changes in child editing state
    watch(() => childComponent.value, (newChild) => {
      if (stopChildEditingWatch) {
        stopChildEditingWatch();
        stopChildEditingWatch = null;
      }

      if (newChild && newChild.isEditing !== undefined) {
        stopChildEditingWatch = watch(() => newChild.isEditing, (editing) => {
          isEditing.value = editing;
        });
      }
    });

    const handleDragStart = (event: Event) => {
      // Prevent default browser drag behavior which interferes with vue-grid-layout
      if (layoutStore.isOwner && !isEditing.value && !isSuggestion.value) {
        event.preventDefault();
      }
    };

    onMounted(() => {
      loadComponent();
      document.addEventListener("click", handleToolbarMenuClickOutside);
      document.addEventListener("contextmenu", handleToolbarMenuClickOutside);
      
      // Add dragstart prevention to the grid tile element
      if (gridTileRef.value) {
        gridTileRef.value.addEventListener("dragstart", handleDragStart);
      }
    });

    onUnmounted(() => {
      stopChildEditingWatch?.();
      stopChildEditingWatch = null;
      removeClickListener(); // Cleanup on unmount
      document.removeEventListener("click", handleToolbarMenuClickOutside);
      document.removeEventListener("contextmenu", handleToolbarMenuClickOutside);
      
      // Remove dragstart listener
      if (gridTileRef.value) {
        gridTileRef.value.removeEventListener("dragstart", handleDragStart);
      }
    });

    return {
      currentComponent,
      contentProps,
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
      isDragging,
      isExiting,
      onMoved,
      onResize,
      onResized,
      showCaption,
      isPresetActive,
      borderEnabled,
      borderVisible,
      toggleBorder,
      onToolbarAction,
      onColorClick,
      isLinkContent,
      isTextContent,
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
      isProfileTile,
      isTileResizable,

      mediaInput,
      onMediaSelected,
      isCroppable,
      toggleCropMode,
      isExitingCropMode,
    };
  },
});
</script>

<style scoped lang="scss">
/* Grid Item Container - wraps grid-item */
.grid-item-container {
  position: relative;
  
  &.crop-mode-elevated {
    position: relative;
    z-index: 1000;
    isolation: isolate;
  }
}

/* Crop Mode Overlay - blurs background */
.crop-mode-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px) brightness(0.6);
  z-index: 999;
  cursor: pointer;
  animation: cropOverlayFadeIn var(--duration-slow) var(--easing-ease-out);
  
  &.exiting {
    animation: cropOverlayFadeOut var(--duration-slow) var(--easing-ease-in) forwards;
  }
}

@keyframes cropOverlayFadeIn {
  from {
    opacity: 0;
    backdrop-filter: blur(0px) brightness(1);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(12px) brightness(0.6);
  }
}

/* Tile entrance animation when created */
@keyframes tileEnter {
  from {
    opacity: 0;
    transform: scale(0.75);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Tile exit animation when deleted */
@keyframes tileExit {
  to {
    opacity: 0;
    transform: scale(0.75);
  }
}

.tile-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  
  /* Animate tiles when they first appear */
  animation: tileEnter var(--duration-normal) var(--easing-spring);
  
  /* Scale effect while dragging - applied to child element to avoid conflict with grid-item's inline transform */
  &.is-dragging {
    transform: scale(1.05);
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.25));
    transition: transform var(--duration-normal) var(--easing-ease-out),
                filter var(--duration-normal) var(--easing-ease-out);
  }
  
  /* Exit animation when tile is being deleted */
  &.is-exiting {
    animation: tileExit var(--duration-normal) var(--easing-ease-in) forwards;
    pointer-events: none;
  }
  
  &.crop-mode-active {
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      inset: -3px;
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: calc(var(--tile-border-radius) + 3px);
      pointer-events: none;
      z-index: 10;
      animation: cropOutlineFadeIn var(--duration-normal) var(--easing-ease-out);
    }
  }
  
  &.crop-mode-exiting {
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      inset: -3px;
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: calc(var(--tile-border-radius) + 3px);
      pointer-events: none;
      z-index: 10;
      animation: cropOutlineFadeOut var(--duration-normal) var(--easing-ease-in) forwards;
    }
  }
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
  overflow: hidden;
  isolation: isolate;
  transform: translateZ(0);
  -webkit-mask-image: -webkit-radial-gradient(white, black);
  mask-image: radial-gradient(white, black);
  will-change: transform;
  
  .crop-mode-active & {
    overflow: visible;
    -webkit-mask-image: none;
    mask-image: none;
    animation: cropBorderExpand var(--duration-slow) var(--easing-smooth);
  }
  
  .crop-mode-exiting & {
    overflow: visible;
    -webkit-mask-image: none;
    mask-image: none;
    animation: cropBorderContract var(--duration-slow) var(--easing-smooth) forwards;
  }
  
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
  z-index: 100;
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
  min-width: 50px;
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

/* Hide close button during crop mode and when exiting */
.tile-wrapper.crop-mode-active .btn-close,
.tile-wrapper.crop-mode-exiting .btn-close,
.tile-wrapper.is-exiting .btn-close {
  opacity: 0;
  transform: scale(0);
  pointer-events: none;
}

.tile-wrapper:hover .tile-toolbar,
.tile-wrapper.crop-mode-active .tile-toolbar,
.tile-wrapper.crop-mode-exiting .tile-toolbar {
  opacity: 1;
  transform: translate(-50%, 100%) scale(1);
  pointer-events: auto;
}

.tile-toolbar-force-show {
  opacity: 1;
  transform: translate(-50%, 100%) scale(1);
  pointer-events: auto;
}

/* Hide toolbar when tile is exiting */
.tile-wrapper.is-exiting .tile-toolbar {
  opacity: 0;
  transform: translate(-50%, calc(100% + 10px)) scale(0.9);
  pointer-events: none;
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

@keyframes cropBorderExpand {
  from {
    clip-path: inset(0 0 0 0 round var(--tile-border-radius));
  }
  to {
    clip-path: inset(-50% -50% -50% -50% round var(--tile-border-radius));
  }
}

@keyframes cropOutlineFadeIn {
  from {
    opacity: 0;
    border-color: rgba(255, 255, 255, 0);
  }
  to {
    opacity: 1;
    border-color: rgba(255, 255, 255, 0.9);
  }
}

/* Exit Animations - Reverse of Entry */
@keyframes cropOverlayFadeOut {
  from {
    opacity: 1;
    backdrop-filter: blur(12px) brightness(0.6);
  }
  to {
    opacity: 0;
    backdrop-filter: blur(0px) brightness(1);
  }
}

@keyframes cropControlsSlideUp {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
}

@keyframes cropBorderContract {
  from {
    clip-path: inset(-50% -50% -50% -50% round var(--tile-border-radius));
  }
  to {
    clip-path: inset(0 0 0 0 round var(--tile-border-radius));
  }
}

@keyframes cropOutlineFadeOut {
  from {
    opacity: 1;
    border-color: rgba(255, 255, 255, 0.9);
  }
  to {
    opacity: 0;
    border-color: rgba(255, 255, 255, 0);
  }
}

/* Resize indicator nubbin - appears in bottom-right corner on hover */
.resize-indicator {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 16px;
  height: 16px;
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--easing-ease-out);
  
  /* Create the nubbin shape using a pseudo-element */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 20px 20px;
    border-color: transparent transparent var(--color-content-default) transparent;
    opacity: 0.3;
    border-radius: 0 0 calc(var(--tile-border-radius) - 2px) 0;
  }
}

/* Show resize indicator when hovering the tile */
.tile-wrapper:hover .resize-indicator {
  opacity: 1;
}

/* Also show nubbin when hovering the resize handle (extended hit area) */
/* This keeps the nubbin visible even when cursor moves into the resize zone beyond the tile */
.grid-item-container:has(.vue-resizable-handle:hover) .resize-indicator {
  opacity: 1;
}

/* Increase the resize handle hit area for vue3-grid-layout */
/* The library uses .vue-resizable-handle class for the resize handle */
:deep(.vue-resizable-handle) {
  /* Increase the hit area from default small corner to a larger area */
  width: 48px !important;
  height: 48px !important;
  bottom: -8px !important;
  right: -8px !important;
  
  /* Make the handle itself invisible but keep the hit area */
  background-image: none !important;
  background-color: transparent !important;
  
  /* Ensure it's above other content but below toolbar */
  z-index: 4 !important;
  
  /* Cursor customization - use diagonal double arrow for bottom-right resize */
  /* Options: nwse-resize (diagonal \), nesw-resize (diagonal /), 
     nw-resize, ne-resize, sw-resize, se-resize (directional arrows) */
  cursor: nwse-resize !important;
  
  /* Scale up cursor when actively resizing (clicking and holding) */
  &:active {
    cursor: nwse-resize !important;
    /* Use a larger cursor size - browsers support cursor scaling via image */
    // cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'%3E%3Cpath fill='white' stroke='black' stroke-width='1' d='M22 2L2 22M22 2v6M22 2h-6M2 22v-6M2 22h6'/%3E%3C/svg%3E") 16 16, nwse-resize !important;
  }
}

/* Smooth animations for tile resizing */
/* Animate the actual tile (grid-item) during and after resize */
:deep(.vue-grid-item) {
  /* Disable transitions during resize for immediate snapping feedback */
  &.resizing {
    transition: none !important;
    /* Keep tile visible and stable during resize */
    opacity: 0.6 !important;
  }
  
  /* Smooth animation when resize completes */
  &:not(.resizing) {
    transition: width var(--duration-slow) var(--easing-spring),
                height var(--duration-slow) var(--easing-spring),
                transform var(--duration-slow) var(--easing-spring),
                opacity var(--duration-fast) var(--easing-ease-out) !important;
    opacity: 1 !important;
  }
}

/* Placeholder/silhouette that shows where the tile will land during resize */
:deep(.vue-grid-placeholder) {
  /* Remove transitions to prevent flickering - placeholder should update instantly */
  transition: none !important;
  animation: none !important;
  
  /* Ensure placeholder is always visible and stable */
  opacity: 0.3 !important;
  background: var(--color-text-primary) !important;
  border-radius: var(--tile-border-radius) !important;
  border: 2px dashed var(--color-text-primary) !important;
  
  /* Force the placeholder to always render and prevent any hiding */
  display: block !important;
  visibility: visible !important;
  pointer-events: none !important;
  
  /* Ensure it's positioned correctly and prevent any transforms that might hide it */
  position: absolute !important;
  z-index: 1 !important;
  
  /* Prevent the library from hiding it */
  width: auto !important;
  height: auto !important;
  min-width: 10px !important;
  min-height: 10px !important;
}
</style>