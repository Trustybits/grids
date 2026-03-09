<template>
  <div
    class="link-tile-content"
    :class="{
      'is-wide-1-high': isWideOneHigh,
      'is-tall-1-wide': isTallOneWide,
      'is-editing': isEditing,
      'is-owner': layoutStore.isOwner,
      'is-drag-over': isDragOver,
    }"
    :style="{ '--link-title-lines': String(titleLineClamp) }"
    ref="linkTileRef"
    @contextmenu="onContextMenu"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div v-if="backgroundImageUrl" class="tile-background" aria-hidden="true">
      <img
        class="tile-background-image"
        :src="backgroundImageUrl"
        :alt="content.metaTitle || content.domain"
      />
      <div
        v-if="overlayColor"
        class="link-color-overlay"
        :style="{ backgroundColor: overlayColor }"
        aria-hidden="true"
      />
      <div class="tile-background-overlay"></div>
    </div>

    <div v-if="isDragOver" class="link-image-drop-overlay" aria-hidden="true">
      Drop image to upload
    </div>

    <div class="tile-foreground">
      <div class="tile-header">
        <div class="tile-logo">
          <img :src="content.faviconUrl" :alt="content.domain" />
        </div>

        <template v-if="isWideOneHigh">
          <p v-if="!isEditing" class="tile-title tile-title--wide" @mousedown.stop @click="startEditing">
            {{ displayTitle }}
          </p>
          <input
            v-else
            ref="titleInputRef"
            v-model="draftTitle"
            class="tile-input tile-input--title tile-input--wide"
            type="text"
            placeholder="Add a title"
            @keydown.enter.prevent
          />
        </template>

        <div v-if="!isTallOneWide && !isOneByOne" class="tile-link-indicator" aria-hidden="true">
          <svg
            class="tile-link-indicator-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 17L17 7"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10 7H17V14"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>

      <div v-if="isTallOneWide" class="tile-link-indicator tile-link-indicator--bottom" aria-hidden="true">
        <svg
          class="tile-link-indicator-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 17L17 7"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10 7H17V14"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div v-if="!isWideOneHigh && !isTallOneWide && !isOneByOne" class="tile-text" @mousedown.stop @click="startEditing">
        <template v-if="isEditing">
          <textarea
            ref="titleInputRef"
            v-model="draftTitle"
            class="tile-input tile-input--title"
            :rows="titleLineClamp"
            placeholder="Add a title"
          ></textarea>
          <textarea
            v-model="draftDescription"
            class="tile-input tile-input--description"
            rows="2"
            placeholder="Add a description"
          ></textarea>
          <input
            v-model="draftSubtitle"
            class="tile-input tile-input--subtitle"
            type="text"
            placeholder="Add a subtitle"
          />
        </template>
        <template v-else>
          <p class="tile-title">{{ displayTitle }}</p>
          <p v-if="displayDescription" class="tile-description">{{ displayDescription }}</p>
          <p class="tile-subtitle">{{ displaySubtitle }}</p>
        </template>
      </div>
    </div>

    <input
      v-if="layoutStore.isOwner"
      ref="customImageInput"
      class="link-image-input"
      type="file"
      accept="image/*"
      @change.stop="onCustomImageSelected"
    />

    <div
      v-if="layoutStore.isOwner && showUrlInput"
      class="link-url-input"
      @mousedown.stop
    >
      <span class="link-url-label">Image URL</span>
      <input
        v-model="draftImageUrl"
        class="link-url-field"
        type="url"
        placeholder="https://example.com/image.jpg"
        aria-label="Image URL"
        @keydown.enter.prevent="applyImageUrl"
        @keydown.escape.stop.prevent="cancelUrlInput"
      />
      <p v-if="urlError" class="link-url-error">{{ urlError }}</p>
      <div class="link-url-actions">
        <button type="button" class="link-url-btn" @click.stop="applyImageUrl">Save</button>
        <button
          type="button"
          class="link-url-btn link-url-btn--ghost"
          @click.stop="cancelUrlInput"
        >
          Cancel
        </button>
      </div>
    </div>

    <teleport to="body">
      <div
        v-if="layoutStore.isOwner && showContextMenu"
        ref="contextMenuRef"
        class="link-context-menu"
        :style="contextMenuStyle"
        @mousedown.stop
      >
        <button type="button" class="link-context-menu-item" @click.stop="handleContextUpload">
          Upload image
        </button>
        <button type="button" class="link-context-menu-item" @click.stop="handleContextUseUrl">
          Use image URL
        </button>
        <button
          v-if="content.customImageUrl"
          type="button"
          class="link-context-menu-item link-context-menu-item--danger"
          @click.stop="handleContextRemove"
        >
          Remove image
        </button>
      </div>
    </teleport>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  inject,
  computed,
  ref,
  type ComputedRef,
  onMounted,
  onUnmounted,
  nextTick,
} from "vue";

import { type LinkContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import { isDirectImageUrl } from "@/utils/TileUtils";
import { useFileUpload } from "@/composables/useFileUpload";
import { useColorPicker } from "@/composables/useColorPicker";

export default defineComponent({
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => LinkContent,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const tileId = inject<string | null>("tileId", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);

    const isOneByOne = computed(() => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) === 1); 
    const isWideOneHigh = computed(() => (gridTileW?.value ?? 0) > 1 && (gridTileH?.value ?? 0) === 1);
    const isTallOneWide = computed(() => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) > 1);
    const titleLineClamp = computed(() => ((gridTileH?.value ?? 0) < 3 ? 2 : 3));

    const isEditing = ref(false);
    const titleInputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const draftTitle = ref("");
    const draftDescription = ref("");
    const draftSubtitle = ref("");
    const customImageInput = ref<HTMLInputElement | null>(null);
    const linkTileRef = ref<HTMLElement | null>(null);
    const contextMenuRef = ref<HTMLDivElement | null>(null);
    const showContextMenu = ref(false);
    const contextMenuPosition = ref({ x: 0, y: 0 });
    const isDragOver = ref(false);
    const showUrlInput = ref(false);
    const draftImageUrl = ref("");
    const urlError = ref("");
    const { uploadFileToUrl } = useFileUpload();

    const formatLink = (link: string) => {
      if (!link) return '@handle or address';
      
      if (link.startsWith('http://') || link.startsWith('https://')) {
        try {
          const url = new URL(link);
          return `@${url.hostname.replace('www.', '')}`;
        } catch {
          return `@${link}`;
        }
      }
      
      return link.startsWith('@') ? link : `@${link}`;
    };

    const defaultTitle = computed(
      () => props.content.metaTitle || props.content.metaSiteName || props.content.domain || "Link"
    );
    const defaultDescription = computed(() => props.content.metaDescription || "");
    const defaultSubtitle = computed(() => formatLink(props.content.link));

    const displayTitle = computed(() => props.content.customTitle?.trim() || defaultTitle.value);
    const displayDescription = computed(
      () => props.content.customDescription?.trim() || defaultDescription.value
    );
    const displaySubtitle = computed(
      () => props.content.customSubtitle?.trim() || defaultSubtitle.value
    );
    const backgroundImageUrl = computed(
      () => props.content.customImageUrl || props.content.metaImageUrl || ""
    );

    const contextMenuStyle = computed(() => ({
      top: `${contextMenuPosition.value.y}px`,
      left: `${contextMenuPosition.value.x}px`,
    }));

    const syncDrafts = () => {
      draftTitle.value = displayTitle.value;
      draftDescription.value = displayDescription.value;
      draftSubtitle.value = displaySubtitle.value;
    };

    const saveEdits = () => {
      if (!layoutStore.isOwner) return;

      const nextTitle = draftTitle.value.trim();
      const nextDescription = draftDescription.value.trim();
      const nextSubtitle = draftSubtitle.value.trim();

      props.content.customTitle = nextTitle || undefined;
      props.content.customDescription = nextDescription || undefined;
      props.content.customSubtitle = nextSubtitle || undefined;

      layoutStore.saveLayout();
    };

    const closeContextMenu = () => {
      showContextMenu.value = false;
    };

    const openUrlInput = () => {
      if (!layoutStore.isOwner) return;
      draftImageUrl.value = props.content.customImageUrl || "";
      urlError.value = "";
      showUrlInput.value = true;
      closeContextMenu();
    };

    const cancelUrlInput = () => {
      showUrlInput.value = false;
      urlError.value = "";
    };

    const normalizeImageUrl = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
      try {
        new URL(normalized);
        return normalized;
      } catch {
        return "";
      }
    };

    const applyImageUrl = () => {
      if (!layoutStore.isOwner) return;
      const normalized = normalizeImageUrl(draftImageUrl.value);
      if (!normalized) {
        urlError.value = "Enter a valid URL.";
        return;
      }
      if (!isDirectImageUrl(normalized)) {
        urlError.value = "Only direct image URLs are supported (png, jpg, gif, webp, svg).";
        return;
      }

      props.content.customImageUrl = normalized;
      layoutStore.saveLayout();
      showUrlInput.value = false;
      urlError.value = "";
      closeContextMenu();
    };

    const openCustomImagePicker = () => {
      if (!layoutStore.isOwner) return;
      customImageInput.value?.click();
    };

    const removeCustomImage = () => {
      if (!layoutStore.isOwner) return;
      props.content.customImageUrl = undefined;
      layoutStore.saveLayout();
      closeContextMenu();
      showUrlInput.value = false;
    };

    const uploadCustomImage = async (file: File) => {
      if (!layoutStore.isOwner) return;

      if (!file.type.startsWith("image/")) {
        alert("Unsupported file type. Please upload an image.");
        return;
      }

      try {
        const url = await uploadFileToUrl(file, { fileType: "images" });
        props.content.customImageUrl = url;
        layoutStore.saveLayout();
      } catch (error: any) {
        console.error("Link tile image upload failed:", error);
        alert(error.message || "Failed to upload image. Please try again.");
      }
    };

    const onCustomImageSelected = async (event: Event) => {
      if (!layoutStore.isOwner) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadCustomImage(file);
      if (customImageInput.value) customImageInput.value.value = "";
    };

    const onDragEnter = (event: DragEvent) => {
      if (!layoutStore.isOwner) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      isDragOver.value = true;
    };

    const onDragOver = (event: DragEvent) => {
      if (!layoutStore.isOwner) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!layoutStore.isOwner) return;
      const container = linkTileRef.value;
      if (!container) {
        isDragOver.value = false;
        return;
      }
      const rect = container.getBoundingClientRect();
      const { clientX, clientY } = event;
      if (clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom) {
        isDragOver.value = false;
      }
    };

    const onDrop = async (event: DragEvent) => {
      if (!layoutStore.isOwner) return;
      isDragOver.value = false;
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      await uploadCustomImage(file);
    };

    const clampContextMenuPosition = (x: number, y: number, menuWidth: number, menuHeight: number) => {
      const padding = 8;
      const maxX = window.innerWidth - menuWidth - padding;
      const maxY = window.innerHeight - menuHeight - padding;
      return {
        x: Math.max(padding, Math.min(x, maxX)),
        y: Math.max(padding, Math.min(y, maxY)),
      };
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!layoutStore.isOwner) return;
      event.preventDefault();
      event.stopPropagation();

      const nextX = event.clientX;
      const nextY = event.clientY;
      const fallbackWidth = 180;
      const fallbackHeight = props.content.customImageUrl ? 88 : 48;

      contextMenuPosition.value = clampContextMenuPosition(
        nextX,
        nextY,
        fallbackWidth,
        fallbackHeight
      );
      showContextMenu.value = true;

      nextTick(() => {
        const menu = contextMenuRef.value;
        if (!menu) return;
        const { width, height } = menu.getBoundingClientRect();
        contextMenuPosition.value = clampContextMenuPosition(nextX, nextY, width, height);
      });
    };

    const handleContextUpload = () => {
      closeContextMenu();
      openCustomImagePicker();
    };

    const handleContextUseUrl = () => {
      openUrlInput();
    };

    const handleContextRemove = () => {
      closeContextMenu();
      removeCustomImage();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!showContextMenu.value) return;
      if (contextMenuRef.value?.contains(event.target as Node)) return;
      showContextMenu.value = false;
    };

    onMounted(() => {
      document.addEventListener("click", handleDocumentClick);
      document.addEventListener("contextmenu", handleDocumentClick);
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("contextmenu", handleDocumentClick);
      removeExitClickHandler();
    });

    let exitClickHandler: ((event: MouseEvent) => void) | null = null;

    const removeExitClickHandler = () => {
      if (exitClickHandler) {
        document.removeEventListener('click', exitClickHandler);
        exitClickHandler = null;
      }
    };

    const startEditing = () => {
      if (!layoutStore.isOwner || isEditing.value) return;
      isEditing.value = true;
      syncDrafts();
      nextTick(() => {
        setTimeout(() => {
          titleInputRef.value?.focus();
          // Register exit listener since @mousedown.stop bypasses GridTile's addClickListener
          exitClickHandler = (event: MouseEvent) => {
            if (linkTileRef.value && !linkTileRef.value.contains(event.target as Node)) {
              isEditing.value = false;
              saveEdits();
              removeExitClickHandler();
            }
          };
          document.addEventListener('click', exitClickHandler);
        }, 0);
      });
    };

    const openLink = () => {
      const url = props.content.link.startsWith("http")
        ? props.content.link
        : `https://${props.content.link}`;
      window.open(url, "_blank");
    };

    const onShortClick = () => {
      if (isEditing.value) return;
      openLink();
    };

    const onExitClick = () => {
      if (!layoutStore.isOwner) return;
      if (!isEditing.value) return;
      isEditing.value = false;
      saveEdits();
      removeExitClickHandler();
    };

    const { overlayColor, handleBackgroundColorChange } = useColorPicker(
      tileId,
      props.content,
      emit,
      "background",
    );

    return {
      layoutStore,
      overlayColor,
      handleBackgroundColorChange,
      formatLink,
      onShortClick,
      onExitClick,
      isEditing,
      startEditing,
      titleInputRef,
      titleLineClamp,
      isOneByOne,
      isWideOneHigh,
      isTallOneWide,
      displayTitle,
      displayDescription,
      displaySubtitle,
      backgroundImageUrl,
      contextMenuStyle,
      draftTitle,
      draftDescription,
      draftSubtitle,
      customImageInput,
      linkTileRef,
      contextMenuRef,
      showContextMenu,
      isDragOver,
      showUrlInput,
      draftImageUrl,
      urlError,
      openCustomImagePicker,
      openUrlInput,
      cancelUrlInput,
      applyImageUrl,
      removeCustomImage,
      onCustomImageSelected,
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      onContextMenu,
      handleContextUpload,
      handleContextUseUrl,
      handleContextRemove,
    }
  },
});
</script>

<style scoped>
.link-tile-content {
  --link-title-lines: 3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  position: relative;
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  isolation: isolate;
  transform: translateZ(0);
}

.tile-background {
  position: absolute;
  inset: -1px;
  z-index: 0;
  pointer-events: none;
}

.tile-wrapper[data-link-background='off'] .tile-background {
  display: none;
}

.tile-background-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transform: translateZ(0);
}

.link-color-overlay {
  position: absolute;
  inset: 0;
  mix-blend-mode: color;
  pointer-events: none;
}

.tile-background-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(180deg, transparent 50%, 
      color-mix(in srgb, var(--color-tile-background) 10%, transparent) 70%, var(--color-tile-background) 120%), 
    linear-gradient(90deg, 
      color-mix(in srgb, var(--color-tile-background) 0%, transparent) 0%, 
      color-mix(in srgb, var(--color-tile-background) 20%, transparent) 100%);
    /* linear-gradient(
      180deg,
      transparent 21%,
      color-mix(in srgb, var(--color-tile-background) 76%, transparent) 76%,
      var(--color-tile-background) 100%
    ),
    linear-gradient(90deg, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 0%, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 100%); */
  transform: translateZ(0);
}

.tile-foreground {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--spacing-md);
  width: 100%;
  height: 100%;
}

.tile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.link-tile-content.is-wide-1-high .tile-header {
  align-items: center;
  gap: 12px;
}

.link-tile-content.is-wide-1-high .tile-link-indicator {
  margin-left: auto;
}

.link-tile-content.is-tall-1-wide .tile-foreground {
  gap: 0;
}

.link-tile-content.is-tall-1-wide .tile-link-indicator--bottom {
  margin-top: auto;
  align-self: flex-end;
  width: 100%;
}

.tile-logo {
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.tile-logo img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.tile-link-indicator {
  width: 24px;
  height: 24px;
  color: var(--tile-text-color);
  opacity: 0.21;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}

.link-tile-content:hover .tile-link-indicator {
  opacity: 1;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.tile-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tile-title {
  color: var(--tile-text-color);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: var(--link-title-lines);
  -webkit-line-clamp: var(--link-title-lines);
}

.tile-title--wide {
  display: block;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  line-clamp: unset;
  -webkit-line-clamp: unset;
}

.tile-description {
  color: color-mix(in srgb, var(--tile-text-color) 65%, transparent);
  font-size: 12px;
  line-height: 16px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  font-family: "Inter", sans-serif;
}

.tile-subtitle {
  color: color-mix(in srgb, var(--tile-text-color) 65%, transparent);
  font-size: 12px;
  line-height: 16px;
  margin: 0;
}

.link-tile-content.is-owner .tile-text,
.link-tile-content.is-owner .tile-title--wide {
  cursor: text;
  border-radius: var(--radius-sm);
  transition: background-color 0.3s ease;
}

.link-tile-content.is-owner:not(.is-editing) .tile-text:hover,
.link-tile-content.is-owner:not(.is-editing) .tile-title--wide:hover {
  background-color: var(--color-editable-hover);
}

.tile-input {
  width: 100%;
  border: 0px solid transparent;
  background: color-mix(in srgb, var(--color-tile-background) 84%, transparent);
  color: var(--tile-text-color);
  field-sizing: content;
  padding: 0;
  line-height: inherit;
  resize: none;
}

.tile-input:focus {
  outline: none;
  border: 0px solid transparent;
  padding: 0;
  field-sizing: content;
  font-family: "Inter", sans-serif;
}

.tile-input--title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  font-family: "Inter", sans-serif;
  margin: 0;
}

.tile-input--wide {
  min-width: 0;
}

.tile-input--description {
  font-size: 12px;
  line-height: 16px;
  color: color-mix(in srgb, var(--tile-text-color) 65%, transparent);
  font-family: "Inter", sans-serif;
}

.tile-input--subtitle {
  font-size: 12px;
  line-height: 16px;
  font-family: "Inter", sans-serif;
  color: color-mix(in srgb, var(--tile-text-color) 65%, transparent);
}

.link-image-input {
  display: none;
}

.link-image-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 600;
  background: color-mix(in srgb, var(--color-tile-background) 70%, transparent);
  border: 1px dashed color-mix(in srgb, var(--color-text-primary) 35%, transparent);
  border-radius: var(--tile-border-radius);
  pointer-events: none;
}

.link-context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-tile-hover);
}

.link-context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
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

.link-context-menu-item:hover {
  background: var(--color-content-low);
}

.link-context-menu-item--danger {
  color: #ff3737;
}
</style>