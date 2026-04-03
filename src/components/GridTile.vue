<template>
  <!-- Crop Mode Overlay - blurs everything outside the tile -->
  <div
    v-if="(isEditing || isExitingCropMode) && isCroppable"
    class="crop-mode-overlay"
    :class="{ exiting: isExitingCropMode }"
    @click.stop="toggleCropMode"
  ></div>

  <div
    class="grid-item-container"
    :class="{
      'crop-mode-elevated': (isEditing || isExitingCropMode) && isCroppable,
    }"
  >
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
      :isDraggable="isTileDraggable"
      :isResizable="isTileResizable"
      dragIgnoreFrom="a, button, input, .tile-caption"
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
          'is-exiting': isExiting,
          'is-activated': isActivated,
        }"
        :data-border="borderVisible ? 'on' : 'off'"
        :data-link-background="linkBackgroundEnabled ? 'on' : 'off'"
        :data-suggestion="isSuggestion ? 'true' : 'false'"
        :data-active-zone="hoveredToolbarZone || ''"
        ref="gridTileRef"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
        @mousedown="startClick"
        @mouseup="endClick"
      >
        <!-- Visual Frame with Overflow Hidden -->
        <div
          class="card-body"
          :style="{
            '--tile-bg': !!contentBackgroundColor
              ? contentBackgroundColor
              : 'var(--color-tile-background)',
            '--tile-text-color': !!contentTextColor
              ? contentTextColor
              : 'var(--color-text-primary)',
          }"
        >
          <template v-if="!isSuggestion">
            <component
              :is="currentComponent"
              v-bind="contentProps"
              ref="childComponent"
              @background-color-change="onContentBackgroundColorChange"
              @text-color-change="onContentTextColorChange"
            />
          </template>
          <template v-else>
            <div class="suggestion-cta">
              <div class="suggestion-icon">
                <TextIcon v-if="suggestionAction === 'text'" :size="48" />
                <ImageIcon
                  v-else-if="suggestionAction === 'media'"
                  :size="48"
                />
                <LinkIcon v-else-if="suggestionAction === 'link'" :size="48" />
                <EmbedIcon
                  v-else-if="suggestionAction === 'embed'"
                  :size="48"
                />
                <ProfileIcon
                  v-else-if="suggestionAction === 'profile'"
                  :size="48"
                />
              </div>
              <span class="suggestion-label">{{ suggestionLabel }}</span>
            </div>
            <input
              v-if="layoutStore.canEdit"
              type="file"
              ref="mediaInput"
              style="display: none"
              accept="image/*,video/*"
              @change.stop="onMediaSelected"
            />
          </template>
        </div>

        <!-- UI Layer -->
        <div
          v-if="layoutStore.canEdit && headerComponent"
          class="header-options"
        >
          <component :is="headerComponent" :content="tile.content" />
        </div>

        <div v-if="layoutStore.showMetaData" class="meta-data">
          <p class="meta-data__compact">{{ compactMetadata }}</p>
          <p
            v-if="layoutStore.showMetaDataVerbose"
            class="meta-data__verbose"
            v-for="line in verboseMetadataLines"
            :key="line"
          >
            {{ line }}
          </p>
        </div>

        <div
          v-if="layoutStore.canEdit && !isSuggestion"
          class="tile-actions-layer"
          :class="{ 'z-priority': hoveredLayer === 'actions' }"
          @mouseenter="hoveredLayer = 'actions'"
          @mouseleave="hoveredLayer = null"
        >
          <TileActions :tile="tile" @delete="removeElement" />
        </div>

        <TileCaption
          v-if="showCaption && (layoutStore.canEdit || tile.caption)"
          :tile="tile"
        />

        <!-- Resize indicator nubbin - shows on hover to indicate drag-to-resize capability -->
        <div v-if="isTileResizable" class="resize-indicator"></div>

        <div
          v-if="layoutStore.canEdit && !isSuggestion"
          class="tile-toolbar-layer"
          :class="{ 'z-priority': hoveredLayer !== 'actions' }"
          @mouseenter="hoveredLayer = 'toolbar'"
          @mouseleave="hoveredLayer = null"
        >
          <TileToolbar :tile="tile" :toolbarRefs="toolbarRefs" />
        </div>
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
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import TextIcon from "./icons/TextIcon.vue";
import ImageIcon from "./icons/ImageIcon.vue";
import LinkIcon from "./icons/LinkIcon.vue";
import EmbedIcon from "./icons/EmbedIcon.vue";
import ProfileIcon from "./icons/ProfileIcon.vue";
import TileToolbar from "./TileToolbar.vue";
import TileActions from "./TileActions.vue";
import { useFileUpload } from "@/composables/useFileUpload";
import ColorPicker from "./ColorPicker.vue";

export default defineComponent({
  components: {
    GridItem,
    TileCaption,
    TileToolbar,
    TileActions,
    TextIcon,
    ImageIcon,
    LinkIcon,
    EmbedIcon,
    ProfileIcon,
    ColorPicker,
  },
  props: {
    tile: {
      type: Object as () => Tile,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const { uploadFileOptimisticForTile } = useFileUpload();

    // Expose the tile's current grid height to content components.
    // This is used for responsive content rendering (e.g. title line clamping).
    provide(
      "gridTileH",
      computed(() => props.tile.h),
    );
    provide(
      "gridTileW",
      computed(() => props.tile.w),
    );
    /*provide("tileId", computed(() => props.tile.i));*/
    provide("tileId", props.tile.i);
    provide(
      "tileX",
      computed(() => props.tile.x),
    );
    provide(
      "tileY",
      computed(() => props.tile.y),
    );

    const isTouchDevice = () =>
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    const isMoving = ref(false);
    const isDragging = ref(false);
    const isExiting = ref(false);
    const isActivated = ref(false);
    const isHovered = ref(false);
    const hoveredToolbarZone = ref<string | null>(null);
    provide("hoveredToolbarZone", hoveredToolbarZone);
    const hoveredLayer = ref<"actions" | "toolbar" | null>(null);
    const currentComponent = ref<any>(null);
    const headerComponent = ref<any>(null);
    const childComponent = ref<any>(null);
    const gridTileRef = ref<HTMLElement | null>(null);
    const isEditing = ref(false);
    const isExitingCropMode = ref(false);
    let stopChildEditingWatch: (() => void) | null = null;
    const contentBackgroundColor = ref<string | null>(null);
    const contentTextColor = ref<string | null>(null);

    const onContentBackgroundColorChange = (color: string) => {
      contentBackgroundColor.value = color;
    };

    const onContentTextColorChange = (color: string) => {
      contentTextColor.value = color;
    };

    const showCaption = computed(() => {
      // Hide caption for Link, Text, Chat, Embed, Map, Campfire, RPG, YouTube, and Suggestion tiles as requested
      const hiddenTypes = [
        ContentType.LINK,
        ContentType.TEXT,
        ContentType.CHAT,
        ContentType.EMBED,
        ContentType.CAMPFIRE,
        ContentType.RPG,
        ContentType.SUGGESTION,
        ContentType.PROFILE,
        ContentType.YOUTUBE,
        ContentType.MUSIC,
      ];
      if (hiddenTypes.includes(props.tile.content.type)) return false;
      // Hide caption on 1-wide tiles (too narrow)
      if (props.tile.w === 1) return false;
      return true;
    });

    const isLinkContent = computed(
      () => props.tile.content.type === ContentType.LINK,
    );
    const linkBackgroundEnabled = computed(() => {
      if (!isLinkContent.value) return true;
      const content = props.tile.content as LinkContent;
      return content.linkBackgroundEnabled !== false;
    });

    const clickStart = ref<number | null>(null);
    const CLICK_THRESHOLD = 150;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;

    const isSuggestion = computed(
      () => props.tile.content.type === ContentType.SUGGESTION,
    );
    const contentProps = computed(() => {
      if (props.tile.content.type === ContentType.CHAT) {
        return {
          content: props.tile.content,
          tileId: props.tile.i,
        };
      }
      return { content: props.tile.content };
    });
    const suggestionAction = computed(
      () => (props.tile.content as any)?.action ?? "text",
    );
    const suggestionLabel = computed(
      () => (props.tile.content as any)?.label ?? "",
    );

    const isProfileTile = computed(
      () => props.tile.content.type === ContentType.PROFILE,
    );
    const isTileDraggable = computed(() => {
      if (!layoutStore.canEdit || isEditing.value) return false;
      if (isTouchDevice()) return isActivated.value;
      return true;
    });

    const isTileResizable = computed(() => {
      if (!layoutStore.canEdit || isSuggestion.value) {
        return false;
      }
      if (isTouchDevice()) return isActivated.value && !isEditing.value;
      return !isEditing.value;
    });

    const mediaInput = ref<HTMLInputElement | null>(null);

    const loadComponent = async () => {
      currentComponent.value = await getContentComponent(props.tile.content);
      headerComponent.value = await getOptionComponent(props.tile.content);
    };

    const startClick = (event: MouseEvent) => {
      if (event.button === 0) {
        clickStart.value = Date.now();
        // Only preventDefault when the child doesn't handle short clicks
        // (e.g. text tiles need the default focus behavior on mousedown)
        if (layoutStore.canEdit && !isEditing.value && !isSuggestion.value) {
          if (!childComponent.value?.onShortClick) {
            event.preventDefault();
          }
        }
        // Start long-press timer: activate isDragging after threshold
        if (layoutStore.isOwner && !isEditing.value) {
          if (longPressTimer) clearTimeout(longPressTimer);
          longPressTimer = setTimeout(() => {
            isDragging.value = true;
            longPressTimer = null;
          }, CLICK_THRESHOLD);
        }
      }
    };

    const endClick = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      // Cancel long-press timer if still pending
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      isDragging.value = false;

      const clickDuration = Date.now() - (clickStart.value || 0);

      if (clickDuration < CLICK_THRESHOLD && !isMoving.value) {
        if (isSuggestion.value) {
          onSuggestionShortClick();
        } else {
          if (childComponent.value?.onShortClick) {
            childComponent.value.onShortClick(event);
          }
          if (childComponent.value?.onExitClick) {
            addClickListener();
          }
        }
      }

      clickStart.value = null;
    };

    const onMove = () => {
      isMoving.value = true;
      isDragging.value = true;
      setTimeout(() => (isMoving.value = false), 300);
    };

    const onMoved = () => {
      // Called when drag operation completes - save the final positions
      isDragging.value = false;
      if (!layoutStore.canEdit) return;
      if (layoutStore.activeBreakpoint !== "lg") {
        layoutStore.updateBreakpointOverride();
      } else {
        layoutStore.updateLayout();
      }
    };

    const onResize = (
      i: string,
      newH: number,
      newW: number,
      newHPx: number,
      newWPx: number,
    ) => {
      // Called during resize operation - snap to whole grid units for clean resizing
      // Only mutate the store's canonical tiles at the lg (default) breakpoint.
      // At smaller breakpoints the displayLayout contains detached copies;
      // vue3-grid-layout will mutate those in-place and the override system
      // snapshots them via displayPositions when the resize finishes.
      if (layoutStore.activeBreakpoint !== "lg") return;

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
      if (layoutStore.canEdit) {
        if (layoutStore.activeBreakpoint !== "lg") {
          layoutStore.updateBreakpointOverride();
        } else {
          layoutStore.updateLayout();
        }
      }
    };

    const onSuggestionShortClick = () => {
      if (!layoutStore.canEdit) return;
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
          // Auto-focus the new text tile so the user can start typing immediately
          layoutStore.pendingFocusTileId = props.tile.i;
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
              const url = ((linkContent as any).link || "").trim();
              if (/^(mailto|tel):/i.test(url)) return;

              const getLinkPreview = httpsCallable(functions, "getLinkPreview");
              const result = await getLinkPreview({
                url,
              });
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
      try {
        await uploadFileOptimisticForTile(file, props.tile.i);
      } catch (error: any) {
        const errorMessage = error?.message || error?.code || "Unknown error";
        alert(`Failed to upload file: ${errorMessage}`);
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
      const isToolbarActive =
        isHovered.value ||
        isActivated.value ||
        layoutStore.activeTileId === props.tile.i;

      return {
        zIndex: isEditing.value || isToolbarActive ? 10 : 0,
      };
    });

    // Check if tile supports crop/zoom (IMAGE or VIDEO)
    const isCroppable = computed(() => {
      return (
        props.tile.content.type === ContentType.IMAGE ||
        props.tile.content.type === ContentType.VIDEO
      );
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
    watch(
      () => childComponent.value,
      (newChild) => {
        if (stopChildEditingWatch) {
          stopChildEditingWatch();
          stopChildEditingWatch = null;
        }

        if (newChild && newChild.isEditing !== undefined) {
          stopChildEditingWatch = watch(
            () => newChild.isEditing,
            (editing) => {
              isEditing.value = editing;
            },
          );
        }
      },
    );

    const deactivateTile = () => {
      isActivated.value = false;
    };

    const handleTouchOutside = (event: TouchEvent) => {
      if (
        gridTileRef.value &&
        !gridTileRef.value.contains(event.target as Node)
      ) {
        deactivateTile();
        document.removeEventListener("touchstart", handleTouchOutside);
      }
    };

    let touchWasActivating = false;

    const handleTouchStart = (event: TouchEvent) => {
      if (!isTouchDevice()) return;

      if (!isActivated.value) {
        // First touch: activate the tile, allow scroll to continue
        isActivated.value = true;
        touchWasActivating = true;
        clickStart.value = Date.now();
        document.addEventListener("touchstart", handleTouchOutside, {
          passive: true,
        });
        // Do NOT preventDefault — let the browser scroll naturally
      } else {
        // Subsequent touch: tile already activated, treat as interaction
        touchWasActivating = false;
        clickStart.value = Date.now();
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!isTouchDevice()) return;
      if (!isActivated.value) return;

      // Skip interaction on the tap that just activated the tile
      if (touchWasActivating) {
        touchWasActivating = false;
        return;
      }

      const touchDuration = Date.now() - (clickStart.value || Date.now());

      // Only fire short-click if it was a quick tap (not a scroll)
      if (touchDuration < CLICK_THRESHOLD) {
        if (isSuggestion.value) {
          onSuggestionShortClick();
        } else {
          if (childComponent.value?.onShortClick) {
            childComponent.value.onShortClick(event as unknown as MouseEvent);
          }
          if (childComponent.value?.onExitClick) {
            addClickListener();
          }
        }
      }
    };

    const handleDragStart = (event: Event) => {
      // Prevent default browser drag behavior which interferes with vue-grid-layout
      if (layoutStore.canEdit && !isEditing.value) {
        event.preventDefault();
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

    const borderEnabled = computed(() => {
      return props.tile.borderEnabled !== false;
    });

    const borderVisible = computed(() => {
      if (!isLinkContent.value) {
        return borderEnabled.value;
      }
      return linkBackgroundEnabled.value ? borderEnabled.value : true;
    });

    const compactMetadata = computed(() => {
      return [
        `type: ${props.tile.content.type}`,
        `x: ${props.tile.x}`,
        `y: ${props.tile.y}`,
        `w: ${props.tile.w}`,
        `h: ${props.tile.h}`,
        `id: ${props.tile.i}`,
      ].join(" | ");
    });

    const typeSpecificMeta = computed(() => {
      const content = props.tile.content as any;
      switch (props.tile.content.type) {
        case ContentType.TEXT: {
          const rawText = typeof content.text === "string" ? content.text : "";
          return `textChars: ${rawText.length}`;
        }
        case ContentType.IMAGE:
        case ContentType.VIDEO: {
          const hasSrc =
            typeof content.src === "string" && content.src.trim().length > 0;
          return `hasMediaSrc: ${hasSrc ? "yes" : "no"} | zoom: ${content.zoom ?? "n/a"}`;
        }
        case ContentType.LINK: {
          const rawLink = typeof content.link === "string" ? content.link : "";
          let domain = "n/a";
          if (rawLink) {
            try {
              domain = new URL(rawLink).hostname || "n/a";
            } catch {
              domain = "invalid";
            }
          }
          return `urlSet: ${rawLink ? "yes" : "no"} | domain: ${domain}`;
        }
        case ContentType.SUGGESTION:
          return `suggestionAction: ${content.action ?? "n/a"} | label: ${content.label ?? "n/a"}`;
        case ContentType.MAP:
          return `zoom: ${content.zoom ?? "n/a"} | marker: ${content.marker ? "yes" : "no"}`;
        case ContentType.CHAT:
          return `messages: ${Array.isArray(content.messages) ? content.messages.length : 0}`;
        default:
          return "typeSpecific: n/a";
      }
    });

    const verboseMetadataLines = computed(() => {
      const caption = props.tile.caption?.trim();
      const cookieValue = layoutStore.getCookieValue("showMetaData");
      const verboseCookieValue = layoutStore.getCookieValue("showMetaDataVerbose");
      return [
        `caption: ${caption ? caption.slice(0, 40) : "n/a"}`,
        `borderEnabled: ${borderEnabled.value ? "true" : "false"} | draggable: ${isTileDraggable.value ? "true" : "false"} | resizable: ${isTileResizable.value ? "true" : "false"}`,
        `breakpoint: ${layoutStore.activeBreakpoint} | canEdit: ${layoutStore.canEdit ? "true" : "false"} | isOwner: ${layoutStore.isOwner ? "true" : "false"}`,
        `displaySource: ${layoutStore.activeBreakpoint === "lg" ? "tileBase" : "breakpointOverrideOrDisplay"}`,
        `cookie(meta): ${cookieValue ?? "unset"} | cookie(verbose): ${verboseCookieValue ?? "unset"}`,
        typeSpecificMeta.value,
      ];
    });

    const toolbarRefs = { childComponent, isEditing, isExitingCropMode };

    // Re-load the dynamic component whenever the content type changes
    // (e.g. suggestion -> profile). Without this, currentComponent stays
    // null after the tile type switches away from SUGGESTION.
    watch(
      () => props.tile.content.type,
      () => {
        loadComponent();
      },
    );

    onMounted(() => {
      loadComponent();

      if (gridTileRef.value) {
        gridTileRef.value.addEventListener("dragstart", handleDragStart);
        // Use non-passive touchstart so we can conditionally preventDefault on second tap
        gridTileRef.value.addEventListener("touchstart", handleTouchStart, {
          passive: false,
        });
        gridTileRef.value.addEventListener("touchend", handleTouchEnd, {
          passive: true,
        });
      }
    });

    onUnmounted(() => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      stopChildEditingWatch?.();
      stopChildEditingWatch = null;
      removeClickListener();
      document.removeEventListener("touchstart", handleTouchOutside);

      if (gridTileRef.value) {
        gridTileRef.value.removeEventListener("dragstart", handleDragStart);
        gridTileRef.value.removeEventListener("touchstart", handleTouchStart);
        gridTileRef.value.removeEventListener("touchend", handleTouchEnd);
      }
    });

    return {
      currentComponent,
      contentProps,
      headerComponent,
      childComponent,
      removeElement,
      tileStyle,
      onMove,
      startClick,
      endClick,
      gridTileRef,
      layoutStore,
      isEditing,
      isDragging,
      isExiting,
      isActivated,
      isHovered,
      hoveredToolbarZone,
      onMoved,
      onResize,
      onResized,
      showCaption,
      borderVisible,
      linkBackgroundEnabled,
      compactMetadata,
      verboseMetadataLines,
      contentBackgroundColor,
      contentTextColor,
      onContentBackgroundColorChange,
      onContentTextColorChange,

      isSuggestion,
      suggestionAction,
      suggestionLabel,
      isTileDraggable,
      isTileResizable,

      mediaInput,
      onMediaSelected,
      isCroppable,
      toggleCropMode,
      isExitingCropMode,
      toolbarRefs,
      hoveredLayer,
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
    animation: cropOverlayFadeOut var(--duration-slow) var(--easing-ease-in)
      forwards;
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  border-radius: var(--tile-border-radius);
  /* turn off shadow when border is off */
  &[data-border="off"] {
    box-shadow: none;
  }

  /* Animate tiles when they first appear */
  animation: tileEnter var(--duration-normal) var(--easing-spring);

  /* Scale effect while dragging - applied to child element to avoid conflict with grid-item's inline transform */
  &.is-dragging {
    transform: scale(1.05);
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.25));
    transition:
      transform var(--duration-normal) var(--easing-ease-out),
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
      content: "";
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
      content: "";
      position: absolute;
      inset: -3px;
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: calc(var(--tile-border-radius) + 3px);
      pointer-events: none;
      z-index: 10;
      animation: cropOutlineFadeOut var(--duration-normal) var(--easing-ease-in)
        forwards;
    }
  }
}

/* Card Body Styles - Visual Frame */
.card-body {
  width: 100%;
  height: 100%;
  position: relative;
  // this one is doing that weird border portion
  background-color: var(--tile-bg);
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
    animation: cropBorderContract var(--duration-slow) var(--easing-smooth)
      forwards;
  }

  /* Border Overlay */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    // note to self: this is doing the real border
    border: var(--tile-border-width) solid var(--color-tile-stroke);
    border-radius: inherit;
    pointer-events: none;
    box-sizing: border-box;
    z-index: 2;
    opacity: 1;
    transition: opacity var(--duration-fast) var(--easing-ease-in-out);
  }

  .tile-wrapper[data-border="off"] &::after {
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

.tile-wrapper[data-border="off"] {
  .card-body {
    background-color: var(--tile-bg);
  }
}

.meta-data {
  position: absolute;
  font-size: 10px;
  left: 10px;
  top: 10px;
  z-index: 6;
  pointer-events: none;
  max-width: calc(100% - 20px);
  color: var(--color-text-primary);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  padding: 8px 8px 16px 8px;
  border-radius: 16px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-tile-background) 88%, transparent) 0%,
    color-mix(in srgb, var(--color-tile-background) 72%, transparent) 55%,
    transparent 100%
  );
  backdrop-filter: blur(1.5px);
}

.meta-data__compact,
.meta-data__verbose {
  margin: 0;
  line-height: 1.3;
  word-break: break-word;
}

.meta-data__verbose {
  opacity: 0.9;
}

/* Customizable Header Styles */
.header-options {
  display: none;
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translate(-50%, -100%);
}

/* Border-off state for toolbar border toggle icon (reaches into TileToolbar child) */
.tile-wrapper[data-border="off"] {
  :deep(.toolbar-btn--border) {
    color: var(--color-content-default);
  }

  :deep(.toolbar-btn--border .toolbar-icon-border .border-slash) {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

:deep(.hover-display) {
  display: none;
}

/* Show elements on tile hover with smooth animations */
.tile-wrapper:hover .header-options,
.tile-wrapper:hover :deep(.hover-display),
.tile-wrapper.is-activated .header-options,
.tile-wrapper.is-activated :deep(.hover-display) {
  display: flex;
}

/* Non-owner caption: hide on tile hover or activation */
.tile-wrapper:hover :deep(.viewer-caption),
.tile-wrapper.is-activated :deep(.viewer-caption) {
  display: none;
}

/* Show tile actions on hover and activation */
.tile-wrapper:hover :deep(.tile-actions),
.tile-wrapper.is-activated :deep(.tile-actions) {
  opacity: 1;
  pointer-events: auto;
}

/* Hide tile actions during crop mode, exiting, and while dragging */
.tile-wrapper.crop-mode-active :deep(.tile-actions),
.tile-wrapper.crop-mode-exiting :deep(.tile-actions),
.tile-wrapper.is-exiting :deep(.tile-actions),
.tile-wrapper.is-dragging :deep(.tile-actions),
.tile-wrapper.is-activated.is-dragging :deep(.tile-actions) {
  opacity: 0;
  pointer-events: none;
}

/* Hover-priority layering wrappers */
.tile-actions-layer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 11;

  &.z-priority {
    z-index: 10001;
  }
}

.tile-toolbar-layer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 10000;

  &:not(.z-priority) {
    z-index: 9;
  }
}

/* Show toolbar on tile hover, activation, and during crop mode (reaches into TileToolbar child) */
.tile-wrapper:hover :deep(.tile-toolbar),
.tile-wrapper.is-activated :deep(.tile-toolbar),
.tile-wrapper.crop-mode-active :deep(.tile-toolbar),
.tile-wrapper.crop-mode-exiting :deep(.tile-toolbar) {
  opacity: 1;
  transform: translate(-50%, 100%) scale(1);
  pointer-events: auto;
}

/* Show search panel and image URL panel when toolbar is visible */
.tile-wrapper:hover :deep(.toolbar-search-panel),
.tile-wrapper.is-activated :deep(.toolbar-search-panel),
.tile-wrapper.crop-mode-active :deep(.toolbar-search-panel),
.tile-wrapper.crop-mode-exiting :deep(.toolbar-search-panel),
.tile-wrapper:hover :deep(.toolbar-image-url-panel),
.tile-wrapper.is-activated :deep(.toolbar-image-url-panel),
.tile-wrapper.crop-mode-active :deep(.toolbar-image-url-panel),
.tile-wrapper.crop-mode-exiting :deep(.toolbar-image-url-panel) {
  pointer-events: auto;
}

/* Dim sibling toolbars when one specific zone is hovered */
.tile-wrapper[data-active-zone="actions"]:hover :deep(.tile-toolbar),
.tile-wrapper[data-active-zone="actions"].is-activated :deep(.tile-toolbar),
.tile-wrapper[data-active-zone="avatar"]:hover :deep(.tile-toolbar),
.tile-wrapper[data-active-zone="avatar"].is-activated :deep(.tile-toolbar),
.tile-wrapper[data-active-zone="radius"]:hover :deep(.tile-toolbar),
.tile-wrapper[data-active-zone="radius"].is-activated :deep(.tile-toolbar),
.tile-wrapper[data-active-zone="sides"]:hover :deep(.tile-toolbar),
.tile-wrapper[data-active-zone="sides"].is-activated :deep(.tile-toolbar) {
  opacity: 0.15;
  pointer-events: none;
}

.tile-wrapper[data-active-zone="toolbar"]:hover :deep(.tile-actions),
.tile-wrapper[data-active-zone="toolbar"].is-activated :deep(.tile-actions),
.tile-wrapper[data-active-zone="avatar"]:hover :deep(.tile-actions),
.tile-wrapper[data-active-zone="avatar"].is-activated :deep(.tile-actions),
.tile-wrapper[data-active-zone="radius"]:hover :deep(.tile-actions),
.tile-wrapper[data-active-zone="radius"].is-activated :deep(.tile-actions),
.tile-wrapper[data-active-zone="sides"]:hover :deep(.tile-actions),
.tile-wrapper[data-active-zone="sides"].is-activated :deep(.tile-actions) {
  opacity: 0.15;
  pointer-events: none;
}

/* Hide toolbar when tile is exiting or being dragged */
.tile-wrapper.is-exiting :deep(.tile-toolbar),
.tile-wrapper.is-exiting :deep(.toolbar-search-panel),
.tile-wrapper.is-exiting :deep(.toolbar-image-url-panel),
.tile-wrapper.is-dragging :deep(.tile-toolbar),
.tile-wrapper.is-dragging :deep(.toolbar-search-panel),
.tile-wrapper.is-dragging :deep(.toolbar-image-url-panel) {
  opacity: 0;
  transform: translate(-50%, calc(100% + 10px)) scale(0.9);
  pointer-events: none;
}

/* Suggestion tile specific styling */
.tile-wrapper[data-suggestion="true"] .card-body {
  border: 2px dashed var(--color-tile-stroke);
  background: rgba(255, 255, 255, 0.02);
}

.tile-wrapper[data-suggestion="true"] .card-body::after {
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

.tile-wrapper[data-suggestion="true"]:hover .suggestion-icon {
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

.tile-wrapper[data-suggestion="true"]:hover .suggestion-label {
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
    content: "";
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 20px 20px;
    border-color: transparent transparent var(--color-content-default)
      transparent;
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
  width: 32px !important;
  height: 32px !important;
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
    opacity: 1 !important;
  }

  /* Light, fast spring during drag — keeps a hint of fluidity without
     the heavy 400ms spring that causes perceptible cursor lag. */
  &.vue-draggable-dragging {
    transition: transform 80ms ease-out !important;
    // transition: transform 80ms var(--easing-spring) !important;
    opacity: 1 !important;
  }

  /* Full spring animation when resize/drag completes and tiles settle */
  &:not(.resizing):not(.vue-draggable-dragging) {
    transition:
      width var(--duration-slow) var(--easing-spring),
      height var(--duration-slow) var(--easing-spring),
      transform var(--duration-slow) var(--easing-spring),
      opacity var(--duration-fast) var(--easing-ease-out) !important;
    opacity: 1 !important;
  }
}

/* Placeholder styling is handled globally in Grid.vue's unscoped <style> block
   so it can properly hide/show based on drag state via :has(.vue-draggable-dragging). */
</style>
