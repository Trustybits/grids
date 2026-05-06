<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div
    class="document-stack-tile"
    :class="{
      'is-owner': layoutStore.canEdit,
      'is-uploading': isUploading,
      'has-multiple': items.length > 1,
      'is-editing': isEditing,
    }"
    :style="{
      background: backgroundColor,
      color: textColor,
    }"
    ref="docTileRef"
    @click="onTileClick"
  >
    <div
      class="tile-background doc-stack-pages"
      @click.stop="openPreviewFromStack"
    >
      <template v-if="items.length > 1">
        <div class="doc-stack-paper doc-stack-paper--back-left" aria-hidden="true" />
        <div class="doc-stack-paper doc-stack-paper--back-right" aria-hidden="true" />
      </template>
      <div class="doc-stack-paper doc-stack-paper--front" aria-hidden="true">
        <img
          v-if="frontThumbDisplayUrl"
          class="doc-stack-thumb"
          :src="frontThumbDisplayUrl"
          alt=""
        />
        <div v-else class="doc-stack-placeholder">
          <DocumentTileIcon class="doc-stack-placeholder-icon" />
        </div>
      </div>
      <div
        v-if="docOverlayColor"
        class="link-color-overlay"
        :style="{ backgroundColor: docOverlayColor }"
        aria-hidden="true"
      />
      <div class="tile-background-overlay" aria-hidden="true" />
    </div>

    <div class="tile-foreground">
      <div class="doc-header-row">
        <div class="tile-logo tile-logo--doc">
          <DocumentTileIcon class="tile-logo-doc-icon" />
        </div>
        <div
          ref="detailsRef"
          class="tile-details"
          :class="{
            'is-hovered': isDetailsHovered && !isEditing,
            'is-editing': isEditing,
            'additional-top-padding': !displayTitle,
          }"
          @mouseenter="isDetailsHovered = true"
          @mouseleave="isDetailsHovered = false"
          @mousedown.stop
          @click.stop="onDetailsClick"
        >
          <div
            v-if="
              !displayTitle &&
              !displaySubtitle &&
              !isEditing &&
              isDetailsHovered &&
              layoutStore.canEdit
            "
            class="tile-details-placeholder"
          >
            Add a title
          </div>
          <div
            class="tile-field-wrap tile-field-wrap--title scrollable-thin"
            :class="{
              'is-visible': isEditing || !!displayTitle,
              'has-overflow': !isEditing,
            }"
          >
            <textarea
              ref="titleInputRef"
              v-model="draftTitle"
              class="tile-field tile-field--title"
              :readonly="!isEditing"
              :tabindex="isEditing ? 0 : -1"
              placeholder="Add a title"
              rows="1"
            />
          </div>
          <div
            class="tile-field-wrap tile-field-wrap--subtitle"
            :class="{ 'is-visible': isEditing || !!displaySubtitle }"
          >
            <input
              ref="subtitleInputRef"
              v-model="draftSubtitle"
              class="tile-field tile-field--subtitle"
              type="text"
              :readonly="!isEditing"
              :tabindex="isEditing ? 0 : -1"
              placeholder="Add a subtitle"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="layoutStore.uploadingTiles[tileId] !== undefined && layoutStore.uploadingTiles[tileId]! >= 0"
      class="doc-upload-progress"
    >
      <div
        class="doc-upload-progress__bar"
        :style="{ width: `${Math.round((layoutStore.uploadingTiles[tileId] as number) * 100)}%` }"
      />
    </div>

    <DocumentPreviewer
      v-model:open="previewOpen"
      :items="items"
      :start-index="previewStartIndex"
      @close="closePreview"
    />
  </div>
</template>

<script lang="ts">
/* eslint-disable vue/no-mutating-props */
import {
  computed,
  defineComponent,
  nextTick,
  onUnmounted,
  ref,
  watch,
} from "vue";
import type {
  DocumentStackContent as DocumentStackContentType,
} from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import DocumentTileIcon from "@/components/icons/DocumentTileIcon.vue";
import DocumentPreviewer from "@/components/tilecontent/DocumentPreviewer.vue";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import {
  documentItemIsPdf,
  ensureDocumentItemThumbnailOnServer,
} from "@/composables/useDocumentThumbnail";

const LINK_RESET_COLORS = new Set([
  "var(--color-tile-background)",
  "var(--color-content-background)",
]);

export default defineComponent({
  name: "DocumentStackContent",
  components: { DocumentTileIcon, DocumentPreviewer },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => DocumentStackContentType,
      required: true,
    },
    tileId: {
      type: String,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();
    const { backgroundColor, textColor, handleBackgroundColorChange } =
      useColorPicker(props.tileId, props.content, emit);

    const docOverlayColor = computed((): string | null => {
      const color = props.content.backgroundColor;
      if (!color || LINK_RESET_COLORS.has(color)) return null;
      return color;
    });

    const items = computed(() => props.content.items ?? []);
    const primary = computed(() => items.value[0]);

    const defaultTitle = computed(
      () => primary.value?.fileName?.trim() || "Document",
    );

    const defaultSubtitle = computed(() => {
      const n = items.value.length;
      if (n <= 0) return "";
      return n === 1 ? "1 file" : `${n} files`;
    });

    const displayTitle = computed(() =>
      props.content.customTitle !== undefined
        ? props.content.customTitle
        : defaultTitle.value,
    );

    const displaySubtitle = computed(() =>
      props.content.customSubtitle !== undefined
        ? props.content.customSubtitle
        : defaultSubtitle.value,
    );

    const frontThumbDisplayUrl = computed(() => {
      const p = primary.value;
      if (!p?.thumbnailUrl) return "";
      return p.thumbnailUrl;
    });

    const isUploading = computed(() => {
      const p = layoutStore.uploadingTiles[props.tileId];
      return p !== undefined && p >= 0;
    });

    const previewOpen = ref(false);
    const previewStartIndex = ref(0);

    const isEditing = ref(false);
    const isDetailsHovered = ref(false);
    const titleInputRef = ref<HTMLTextAreaElement | null>(null);
    const subtitleInputRef = ref<HTMLInputElement | null>(null);
    const detailsRef = ref<HTMLElement | null>(null);
    const docTileRef = ref<HTMLElement | null>(null);
    const draftTitle = ref("");
    const draftSubtitle = ref("");

    const syncDrafts = () => {
      draftTitle.value = displayTitle.value;
      draftSubtitle.value = displaySubtitle.value;
    };

    watch(
      [displayTitle, displaySubtitle],
      () => {
        if (!isEditing.value) syncDrafts();
      },
      { immediate: true },
    );

    const userEditedTitle = ref(props.content.customTitle !== undefined);
    const userEditedSubtitle = ref(
      props.content.customSubtitle !== undefined,
    );

    const saveEdits = () => {
      if (!layoutStore.canEdit) return;
      const nextTitle = draftTitle.value.trim();
      const nextSubtitle = draftSubtitle.value.trim();
      props.content.customTitle = nextTitle;
      props.content.customSubtitle = nextSubtitle;
      layoutStore.patchTileContent(props.tileId, {
        customTitle: nextTitle,
        customSubtitle: nextSubtitle,
      });
    };

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      saveEdits(),
    );

    watch([draftTitle, draftSubtitle], () => {
      if (isEditing.value) {
        userEditedTitle.value = true;
        userEditedSubtitle.value = true;
        schedulePersist();
      }
    });

    const openPreview = (event?: MouseEvent) => {
      if (isEditing.value) return;
      if (event) {
        const t = event.target as HTMLElement;
        if (t.closest("a, button, input, textarea")) return;
      }
      if (!items.value.length) return;
      previewStartIndex.value = 0;
      previewOpen.value = true;
    };

    const openPreviewFromStack = (event: MouseEvent) => {
      event.stopPropagation();
      openPreview(event);
    };

    const closePreview = () => {
      previewOpen.value = false;
    };

    let exitClickHandler: ((event: MouseEvent) => void) | null = null;

    const removeExitClickHandler = () => {
      if (exitClickHandler) {
        document.removeEventListener("click", exitClickHandler);
        exitClickHandler = null;
      }
    };

    const stopEditing = () => {
      if (!isEditing.value) return;
      flushPersist();
      layoutStore.commitEditing();
      removeExitClickHandler();
      isEditing.value = false;
      nextTick(() => syncDrafts());
    };

    const startEditing = (focusTarget?: "title" | "subtitle") => {
      if (!layoutStore.canEdit || isEditing.value) return;
      layoutStore.beginEditing(props.tileId);
      isEditing.value = true;
      syncDrafts();
      nextTick(() => {
        setTimeout(() => {
          const targetRef =
            focusTarget === "subtitle" ? subtitleInputRef : titleInputRef;
          targetRef.value?.focus();
          exitClickHandler = (event: MouseEvent) => {
            if (
              docTileRef.value &&
              !docTileRef.value.contains(event.target as Node)
            ) {
              stopEditing();
            }
          };
          document.addEventListener("click", exitClickHandler);
        }, 0);
      });
    };

    const onDetailsClick = (event: MouseEvent) => {
      if (isEditing.value) return;
      if (!layoutStore.canEdit) return;
      const el = detailsRef.value;
      if (!el) {
        startEditing();
        return;
      }
      if (!displayTitle.value && !displaySubtitle.value) {
        startEditing("title");
        return;
      }
      const clickY = event.clientY;
      const titleEl = el.querySelector(".tile-field--title");
      const subEl = el.querySelector(".tile-field--subtitle");
      let closest: "title" | "subtitle" = "title";
      let minDist = Infinity;
      for (const f of [
        { name: "title" as const, el: titleEl },
        { name: "subtitle" as const, el: subEl },
      ]) {
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

    const onTileClick = (event: MouseEvent) => {
      if (isEditing.value) {
        const target = event.target as HTMLElement;
        if (!target.closest("input, textarea")) {
          stopEditing();
        }
      }
    };

    const onShortClick = (event: MouseEvent) => {
      openPreview(event);
    };

    const requestedThumbIds = ref(new Set<string>());

    const requestPrimaryPdfThumb = () => {
      const layoutId = layoutStore.currentLayout?.id;
      if (!layoutId || !layoutStore.canEdit) return;
      const p = primary.value;
      if (!p || p.thumbnailUrl) return;
      if (!documentItemIsPdf(p.fileName, p.mimeType)) return;
      if (p.url.startsWith("blob:")) return;
      if (requestedThumbIds.value.has(p.id)) return;
      requestedThumbIds.value.add(p.id);
      void ensureDocumentItemThumbnailOnServer(layoutId, props.tileId, p.id)
        .then((res) => {
          if (res.thumbnailUrl) {
            layoutStore.patchDocumentStackItem(props.tileId, p.id, {
              thumbnailUrl: res.thumbnailUrl,
            });
          }
        })
        .catch((err) => {
          console.warn("Document thumbnail request failed:", err);
          requestedThumbIds.value.delete(p.id);
        });
    };

    watch(
      [primary, () => layoutStore.currentLayout?.id, () => layoutStore.canEdit],
      () => {
        requestPrimaryPdfThumb();
      },
      { immediate: true },
    );

    onUnmounted(() => {
      removeExitClickHandler();
    });

    return {
      layoutStore,
      items,
      displayTitle,
      displaySubtitle,
      frontThumbDisplayUrl,
      isUploading,
      previewOpen,
      previewStartIndex,
      closePreview,
      backgroundColor,
      textColor,
      handleBackgroundColorChange,
      docOverlayColor,
      isEditing,
      isDetailsHovered,
      titleInputRef,
      subtitleInputRef,
      detailsRef,
      docTileRef,
      draftTitle,
      draftSubtitle,
      onDetailsClick,
      onTileClick,
      onShortClick,
      openPreviewFromStack,
    };
  },
});
</script>

<style scoped>
.document-stack-tile {
  --doc-thumb-pad: 8%;
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  isolation: isolate;
}

.tile-background {
  position: absolute;
  inset: -1px;
  z-index: 0;
  pointer-events: auto;
  cursor: pointer;
}

.doc-stack-pages {
  inset: 0;
}

.doc-stack-paper {
  position: absolute;
  left: var(--doc-thumb-pad);
  right: var(--doc-thumb-pad);
  top: 12%;
  bottom: 26%;
  border-radius: 10px;
  transform-origin: center bottom;
  transition:
    transform 0.35s ease,
    opacity 0.35s ease;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4);
}

.doc-stack-paper--back-left {
  z-index: 1;
  background: linear-gradient(145deg, #3a3a42, #242428);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.doc-stack-paper--back-right {
  z-index: 2;
  background: linear-gradient(145deg, #34343c, #1e1e22);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.document-stack-tile.has-multiple .doc-stack-paper--back-left {
  transform: rotate(-4deg) translate(-5px, 7px) scale(0.93);
  opacity: 0.55;
}

.document-stack-tile.has-multiple .doc-stack-paper--back-right {
  transform: rotate(4deg) translate(5px, 4px) scale(0.95);
  opacity: 0.62;
}

.document-stack-tile.has-multiple:hover .doc-stack-paper--back-left {
  transform: rotate(-11deg) translate(-22px, 4px) scale(0.88);
  opacity: 0.95;
}

.document-stack-tile.has-multiple:hover .doc-stack-paper--back-right {
  transform: rotate(11deg) translate(22px, 4px) scale(0.88);
  opacity: 0.95;
}

.doc-stack-paper--front {
  z-index: 3;
  overflow: hidden;
  background: color-mix(
    in srgb,
    var(--color-content-background, #10100e) 88%,
    #fff 12%
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.doc-stack-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: translateZ(0);
}

.doc-stack-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    160deg,
    rgba(255, 255, 255, 0.06) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
}

.doc-stack-placeholder-icon {
  width: 40%;
  height: 40%;
  max-width: 72px;
  max-height: 72px;
  opacity: 0.35;
  color: var(--color-text-primary, #fff);
}

.link-color-overlay {
  position: absolute;
  inset: 0;
  mix-blend-mode: color;
  pointer-events: none;
  z-index: 4;
}

.tile-background-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
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
  pointer-events: none;
  transform: translateZ(0);
}

.tile-foreground {
  position: relative;
  z-index: 6;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: var(--tile-padding);
  pointer-events: none;
}

.doc-header-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-width: 0;
  pointer-events: auto;
}

.tile-logo--doc {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--tile-text-color, #fff);
}

.tile-logo-doc-icon {
  width: 22px;
  height: 22px;
}

.tile-details-placeholder {
  color: var(--tile-text-color);
  opacity: 0.5;
  padding: 6px 6px;
  margin-top: -4px;
  transition: opacity 0.2s ease;
}

.tile-details {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
  padding: 2px;
  margin-bottom: -4px;
  overflow: hidden;
  min-height: 0;
  margin-top: 0;
}

.document-stack-tile.is-owner .tile-details {
  cursor: text;
}

.tile-details.is-hovered {
  background-color: color-mix(
    in srgb,
    transparent 45%,
    color-mix(in srgb, var(--tile-bg) 82%, var(--tile-text-color) 3%) 65%
  );
}

.tile-details.is-editing {
  background-color: var(--tile-bg);
  border-color: transparent;
}

.tile-details.additional-top-padding {
  padding-top: 4px;
}

.tile-field-wrap {
  overflow: hidden;
  border-radius: 4px;
  margin-left: -2px;
  margin-right: -2px;
  max-height: 0;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    max-height 0.3s ease,
    padding 0.3s ease,
    opacity 0.25s ease;
}

.tile-field-wrap.is-visible {
  opacity: 1;
  pointer-events: auto;
  transition:
    max-height 0.35s ease,
    padding 0.35s ease,
    opacity 0.3s ease;
}

.tile-field-wrap--title {
  margin-top: -2px;
}

.tile-details.is-editing .tile-field-wrap {
  -webkit-mask-image: none;
  mask-image: none;
}

.tile-details.is-editing .tile-field-wrap:hover {
  background-color: color-mix(
    in srgb,
    var(--color-input-edit) 97%,
    var(--tile-text-color) 3%
  );
}

.tile-field {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--tile-text-color);
  font-family: "Inter", sans-serif;
  cursor: inherit;
  resize: none;
  field-sizing: content;
  padding: 8px 8px;
  margin: -8px -8px;
}

.tile-field:focus {
  outline: none;
}

.tile-field[readonly]::placeholder {
  color: transparent;
}

.tile-field::placeholder {
  color: color-mix(in srgb, var(--tile-text-color) 55%, transparent 45%);
}

.tile-field-wrap--title.is-visible {
  max-height: none;
  min-height: 28px;
  padding: 4px 6px;
  padding-top: 6px;
}

.tile-details.is-editing .tile-field-wrap--title.is-visible {
  max-height: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tile-field--title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  padding: 0;
  margin: 0;
  border: none;
}

.tile-field-wrap--subtitle.is-visible {
  max-height: none;
  min-height: 26px;
  padding: 2px 6px 6px;
}

.tile-field--subtitle {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  opacity: 0.9;
  padding: 0;
  margin: 0;
}

.doc-upload-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  z-index: 8;
}

.doc-upload-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #6ea8fe, #9b7bff);
  transition: width 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .doc-stack-paper {
    transition: none;
  }

  .document-stack-tile.has-multiple .doc-stack-paper--back-left,
  .document-stack-tile.has-multiple .doc-stack-paper--back-right,
  .document-stack-tile.has-multiple:hover .doc-stack-paper--back-left,
  .document-stack-tile.has-multiple:hover .doc-stack-paper--back-right {
    transform: rotate(0deg) translate(0, 6px) scale(0.94);
    opacity: 0.65;
  }
}
</style>
