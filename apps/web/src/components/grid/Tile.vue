<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <!-- Crop Mode Overlay - blurs everything outside the tile -->
  <div
    v-if="(isEditing || isExitingCropMode) && isCroppable"
    class="crop-mode-overlay"
    :class="{ exiting: isExitingCropMode }"
    @click.stop="toggleCropMode"
  ></div>

  <div
    class="tile-wrapper"
    :class="{
      'crop-mode-elevated':
        (isEditing || isExitingCropMode) && isCroppable,
      'crop-mode-active': isEditing && isCroppable,
      'crop-mode-exiting': isExitingCropMode && isCroppable,
      'is-dragging': isDragging,
      'is-exiting': isExiting,
      'is-activated': isActivated,
      'embed-is-interactive': isEmbedInteractive,
      'suggestion-hidden': isHiddenSuggestion,
    }"
    :data-border="borderVisible ? 'on' : 'off'"
    :data-no-fill="isTransparentBackground ? 'on' : 'off'"
    :data-link-background="linkBackgroundEnabled ? 'on' : 'off'"
    :data-suggestion="isSuggestion ? 'true' : 'false'"
    :data-active-zone="hoveredToolbarZone || ''"
    :data-tile-type="tile.content.type"
    :data-tile-w="layout.w"
    :data-tile-h="layout.h"
    :style="[
      tileStyle,
      {
        '--tile-resize-handle-color':
          hasCustomTileColor && contentTextColor
            ? contentTextColor
            : undefined,
      },
    ]"
    ref="gridTileRef"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
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
      <template v-else-if="gridView.canEdit">
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
          v-if="gridView.canEdit"
          type="file"
          ref="mediaInput"
          style="display: none"
          accept="image/*,video/*"
          @change.stop="onMediaSelected"
        />
      </template>
    </div>

    <!-- UI Layer -->
    <div v-if="gridView.canEdit && headerComponent" class="header-options">
      <component :is="headerComponent" :content="tile.content" />
    </div>

    <div v-if="gridView.showMetaData" class="meta-data">
      <p class="meta-data__compact">{{ compactMetadata }}</p>
      <template v-if="gridView.showMetaDataVerbose">
        <p
          class="meta-data__verbose"
          v-for="line in verboseMetadataLines"
          :key="line"
        >
          {{ line }}
        </p>
      </template>
    </div>

    <div
      v-if="gridView.canEdit"
      class="tile-actions-layer"
      :class="{ 'z-priority': hoveredLayer === 'actions' }"
      @mouseenter="hoveredLayer = 'actions'"
      @mouseleave="hoveredLayer = null"
      @touchstart="hoveredLayer = 'actions'"
    >
      <TileActions :tile="tile" @delete="removeElement" />
    </div>

    <TileCaption
      v-if="showCaption && (gridView.canEdit || tile.caption)"
      :tile="tile"
    />

    <!-- Resize indicator nubbin - shows on hover to indicate drag-to-resize capability -->
    <div v-if="isTileResizable" class="resize-indicator"></div>

    <div
      v-if="gridView.canEdit && !isSuggestion"
      class="tile-toolbar-layer"
      :class="{ 'z-priority': hoveredLayer !== 'actions' }"
      @mouseenter="hoveredLayer = 'toolbar'"
      @mouseleave="hoveredLayer = null"
      @touchstart="hoveredLayer = 'toolbar'"
    >
      <TileToolbar :tile="tile" :toolbarRefs="toolbarRefs" />
    </div>
  </div>
  <FloatingInputModal
    :show="showSuggestionLinkModal"
    placeholder="Type or paste a link..."
    inputmode="url"
    :validate="isValidLink"
    submit-title="Add link (Enter)"
    invalid-title="Enter a valid URL"
    @close="closeSuggestionLinkModal"
    @submit="handleSuggestionAddLink"
  />
  <FloatingInputModal
    :show="showSuggestionEmbedModal"
    placeholder="Paste a URL or embed code (YouTube, Spotify, Apple Music...)"
    :validate="isValidEmbed"
    submit-title="Add embed (Enter)"
    invalid-title="Enter a valid URL"
    @close="closeSuggestionEmbedModal"
    @submit="handleSuggestionAddEmbed"
  />
</template>

<script lang="ts">
import {
  proxyRefs,
  defineComponent,
  inject,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  computed,
  provide,
  watch,
  type Component,
  type Ref,
} from "vue";

import { TILE_DRAGGING_ID } from "@/grid-context/tileInteractionKeys";
import { type TileChildComponent } from "@/types/Tile";
import { type Tile } from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import TileCaption from "@/components/tile/TileCaption.vue";
import {
  getContentComponent,
  getOptionComponent,
  createTileContent,
} from "@/utils/TileUtils";
import {
  ContentType,
  type LinkContent,
  type SuggestionContent,
  type AnyTileContent,
} from "@grids/contracts/types";
import { getTileDefinition } from "@/registries/tileRegistry";

import TextIcon from "@/components/icons/TextIcon.vue";
import ImageIcon from "@/components/icons/ImageIcon.vue";
import LinkIcon from "@/components/icons/LinkIcon.vue";
import EmbedIcon from "@/components/icons/EmbedIcon.vue";
import ProfileIcon from "@/components/icons/ProfileIcon.vue";
import TileToolbar from "@/components/tile/TileToolbar.vue";
import TileActions from "@/components/tile/TileActions.vue";
import { useFileUpload } from "@/composables/useFileUpload";
import ColorPicker from "@/components/ui-controls/ColorPicker.vue";
import FloatingInputModal from "@/components/modal/FloatingInputModal.vue";
import { isValidLink, isValidEmbed } from "@/utils/UrlValidation";
import { useTileInput } from "@/composables/useTileInput";

export default defineComponent({
  components: {
    TileCaption,
    TileToolbar,
    TileActions,
    TextIcon,
    ImageIcon,
    LinkIcon,
    EmbedIcon,
    ProfileIcon,
    ColorPicker,
    FloatingInputModal,
  },
  props: {
    tile: {
      type: Object as () => Tile,
      required: true,
    },
    layout: {
      type: Object as () => GridLayoutItem,
      required: true,
    },
  },
  setup(props) {
    const gridView = proxyRefs(useGridViewContext());
    const { uploadFileOptimisticForTile } = useFileUpload();
    const { submitLink, submitEmbed } = useTileInput();

    // Expose the tile's current grid height to content components.
    // This is used for responsive content rendering (e.g. title line clamping).
    provide(
      "gridTileH",
      computed(() => props.layout.h),
    );
    provide(
      "gridTileW",
      computed(() => props.layout.w),
    );
    /*provide("tileId", computed(() => props.tile.i));*/
    provide("tileId", props.tile.i);
    provide(
      "tileX",
      computed(() => props.layout.x),
    );
    provide(
      "tileY",
      computed(() => props.layout.y),
    );

    const isTouchDevice = () =>
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    const isDragging = ref(false);
    const isExiting = ref(false);
    const isActivated = ref(false);

    // Griddle drives drag/resize at the grid level; Grid.vue publishes the
    // active gesture's tile id here. Mirror it into this tile's drag visual.
    const draggingTileId = inject<Ref<string | null>>(
      TILE_DRAGGING_ID,
      ref(null),
    );
    watch(
      () => draggingTileId.value === props.tile.i,
      (dragging) => {
        isDragging.value = dragging;
      },
    );
    const isHovered = ref(false);
    const hoveredToolbarZone = ref<string | null>(null);
    provide("hoveredToolbarZone", hoveredToolbarZone);
    provide("tileActivated", isActivated);
    const isEmbedInteractive = ref(false);
    provide("isEmbedInteractive", isEmbedInteractive);
    const hoveredLayer = ref<"actions" | "toolbar" | null>(null);
    // Hold the dynamically resolved content/header component definitions in
    // shallowRefs. A plain `ref` makes the component object deeply reactive,
    // which Vue warns about ("Vue received a Component that was made a reactive
    // object … use markRaw or shallowRef") and adds needless overhead.
    const currentComponent = shallowRef<Component | null>(null);
    const headerComponent = shallowRef<Component | null>(null);
    const childComponent = ref<TileChildComponent | null>(null);
    const gridTileRef = ref<HTMLElement | null>(null);
    const isEditing = ref<boolean>(false);
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

    const hasCustomTileColor = computed(() => {
      const bg = contentBackgroundColor.value;
      return !!bg && bg !== "var(--color-tile-background)";
    });

    // A no-fill tile resolves its background to `transparent`. The card body's
    // backdrop blur must be dropped in that case, otherwise it frosts the grid
    // background showing through and leaves a visible edge at the tile bounds.
    const isTransparentBackground = computed(
      () => contentBackgroundColor.value === "transparent",
    );

    const showCaption = computed(() => {
      const def = getTileDefinition(props.tile.content.type);
      if (def && def.capabilities.caption === false) return false;
      if (props.layout.w === 1) return false;
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
    const LONG_PRESS_THRESHOLD = 150;

    const isSuggestion = computed(
      () => props.tile.content.type === ContentType.SUGGESTION,
    );

    // Suggestion tiles are owner-only affordances ("Add Profile", "Add Link"),
    // but `createStarterTiles()` persists two of them into every new grid — so
    // a visitor saw them until the owner replaced them. The OG image renderer
    // already drops them as "internal-only chrome"; this is the client-side
    // half of that rule.
    const isHiddenSuggestion = computed(
      () => isSuggestion.value && !gridView.canEdit,
    );
    const contentProps = computed(() => {
      const def = getTileDefinition(props.tile.content.type);
      const extra = def?.extraProps?.(props.tile) ?? {};
      return { content: props.tile.content, ...extra };
    });
    const suggestionAction = computed(
      () => (props.tile.content as SuggestionContent)?.action ?? "text",
    );
    const suggestionLabel = computed(
      () => (props.tile.content as SuggestionContent)?.label ?? "",
    );

    const _isProfileTile = computed(
      () => props.tile.content.type === ContentType.PROFILE,
    );
    const isTileDraggable = computed(() => {
      if (!gridView.canEdit || isEditing.value) return false;
      if (isTouchDevice()) return isActivated.value;
      return true;
    });

    const isTileResizable = computed(() => {
      if (!gridView.canEdit || isSuggestion.value) {
        return false;
      }
      if (isTouchDevice()) return isActivated.value && !isEditing.value;
      return !isEditing.value;
    });

    const mediaInput = ref<HTMLInputElement | null>(null);
    const showSuggestionLinkModal = ref(false);
    const showSuggestionEmbedModal = ref(false);

    const loadComponent = async () => {
      currentComponent.value = await getContentComponent(props.tile.content);
      headerComponent.value = await getOptionComponent(props.tile.content);
    };

    const handleGridShortClick = (event: PointerEvent | TouchEvent) => {
      if (isSuggestion.value) {
        onSuggestionShortClick();
        return;
      }
      childComponent.value?.onShortClick?.(
        event as unknown as MouseEvent,
      );
      if (childComponent.value?.onExitClick) {
        addClickListener();
      }
    };

    // Drag/resize begin+commit now live at the grid level (Grid.vue's Griddle
    // gesture handlers). Content still needs to reflow when its cell size
    // changes — whether from a user resize or a breakpoint reprojection — so
    // reach the child component's onResize hook by watching the tile footprint.
    watch(
      () => [props.layout.w, props.layout.h],
      () => {
        childComponent.value?.onResize?.();
      },
    );

    const onSuggestionShortClick = () => {
      if (!gridView.canEdit) return;
      const action = (props.tile.content as SuggestionContent)?.action;
      switch (action) {
        case "profile": {
          const content = createTileContent(ContentType.PROFILE, {});
          gridView.setTileContent(props.tile.i, content);
          break;
        }
        case "text": {
          const content = createTileContent(ContentType.TEXT, {});
          gridView.setTileContent(props.tile.i, content);
          // Auto-focus the new text tile so the user can start typing immediately
          gridView.setPendingFocusTileId(props.tile.i);
          break;
        }

        case "media": {
          mediaInput.value?.click();
          break;
        }
        case "link": {
          showSuggestionLinkModal.value = true;
          break;
        }
        case "embed": {
          showSuggestionEmbedModal.value = true;
          break;
        }
      }
    };

    const closeSuggestionLinkModal = () => {
      showSuggestionLinkModal.value = false;
    };

    const closeSuggestionEmbedModal = () => {
      showSuggestionEmbedModal.value = false;
    };

    const handleSuggestionAddLink = (link: string) => {
      closeSuggestionLinkModal();
      void submitLink(link, { mode: "replace", tileId: props.tile.i });
    };

    const handleSuggestionAddEmbed = (url: string) => {
      closeSuggestionEmbedModal();
      submitEmbed(url, { mode: "replace", tileId: props.tile.i });
    };

    const onMediaSelected = async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];

      // Reset input immediately so the same file can be selected again
      input.value = "";

      if (!file) return;
      try {
        await uploadFileOptimisticForTile(file, props.tile.i);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : null;
        const errorMessage = err?.message || "Unknown error";
        alert(`Failed to upload file: ${errorMessage}`);
      }
    };

    const removeElement = () => {
      // Trigger exit animation
      isExiting.value = true;

      // Wait for animation to complete before actually removing the tile
      setTimeout(() => {
        gridView.removeTile(props.tile.i);
      }, 250); // var(--duration-normal) = 250ms
    };

    const tileStyle = computed(() => {
      const isToolbarActive =
        isHovered.value ||
        isActivated.value ||
        gridView.activeTileId === props.tile.i;

      let zIndex: string | number = 0;
      if (isEditing.value) {
        zIndex = "var(--z-grid-tile-elevated)";
      } else if (isToolbarActive) {
        zIndex = "var(--z-grid-tile-hover)";
      }

      return { zIndex };
    });

    // Check if tile supports crop/zoom (IMAGE or VIDEO)
    const isCroppable = computed(() => {
      return (
        props.tile.content.type === ContentType.IMAGE ||
        props.tile.content.type === ContentType.VIDEO
      );
    });

    // The tile toolbar is teleported to <body> so it floats above fixed page
    // chrome (AppBar/TopBar) instead of being clipped by the tile's stacking
    // context. That teleport breaks the descendant `.tile-wrapper:hover
    // :deep(.tile-toolbar)` / `.is-activated` selectors that used to drive its
    // visibility, so we recreate those exact show/hide rules here and provide
    // the result to TileToolbar (which also ORs in its own hover state).
    const isToolbarVisible = computed(
      () =>
        !isExiting.value &&
        !isDragging.value &&
        (isHovered.value ||
          isActivated.value ||
          (isEditing.value && isCroppable.value) ||
          (isExitingCropMode.value && isCroppable.value)),
    );
    provide("tileToolbarVisible", isToolbarVisible);

    // The tile action bar is likewise teleported to <body> (so it isn't clipped
    // by the grid's overflow:hidden scale wrapper when a tile sits on the last
    // row). Recreate the `.tile-wrapper:hover/.is-activated/.embed-is-interactive
    // :deep(.tile-actions)` show rules (and the crop/exit/drag hide rules) here.
    const isActionsVisible = computed(
      () =>
        !isExiting.value &&
        !isDragging.value &&
        !(isEditing.value && isCroppable.value) &&
        !(isExitingCropMode.value && isCroppable.value) &&
        (isHovered.value ||
          isActivated.value ||
          isEmbedInteractive.value),
    );
    provide("tileActionsVisible", isActionsVisible);

    // Toggle crop/zoom mode for image/video tiles
    const toggleCropMode = () => {
      if (!childComponent.value?.toggleEditMode) return;

      // If currently editing, trigger exit animations first
      if (isEditing.value) {
        isExitingCropMode.value = true;

        // Wait for exit animations to complete (400ms + 50ms buffer)
        setTimeout(() => {
          if (childComponent.value?.toggleEditMode !== undefined) {
            childComponent.value.toggleEditMode();
          }
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
              isEditing.value = editing ?? false;
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

    // Targets that own their own touch behaviour — native cursor placement and
    // the on-screen keyboard. Rich-text tiles (profile, text) render
    // contenteditable `.ProseMirror` regions rather than <input>/<textarea>, so
    // they are exempted here too, mirroring native form fields.
    const INTERACTIVE_TOUCH_TARGET =
      'button, a, input, select, textarea, [role="button"], [contenteditable="true"], .ProseMirror';

    // How far a touch may travel and still count as a tap rather than a pan.
    const TAP_SLOP_PX = 10;

    let touchWasActivating = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDidPan = false;
    let touchTargetIsInteractive = false;

    // Nothing here may cancel `touchstart`. Cancelling it opts the *whole*
    // gesture out of the browser's default handling, so a swipe that merely
    // began on a tile could never scroll the page — the tap/pan decision has to
    // be deferred until we have seen whether the finger actually moved.
    const handleTouchStart = (event: TouchEvent) => {
      if (!isTouchDevice()) return;

      const touch = event.touches[0];
      touchStartX = touch?.clientX ?? 0;
      touchStartY = touch?.clientY ?? 0;
      touchDidPan = false;
      clickStart.value = Date.now();
      touchTargetIsInteractive = !!(event.target as HTMLElement).closest(
        INTERACTIVE_TOUCH_TARGET,
      );

      if (!isActivated.value) {
        // First touch activates the tile; the gesture itself stays the
        // browser's to interpret.
        isActivated.value = true;
        touchWasActivating = true;
        document.addEventListener("touchstart", handleTouchOutside, {
          passive: true,
        });
      } else {
        touchWasActivating = false;
      }
    };

    // Passive: this only classifies the gesture, it never suppresses it.
    const handleTouchMove = (event: TouchEvent) => {
      if (touchDidPan) return;
      const touch = event.touches[0];
      if (!touch) return;
      const distance = Math.hypot(
        touch.clientX - touchStartX,
        touch.clientY - touchStartY,
      );
      if (distance > TAP_SLOP_PX) touchDidPan = true;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!isTouchDevice()) return;
      if (!isActivated.value) return;

      const wasActivating = touchWasActivating;
      touchWasActivating = false;

      // The finger travelled, so this was a scroll — not an interaction.
      if (touchDidPan) return;

      // A settled tap on non-interactive tile content: suppress the synthesized
      // mouse cascade so tile handlers don't also see a compatibility mousedown.
      // Safe to cancel at `touchend` — the browser has already decided whether
      // to scroll, so this can no longer strand the gesture.
      if (!wasActivating && !touchTargetIsInteractive && event.cancelable) {
        event.preventDefault();
      }

      // Skip interaction on the tap that just activated the tile
      if (wasActivating) return;

      const touchDuration = Date.now() - (clickStart.value || Date.now());

      // Only fire short-click if it was a quick tap (not a long press)
      if (touchDuration < LONG_PRESS_THRESHOLD) {
        handleGridShortClick(event);
      }
    };

    const handleDragStart = (event: Event) => {
      // Prevent the native browser image/text drag, which would otherwise
      // interfere with Griddle's pointer-driven tile drag.
      if (gridView.canEdit && !isEditing.value) {
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
        `x: ${props.layout.x}`,
        `y: ${props.layout.y}`,
        `w: ${props.layout.w}`,
        `h: ${props.layout.h}`,
        `id: ${props.tile.i}`,
      ].join(" | ");
    });

    const typeSpecificMeta = computed(() => {
      const content = props.tile.content as AnyTileContent &
        Record<string, unknown>;
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
        case ContentType.DOCUMENT: {
          const n = Array.isArray((content as { items?: unknown[] }).items)
            ? (content as { items: unknown[] }).items.length
            : 0;
          return `documents: ${n}`;
        }
        default:
          return "typeSpecific: n/a";
      }
    });

    const verboseMetadataLines = computed(() => {
      const caption = props.tile.caption?.trim();
      const cookieValue = gridView.getCookieValue("showMetaData");
      const verboseCookieValue = gridView.getCookieValue(
        "showMetaDataVerbose",
      );
      return [
        `caption: ${caption ? caption.slice(0, 40) : "n/a"}`,
        `borderEnabled: ${borderEnabled.value ? "true" : "false"} | draggable: ${isTileDraggable.value ? "true" : "false"} | resizable: ${isTileResizable.value ? "true" : "false"}`,
        `breakpoint: ${gridView.activeBreakpoint} | canEdit: ${gridView.canEdit ? "true" : "false"} | isOwner: ${gridView.isOwner ? "true" : "false"}`,
        `displaySource: ${gridView.activeBreakpoint === "lg" ? "tileBase" : "breakpointOverrideOrDisplay"}`,
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
        // touchstart/touchmove only observe the gesture, so both stay passive —
        // that also guarantees neither can block scrolling. Only touchend is
        // non-passive, since a settled tap cancels the mouse cascade there.
        gridTileRef.value.addEventListener("touchstart", handleTouchStart, {
          passive: true,
        });
        gridTileRef.value.addEventListener("touchmove", handleTouchMove, {
          passive: true,
        });
        gridTileRef.value.addEventListener("touchend", handleTouchEnd, {
          passive: false,
        });
      }
    });

    onUnmounted(() => {
      stopChildEditingWatch?.();
      stopChildEditingWatch = null;
      removeClickListener();
      document.removeEventListener("touchstart", handleTouchOutside);

      if (gridTileRef.value) {
        gridTileRef.value.removeEventListener("dragstart", handleDragStart);
        gridTileRef.value.removeEventListener("touchstart", handleTouchStart);
        gridTileRef.value.removeEventListener("touchmove", handleTouchMove);
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
      handleGridShortClick,
      gridTileRef,
      gridView,
      isEditing,
      isDragging,
      isExiting,
      isActivated,
      isHovered,
      hoveredToolbarZone,
      showCaption,
      borderVisible,
      linkBackgroundEnabled,
      compactMetadata,
      verboseMetadataLines,
      contentBackgroundColor,
      contentTextColor,
      hasCustomTileColor,
      isTransparentBackground,
      onContentBackgroundColorChange,
      onContentTextColorChange,

      isSuggestion,
      isHiddenSuggestion,
      suggestionAction,
      suggestionLabel,
      isTileDraggable,
      isTileResizable,

      mediaInput,
      onMediaSelected,
      isValidLink,
      isValidEmbed,
      showSuggestionLinkModal,
      showSuggestionEmbedModal,
      closeSuggestionLinkModal,
      closeSuggestionEmbedModal,
      handleSuggestionAddLink,
      handleSuggestionAddEmbed,
      isCroppable,
      toggleCropMode,
      isExitingCropMode,
      toolbarRefs,
      hoveredLayer,
      isEmbedInteractive,
    };
  },
});
</script>

<style scoped lang="scss">
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
  // Griddle sizes its `.griddle-tile` wrapper but does not stretch slot
  // content. Fill that box directly so the card's percentage height resolves
  // against the governed tile dimensions.
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  border-radius: var(--tile-border-radius);
  transition: box-shadow 0.3s ease;
  /* turn off shadow when border is off */
  &[data-border="off"] {
    box-shadow: none;
  }

  &.crop-mode-elevated {
    z-index: 1000;
    isolation: isolate;
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

/* No-fill tiles render truly transparent so the grid background shows through.
   Drop the backdrop blur too — otherwise it frosts that background and leaves a
   visible edge where the blur boundary meets the tile bounds. */
.tile-wrapper[data-no-fill="on"] .card-body {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* A tile with neither a fill nor a border has no visible edge, so resizing it
   drags an invisible footprint. Unlike a drag, Griddle renders no drop
   indicator during a resize (its indicator is derived from drag state only),
   so there is nothing else standing in for the bounds.

   Restore the tile's own border overlay for the duration of the gesture rather
   than introducing separate resize chrome: it already carries the right stroke
   token and radius, and its `opacity` transition eases the outline in and back
   out on its own. `.griddle-resizing` is set by Griddle on the tile element
   owning the active resize. */
.griddle-resizing
  .tile-wrapper[data-border="off"][data-no-fill="on"]
  .card-body::after {
  opacity: 1;
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

/* Show embed interact overlay on tile activation (touch devices) */
.tile-wrapper.is-activated :deep(.embed-interact-overlay) {
  opacity: 1;
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

/* Keep tile actions visible while embed is interactive */
.tile-wrapper.embed-is-interactive :deep(.tile-actions) {
  opacity: 1;
  pointer-events: auto;
}

/* Glow border while embed is interactive */
.tile-wrapper.embed-is-interactive {
  box-shadow:
    0 0 0 2px var(--color-figma-purple, #a259ff),
    0 0 20px 4px rgba(162, 89, 255, 0.3);
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

/* Visitor-facing suggestion tile: the CTA is already withheld from the DOM, but
   the dashed frame above lives on `.card-body`, so the cell would still read as
   an empty placeholder. `visibility: hidden` removes every visual trace while
   the tile keeps its footprint — dropping it from the layout instead would let
   compaction reflow the neighbouring tiles, so a visitor would see a different
   arrangement than the owner. */
.tile-wrapper.suggestion-hidden {
  visibility: hidden;
  pointer-events: none;
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
    border-color: transparent transparent
      var(--tile-resize-handle-color, var(--color-content-default)) transparent;
    opacity: 0.3;
    border-radius: 0 0 calc(var(--tile-border-radius) - 2px) 0;
  }
}

/* Show resize indicator when hovering the tile */
.tile-wrapper:hover .resize-indicator {
  opacity: 1;
}

/* Griddle owns tile positioning, drag/resize handles, the drop indicator, and
   the settle (FLIP) animation. Those concerns are styled globally in
   styles/custom.scss (targeting `.griddle-tile` / `[data-griddle-handle]` /
   `.griddle-drop-indicator`) rather than here, because Griddle renders those
   elements outside this component's subtree — a scoped `:deep()` can't reach
   them, and re-adding transform transitions here would fight Griddle's FLIP. */
</style>
