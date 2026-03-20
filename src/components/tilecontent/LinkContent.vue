<template>
  <div
    class="link-tile-content"
    :class="{
      'is-wide-1-high': isWideOneHigh,
      'is-tall-1-wide': isTallOneWide,
      'is-editing': isEditing,
      'is-owner': layoutStore.canEdit,
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
          <input
            v-if="isEditing"
            ref="titleInputRef"
            v-model="draftTitle"
            class="tile-input tile-input--title tile-input--wide"
            type="text"
            placeholder="Add a title"
            @keydown.enter.prevent
          />
          <p
            v-else-if="displayTitle"
            class="tile-title tile-title--wide"
            @mousedown.stop
            @click="() => startEditing()"
          >
            {{ displayTitle }}
          </p>
        </template>

        <div
          v-if="!isTallOneWide && !isOneByOne"
          class="tile-link-indicator"
          aria-hidden="true"
        >
          <LinkIndicatorIcon class="tile-link-indicator-icon" />
        </div>
      </div>

      <div
        v-if="isTallOneWide"
        class="tile-link-indicator tile-link-indicator--bottom"
        aria-hidden="true"
      >
        <LinkIndicatorIcon class="tile-link-indicator-icon" />
      </div>

      <div
        v-if="!isWideOneHigh && !isTallOneWide && !isOneByOne"
        ref="detailsRef"
        class="tile-details"
        :class="{
          'is-hovered': isDetailsHovered && !isEditing,
          'is-editing': isEditing,
          // 'has-title': !!displayTitle,
          // 'has-description': !!displayDescription,
          // 'has-subtitle': !!displaySubtitle,
        }"
        @mouseenter="isDetailsHovered = true"
        @mouseleave="isDetailsHovered = false"
        @mousedown.stop
        @click="onDetailsClick"
      >
        <div
          class="tile-field tile-field--title"
          :class="{
            'is-visible': isEditing || !!displayTitle,
            'no-animate': !!displayTitle,
          }"
        >
          <p
            class="tile-title"
            :class="{ 'is-sizing-ref': isEditing && !!displayTitle }"
          >
            {{ displayTitle }}
          </p>
          <textarea
            v-if="isEditing"
            ref="titleInputRef"
            v-model="draftTitle"
            class="tile-input tile-input--title"
            :rows="titleLineClamp"
            placeholder="Add a title"
          ></textarea>
        </div>
        <div
          class="tile-field tile-field--description"
          :class="{
            'is-visible': isEditing || !!displayDescription,
            'no-animate': !!displayDescription,
          }"
        >
          <p
            class="tile-description"
            :class="{ 'is-sizing-ref': isEditing && !!displayDescription }"
          >
            {{ displayDescription }}
          </p>
          <textarea
            v-if="isEditing"
            ref="descriptionInputRef"
            v-model="draftDescription"
            class="tile-input tile-input--description"
            rows="2"
            placeholder="Add a description"
          ></textarea>
        </div>
        <div
          class="tile-field tile-field--subtitle"
          :class="{
            'is-visible': isEditing || !!displaySubtitle,
            'no-animate': !!displaySubtitle,
          }"
        >
          <p
            class="tile-subtitle"
            :class="{ 'is-sizing-ref': isEditing && !!displaySubtitle }"
          >
            {{ displaySubtitle }}
          </p>
          <input
            v-if="isEditing"
            ref="subtitleInputRef"
            v-model="draftSubtitle"
            class="tile-input tile-input--subtitle"
            type="text"
            placeholder="Add a subtitle"
          />
        </div>
      </div>
    </div>

    <input
      v-if="layoutStore.canEdit"
      ref="customImageInput"
      class="link-image-input"
      type="file"
      accept="image/*"
      @change.stop="onCustomImageSelected"
    />

    <div
      v-if="layoutStore.canEdit && showUrlInput"
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
        <button type="button" class="link-url-btn" @click.stop="applyImageUrl">
          Save
        </button>
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
        v-if="layoutStore.canEdit && showContextMenu"
        ref="contextMenuRef"
        class="link-context-menu"
        :style="contextMenuStyle"
        @mousedown.stop
      >
        <button
          type="button"
          class="link-context-menu-item"
          @click.stop="handleContextUpload"
        >
          Upload image
        </button>
        <button
          type="button"
          class="link-context-menu-item"
          @click.stop="handleContextUseUrl"
        >
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
  watch,
} from "vue";

import { type LinkContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import { isDirectImageUrl } from "@/utils/TileUtils";
import { useFileUpload } from "@/composables/useFileUpload";
import { useColorPicker } from "@/composables/useColorPicker";
import LinkIndicatorIcon from "../icons/LinkIndicatorIcon.vue";
import { useEditorAutosave } from "@/composables/useEditorAutosave";

export default defineComponent({
  emits: ["background-color-change", "text-color-change"],
  components: {
    LinkIndicatorIcon,
  },
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

    const isOneByOne = computed(
      () => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) === 1,
    );
    const isWideOneHigh = computed(
      () => (gridTileW?.value ?? 0) > 1 && (gridTileH?.value ?? 0) === 1,
    );
    const isTallOneWide = computed(
      () => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) > 1,
    );
    const titleLineClamp = computed(() =>
      (gridTileH?.value ?? 0) < 3 ? 2 : 3,
    );

    const isEditing = ref(false);
    const isDetailsHovered = ref(false);
    const titleInputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(
      null,
    );
    const descriptionInputRef = ref<HTMLTextAreaElement | null>(null);
    const subtitleInputRef = ref<HTMLInputElement | null>(null);
    const detailsRef = ref<HTMLElement | null>(null);
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
      if (!link) return "@handle or address";

      if (link.startsWith("http://") || link.startsWith("https://")) {
        try {
          const url = new URL(link);
          return `@${url.hostname.replace("www.", "")}`;
        } catch {
          return `@${link}`;
        }
      }

      return link.startsWith("@") ? link : `@${link}`;
    };

    const defaultTitle = computed(
      () =>
        props.content.metaTitle ||
        props.content.metaSiteName ||
        props.content.domain ||
        "Link",
    );
    const defaultDescription = computed(
      () => props.content.metaDescription || "",
    );
    const defaultSubtitle = computed(() => formatLink(props.content.link));

    const displayTitle = computed(() =>
      props.content.customTitle !== undefined
        ? props.content.customTitle
        : defaultTitle.value,
    );
    const displayDescription = computed(() =>
      props.content.customDescription !== undefined
        ? props.content.customDescription
        : defaultDescription.value,
    );
    const displaySubtitle = computed(() =>
      props.content.customSubtitle !== undefined
        ? props.content.customSubtitle
        : defaultSubtitle.value,
    );
    const backgroundImageUrl = computed(
      () => props.content.customImageUrl || props.content.metaImageUrl || "",
    );

    const contextMenuStyle = computed(() => ({
      top: `${contextMenuPosition.value.y}px`,
      left: `${contextMenuPosition.value.x}px`,
    }));

    const syncDrafts = () => {
      draftTitle.value =
        props.content.customTitle !== undefined
          ? props.content.customTitle
          : defaultTitle.value;
      draftDescription.value =
        props.content.customDescription !== undefined
          ? props.content.customDescription
          : defaultDescription.value;
      draftSubtitle.value =
        props.content.customSubtitle !== undefined
          ? props.content.customSubtitle
          : defaultSubtitle.value;
    };

    // Track whether the user has ever manually edited each field
    const userEditedTitle = ref(props.content.customTitle !== undefined);
    const userEditedDescription = ref(
      props.content.customDescription !== undefined,
    );
    const userEditedSubtitle = ref(props.content.customSubtitle !== undefined);

    watch(
      [draftTitle, draftDescription, draftSubtitle],
      (_new, _old, onCleanup) => {
        if (isEditing.value) {
          // Mark fields as user-edited once the user starts typing
          userEditedTitle.value = true;
          userEditedDescription.value = true;
          userEditedSubtitle.value = true;
          schedulePersist();
        }

        onCleanup(() => {
          if (isEditing.value) {
            flushPersist();
          }
        });
      },
    );

    // When metadata arrives from getLinkPreview and the user hasn't manually
    // edited a field yet, bake the metadata into the custom fields so it's
    // persisted in the DB and survives future loads.
    watch(
      () => ({
        metaTitle: props.content.metaTitle,
        metaDescription: props.content.metaDescription,
        metaSiteName: props.content.metaSiteName,
        link: props.content.link,
      }),
      (newMeta) => {
        if (!tileId || !layoutStore.canEdit) return;
        // Only run when not editing — this handles the async metadata fetch
        if (isEditing.value) return;

        const patch: Record<string, string> = {};

        if (!userEditedTitle.value) {
          const title = newMeta.metaTitle || newMeta.metaSiteName || "";
          if (title) {
            patch.customTitle = title;
            userEditedTitle.value = true;
          }
        }

        if (!userEditedDescription.value) {
          const desc = newMeta.metaDescription || "";
          if (desc) {
            patch.customDescription = desc;
            userEditedDescription.value = true;
          }
        }

        if (!userEditedSubtitle.value) {
          const sub = formatLink(newMeta.link);
          if (sub) {
            patch.customSubtitle = sub;
            userEditedSubtitle.value = true;
          }
        }

        if (Object.keys(patch).length > 0) {
          // Write metadata into custom fields on the content object
          Object.assign(props.content, patch);
          layoutStore.patchTileContent(tileId, patch);
        }
      },
    );

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      saveEdits(),
    );

    const saveEdits = () => {
      if (!layoutStore.canEdit) return;

      const nextTitle = draftTitle.value.trim();
      const nextDescription = draftDescription.value.trim();
      const nextSubtitle = draftSubtitle.value.trim();

      props.content.customTitle = nextTitle;
      props.content.customDescription = nextDescription;
      props.content.customSubtitle = nextSubtitle;

      const updatedFields = {
        customTitle: nextTitle,
        customDescription: nextDescription,
        customSubtitle: nextSubtitle,
      };

      if (tileId) {
        layoutStore.patchTileContent(tileId, updatedFields);
      } else {
        layoutStore.saveLayout();
      }
    };

    const closeContextMenu = () => {
      showContextMenu.value = false;
    };

    const openUrlInput = () => {
      if (!layoutStore.canEdit) return;
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
      const normalized =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
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
      if (!layoutStore.canEdit) return;
      const normalized = normalizeImageUrl(draftImageUrl.value);
      if (!normalized) {
        urlError.value = "Enter a valid URL.";
        return;
      }
      if (!isDirectImageUrl(normalized)) {
        urlError.value =
          "Only direct image URLs are supported (png, jpg, gif, webp, svg).";
        return;
      }

      props.content.customImageUrl = normalized;
      layoutStore.saveLayout();
      showUrlInput.value = false;
      urlError.value = "";
      closeContextMenu();
    };

    const openCustomImagePicker = () => {
      if (!layoutStore.canEdit) return;
      customImageInput.value?.click();
    };

    const removeCustomImage = () => {
      if (!layoutStore.canEdit) return;
      props.content.customImageUrl = undefined;
      layoutStore.saveLayout();
      closeContextMenu();
      showUrlInput.value = false;
    };

    const uploadCustomImage = async (file: File) => {
      if (!layoutStore.canEdit) return;

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
      if (!layoutStore.canEdit) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadCustomImage(file);
      if (customImageInput.value) customImageInput.value.value = "";
    };

    const onDragEnter = (event: DragEvent) => {
      if (!layoutStore.canEdit) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      isDragOver.value = true;
    };

    const onDragOver = (event: DragEvent) => {
      if (!layoutStore.canEdit) return;
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!layoutStore.canEdit) return;
      const container = linkTileRef.value;
      if (!container) {
        isDragOver.value = false;
        return;
      }
      const rect = container.getBoundingClientRect();
      const { clientX, clientY } = event;
      if (
        clientX <= rect.left ||
        clientX >= rect.right ||
        clientY <= rect.top ||
        clientY >= rect.bottom
      ) {
        isDragOver.value = false;
      }
    };

    const onDrop = async (event: DragEvent) => {
      if (!layoutStore.canEdit) return;
      isDragOver.value = false;
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      await uploadCustomImage(file);
    };

    const clampContextMenuPosition = (
      x: number,
      y: number,
      menuWidth: number,
      menuHeight: number,
    ) => {
      const padding = 8;
      const maxX = window.innerWidth - menuWidth - padding;
      const maxY = window.innerHeight - menuHeight - padding;
      return {
        x: Math.max(padding, Math.min(x, maxX)),
        y: Math.max(padding, Math.min(y, maxY)),
      };
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!layoutStore.canEdit) return;
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
        fallbackHeight,
      );
      showContextMenu.value = true;

      nextTick(() => {
        const menu = contextMenuRef.value;
        if (!menu) return;
        const { width, height } = menu.getBoundingClientRect();
        contextMenuPosition.value = clampContextMenuPosition(
          nextX,
          nextY,
          width,
          height,
        );
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
        document.removeEventListener("click", exitClickHandler);
        exitClickHandler = null;
      }
    };

    const startEditing = (
      focusTarget?: "title" | "description" | "subtitle",
    ) => {
      if (!layoutStore.canEdit || isEditing.value) return;
      isEditing.value = true;
      syncDrafts();
      nextTick(() => {
        setTimeout(() => {
          const targetRef =
            focusTarget === "subtitle"
              ? subtitleInputRef
              : focusTarget === "description"
                ? descriptionInputRef
                : titleInputRef;
          targetRef.value?.focus();
          // Register exit listener since @mousedown.stop bypasses GridTile's addClickListener
          exitClickHandler = (event: MouseEvent) => {
            if (
              linkTileRef.value &&
              !linkTileRef.value.contains(event.target as Node)
            ) {
              isEditing.value = false;
              flushPersist();
              removeExitClickHandler();
            }
          };
          document.addEventListener("click", exitClickHandler);
        }, 0);
      });
    };

    const onDetailsClick = (event: MouseEvent) => {
      if (isEditing.value) return;
      if (!layoutStore.canEdit) return;

      // Determine which field is closest to the click position
      const el = detailsRef.value;
      if (!el) {
        startEditing();
        return;
      }

      const fields = [
        { name: "title" as const, el: el.querySelector(".tile-field--title") },
        {
          name: "description" as const,
          el: el.querySelector(".tile-field--description"),
        },
        {
          name: "subtitle" as const,
          el: el.querySelector(".tile-field--subtitle"),
        },
      ];

      const clickY = event.clientY;
      let closest: "title" | "description" | "subtitle" = "title";
      let minDist = Infinity;

      for (const f of fields) {
        if (!f.el) continue;
        const rect = f.el.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const dist = Math.abs(clickY - centerY);
        if (dist < minDist) {
          minDist = dist;
          closest = f.name;
        }
      }

      startEditing(closest);
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
      if (!layoutStore.canEdit) return;
      if (!isEditing.value) return;
      isEditing.value = false;
      flushPersist();
      removeExitClickHandler();
    };

    const LINK_RESET_COLORS = new Set([
      "var(--color-tile-background)",
      "var(--color-content-background)",
    ]);

    const linkOverlayColor = computed((): string | null => {
      const color = props.content.backgroundColor;
      if (!color || LINK_RESET_COLORS.has(color)) return null;
      return color;
    });

    const { overlayColor, handleBackgroundColorChange } = useColorPicker(
      tileId,
      props.content,
      emit,
      "background",
    );

    return {
      layoutStore,
      overlayColor: linkOverlayColor,
      handleBackgroundColorChange,
      formatLink,
      onShortClick,
      onExitClick,
      isEditing,
      isDetailsHovered,
      detailsRef,
      descriptionInputRef,
      subtitleInputRef,
      startEditing,
      onDetailsClick,
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
    };
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

.tile-wrapper[data-link-background="off"] .tile-background {
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
    linear-gradient(
      180deg,
      transparent 50%,
      color-mix(in srgb, var(--tile-bg) 45%, transparent) 80%,
      var(--tile-bg) 120%
    ),
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--tile-bg) 0%, transparent) 0%,
      color-mix(in srgb, var(--tile-bg) 20%, transparent) 100%
    );
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

.tile-details {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
  padding: 2px;
  margin-left: -8px;
  margin-bottom: -4px;
}

.link-tile-content.is-owner .tile-details {
  cursor: text;
}

.tile-details.is-hovered {
  border-color: rgba(255, 255, 255, 0.13);
}

.tile-details.is-editing {
  background-color: rgba(255, 255, 255, 0.12);
  border-color: transparent;
}

.tile-field {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition:
    max-height 1s ease,
    opacity 0.3s ease,
    background-color 0.15s ease;
  border-radius: 4px;
  /* padding: 2px 4px; */
  padding: 4px;
  margin: -2px;
}

.tile-field.is-visible {
  max-height: 200px;
  opacity: 1;
}

.tile-field--subtitle {
  /* margin-top: -8px !important; */
  margin-top: -4px;
  /* padding-bottom: 4px; */
}

.tile-field--description {
  margin-top: -4px;
  margin-bottom: -4px;
}

.tile-field--title {
  margin-bottom: -4px;
}

.tile-input--subtitle {
  /* margin-top: -8px !important; */
  margin-top: -4px;
  /* padding-bottom: 4px; */
}

.tile-input--description {
  margin-top: -4px;
  margin-bottom: -4px;
}

.tile-input--title {
  margin-bottom: -4px;
}

/* Fields that already had content skip the expand/contract animation */
.tile-field.no-animate {
  transition: background-color 0.15s ease;
  max-height: none;
  opacity: 1;
  overflow: visible;
  display: grid;
}

.tile-field.no-animate > * {
  grid-area: 1 / 1;
}

/* Sizing reference: invisible but still determines container height */
.is-sizing-ref {
  visibility: hidden;
  pointer-events: none;
}

/* Individual field hover darkening when editing */
.tile-details.is-editing .tile-field:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tile-field > .tile-title,
.tile-field > .tile-description,
.tile-field > .tile-subtitle,
.tile-field > .tile-input {
  padding: 2px;
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

.link-tile-content.is-owner .tile-title--wide {
  cursor: text;
  border-radius: var(--radius-sm);
  transition: background-color 0.3s ease;
}

.link-tile-content.is-owner:not(.is-editing) .tile-title--wide:hover {
  background-color: var(--color-editable-hover);
}

.tile-input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--tile-text-color);
  field-sizing: content;
  line-height: inherit;
  resize: none;
}

.tile-input:focus {
  outline: none;
  border: none;
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
  border: 1px dashed
    color-mix(in srgb, var(--color-text-primary) 35%, transparent);
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
