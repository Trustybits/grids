<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div
    class="doc-tile-content"
    :class="{
      'is-mini': isOneByOne,
      'is-banner': isBanner,
      'is-narrow-tall': isNarrowTall,
      'is-editing': isEditing,
      'is-owner': layoutStore.canEdit,
      'has-multiple': items.length > 1,
      'is-uploading': isUploading,
    }"
    ref="tileRef"
    @click="onTileClick"
  >
    <div
      v-if="overlayColor"
      class="doc-color-overlay"
      :style="{ backgroundColor: overlayColor }"
      aria-hidden="true"
    />

    <!-- File-type illustration. Hidden for 1-wide and 1×1 layouts. -->
    <div
      v-if="showIllustration"
      class="doc-art"
      :class="`doc-art--${illustrationPlacement}`"
      aria-hidden="true"
    >
      <img
        :src="illustrationSrc"
        :alt="''"
        class="doc-art__img"
        draggable="false"
      />
    </div>

    <div class="doc-foreground">
      <div class="doc-header">
        <div class="tile-logo doc-tile-logo">
          <FileIcon
            v-if="items.length <= 1"
            :size="24"
            class="doc-tile-logo-icon"
          />
          <FolderIcon v-else :size="24" class="doc-tile-logo-icon" />
        </div>

        <!-- Banner sizes: details inline with the icon -->
        <div
          v-if="showInlineDetails"
          ref="detailsRef"
          class="tile-details doc-details doc-details--inline"
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
              !displayDescription &&
              !isEditing &&
              isDetailsHovered
            "
            class="tile-details-placeholder"
          >
            Add a title
          </div>
          <DocumentDetailsFields
            :is-editing="isEditing"
            :display-title="displayTitle"
            :display-description="displayDescription"
            v-model:draft-title="draftTitle"
            v-model:draft-description="draftDescription"
            :title-input-ref="(el: HTMLTextAreaElement | null) => (titleInputRef = el)"
            :description-input-ref="
              (el: HTMLTextAreaElement | null) => (descriptionInputRef = el)
            "
          />
        </div>
      </div>

      <!-- Bottom details: every shape that isn't 1×1 or banner -->
      <div
        v-if="showBottomDetails"
        ref="detailsRef"
        class="tile-details doc-details doc-details--bottom"
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
            !displayDescription &&
            !isEditing &&
            isDetailsHovered
          "
          class="tile-details-placeholder"
        >
          Add a title
        </div>
        <DocumentDetailsFields
          :is-editing="isEditing"
          :display-title="displayTitle"
          :display-description="displayDescription"
          v-model:draft-title="draftTitle"
          v-model:draft-description="draftDescription"
          :title-input-ref="(el: HTMLTextAreaElement | null) => (titleInputRef = el)"
          :description-input-ref="
            (el: HTMLTextAreaElement | null) => (descriptionInputRef = el)
          "
        />
      </div>
    </div>

    <div
      v-if="
        layoutStore.uploadingTiles[tileId] !== undefined &&
        layoutStore.uploadingTiles[tileId]! >= 0
      "
      class="doc-upload-progress"
    >
      <div
        class="doc-upload-progress__bar"
        :style="{
          width: `${Math.round(
            (layoutStore.uploadingTiles[tileId] as number) * 100,
          )}%`,
        }"
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
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
} from "vue";
import type { DocumentStackContent as DocumentStackContentType } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import FileIcon from "@/components/icons/FileIcon.vue";
import FolderIcon from "@/components/icons/FolderIcon.vue";
import DocumentPreviewer from "@/components/tilecontent/DocumentPreviewer.vue";
import DocumentDetailsFields from "@/components/tilecontent/DocumentDetailsFields.vue";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import {
  documentItemIsPdf,
  ensureDocumentItemThumbnailOnServer,
} from "@/composables/useDocumentThumbnail";
import { classifyDocumentItem } from "@/utils/documentTypeKind";

const ILLUSTRATION_BY_KIND: Record<string, string> = {
  pdf: "/illustrations/file-pdf.png",
  docx: "/illustrations/file-docx.png",
  doc: "/illustrations/file-docx.png",
  md: "/illustrations/file-md.png",
  txt: "/illustrations/file-txt.png",
};
// Fallback for any unrecognized file type (matches the most generic-looking sketch).
const ILLUSTRATION_FALLBACK = "/illustrations/file-txt.png";

export default defineComponent({
  name: "DocumentStackContent",
  components: { FileIcon, FolderIcon, DocumentPreviewer, DocumentDetailsFields },
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
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);

    const { backgroundColor, textColor, overlayColor, handleBackgroundColorChange } =
      useColorPicker(props.tileId, props.content, emit, "background");

    const items = computed(() => props.content.items ?? []);
    const primary = computed(() => items.value[0]);

    const isUploading = computed(() => {
      const p = layoutStore.uploadingTiles[props.tileId];
      return p !== undefined && p >= 0;
    });

    // ── Sizing flags (mirrors LinkContent's pattern) ──
    const w = computed(() => gridTileW?.value ?? 2);
    const h = computed(() => gridTileH?.value ?? 2);
    const isOneByOne = computed(() => w.value === 1 && h.value === 1);
    const isBanner = computed(() => w.value >= 2 && h.value === 1);
    const isNarrowTall = computed(() => w.value === 1 && h.value > 1);

    // Illustration placement based on tile shape:
    //   1×1 / 2×1        : no illustration (no room)
    //   3×1, 4×1+        : "banner" — vertically-centered, anchored to right edge
    //   1×2, 1×3+        : "narrow-tall" — peeks above the tile (overflows top)
    //   2×2              : "two-right" — right-aligned, vertically centered
    //   2×3, 2×4+        : "two-bottom-right" — bottom-right corner
    //   ≥3 × ≥2          : "standard" — fixed size, anchored to bottom-right
    const showIllustration = computed(() => {
      if (isOneByOne.value) return false;
      if (isBanner.value && w.value < 3) return false;
      return true;
    });
    const illustrationPlacement = computed<
      "banner" | "narrow-tall" | "two-right" | "two-bottom-right" | "standard"
    >(() => {
      if (isBanner.value) return "banner";
      if (isNarrowTall.value) return "narrow-tall";
      if (w.value === 2 && h.value === 2) return "two-right";
      if (w.value === 2 && h.value >= 3) return "two-bottom-right";
      return "standard";
    });

    // Component visibility
    const showInlineDetails = computed(
      () => isBanner.value && w.value >= 2,
    );
    // Bottom details for everything that isn't mini or a banner
    const showBottomDetails = computed(
      () => !isOneByOne.value && !isBanner.value,
    );

    // ── Default text values (used when custom* === undefined) ──
    const defaultTitle = computed(() => {
      const n = items.value.length;
      if (n === 0) return "Document";
      if (n > 1) return "Documents";
      return primary.value?.fileName?.trim() || "Document";
    });
    const defaultDescription = computed(() => {
      const n = items.value.length;
      if (n <= 0) return "";
      return n === 1 ? "1 file" : `${n} files`;
    });

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

    // ── Illustration picker (PNG sketch art per file type) ──
    const illustrationSrc = computed(() => {
      const k = classifyDocumentItem(primary.value);
      return ILLUSTRATION_BY_KIND[k] ?? ILLUSTRATION_FALLBACK;
    });

    // ── Editing state (mirrors LinkContent exactly) ──
    const isEditing = ref(false);
    const isDetailsHovered = ref(false);
    const tileRef = ref<HTMLElement | null>(null);
    const detailsRef = ref<HTMLElement | null>(null);
    const titleInputRef = ref<HTMLTextAreaElement | null>(null);
    const descriptionInputRef = ref<HTMLTextAreaElement | null>(null);

    const draftTitle = ref("");
    const draftDescription = ref("");

    const syncDrafts = () => {
      draftTitle.value = displayTitle.value;
      draftDescription.value = displayDescription.value;
    };

    watch(
      [displayTitle, displayDescription],
      () => {
        if (!isEditing.value) syncDrafts();
      },
      { immediate: true },
    );

    const saveEdits = () => {
      if (!layoutStore.canEdit) return;

      const nextTitle = draftTitle.value.trim();
      const nextDescription = draftDescription.value.trim();

      props.content.customTitle = nextTitle;
      props.content.customDescription = nextDescription;

      layoutStore.patchTileContent(props.tileId, {
        customTitle: nextTitle,
        customDescription: nextDescription,
      });
    };

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      saveEdits(),
    );

    watch([draftTitle, draftDescription], () => {
      if (isEditing.value) {
        schedulePersist();
      }
    });

    // ── Previewer ──
    const previewOpen = ref(false);
    const previewStartIndex = ref(0);

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

    const startEditing = (focusTarget?: "title" | "description") => {
      if (!layoutStore.canEdit || isEditing.value) return;
      layoutStore.beginEditing(props.tileId);
      isEditing.value = true;
      syncDrafts();
      nextTick(() => {
        setTimeout(() => {
          const targetRef =
            focusTarget === "description" ? descriptionInputRef : titleInputRef;
          targetRef.value?.focus();
          exitClickHandler = (event: MouseEvent) => {
            if (
              tileRef.value &&
              !tileRef.value.contains(event.target as Node)
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

      const fields = [
        { name: "title" as const, el: el.querySelector(".tile-field--title") },
        {
          name: "description" as const,
          el: el.querySelector(".tile-field--description"),
        },
      ];

      if (!displayTitle.value && !displayDescription.value) {
        startEditing("title");
        return;
      }

      const clickY = event.clientY;
      let closest: "title" | "description" = "title";
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

    // Native @click only handles editing-state cleanup. Opening the previewer
    // is delegated to onShortClick(), which GridTile invokes only when it has
    // confirmed the click is short and not a drag. (Mirrors LinkContent.)
    const onTileClick = (event: MouseEvent) => {
      if (isEditing.value) {
        const target = event.target as HTMLElement;
        if (!target.closest("input, textarea")) {
          stopEditing();
        }
      }
    };

    const onShortClick = (event: MouseEvent) => {
      if (isEditing.value) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest(".tile-details")) return;
      openPreview(event);
    };

    // ── PDF thumbnail backfill (preserve existing behavior) ──
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

    onMounted(() => {
      // Reflect color-picker state up to GridTile so theme background applies.
      handleBackgroundColorChange(props.content.backgroundColor ?? "");
    });

    onUnmounted(() => {
      removeExitClickHandler();
    });

    return {
      layoutStore,
      items,
      isUploading,
      // sizes
      isOneByOne,
      isBanner,
      isNarrowTall,
      showIllustration,
      illustrationPlacement,
      illustrationSrc,
      showInlineDetails,
      showBottomDetails,
      // text
      displayTitle,
      displayDescription,
      draftTitle,
      draftDescription,
      // refs
      tileRef,
      detailsRef,
      titleInputRef,
      descriptionInputRef,
      // state
      isEditing,
      isDetailsHovered,
      // color
      backgroundColor,
      textColor,
      overlayColor,
      handleBackgroundColorChange,
      // previewer
      previewOpen,
      previewStartIndex,
      closePreview,
      // events
      onDetailsClick,
      onTileClick,
      onShortClick,
      startEditing,
    };
  },
});
</script>

<style scoped>
.doc-tile-content {
  position: relative;
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  isolation: isolate;
  cursor: pointer;
}

/* Narrow-tall tiles let the illustration peek above the tile.
   We drop overflow:hidden here and rely on the color overlay's
   own border-radius to keep the rounded corners intact. */
.doc-tile-content.is-narrow-tall {
  overflow: visible;
}

.doc-color-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  mix-blend-mode: color;
  pointer-events: none;
}

.doc-tile-content.is-narrow-tall .doc-color-overlay {
  border-radius: inherit;
}

/* ── Foreground layout ────────────────────────────── */

.doc-foreground {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: var(--spacing-md);
  pointer-events: none;
}

.doc-tile-content.is-banner .doc-foreground {
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
}

.doc-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  pointer-events: none;
}

.doc-tile-content.is-banner .doc-header {
  flex: 1;
  min-width: 0;
  align-items: center;
  pointer-events: auto;
}

/* ── Logo (icon) ───────────────────────────────────── */

.tile-logo {
  flex: 0 0 auto;
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0e0f12;
  pointer-events: none;
}

.doc-tile-logo-icon {
  width: 24px;
  height: 24px;
}

.doc-tile-content.is-mini .doc-foreground {
  align-items: center;
  justify-content: center;
}

.doc-tile-content.is-mini .doc-header {
  justify-content: center;
}

/* ── Illustration ──────────────────────────────────── */

/* Same illustration size on every variant — only the position differs.
   Tile bounds naturally clip the illustration when it doesn't fit. */
.doc-art {
  position: absolute;
  pointer-events: none;
  z-index: 1;
  width: 154px;
  height: 190px;
}

.doc-art__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

/* Banner (3×1+): vertically centered, anchored to right edge.
   The illustration overflows top/bottom of the banner and is clipped. */
.doc-art--banner {
  top: 50%;
  right: -87px;
  transform: translateY(-23%);
}

/* 2×2 (illustration_on_right): right-aligned, vertically centered.
   The illustration clips against the right edge and peeks above. */
.doc-art--two-right {
  bottom: -10px;
  right: -82px;
  /* transform: translateY(-43%); */
}

/* 2×3+ (illustration_on_bottomRight): anchored to bottom-right corner. */
.doc-art--two-bottom-right {
  right: -82px;
  bottom: -10px;
}

/* Standard (≥3 × ≥2): anchored to bottom-right with a small overflow.
   On smaller tiles the right/bottom edges clip naturally. */
.doc-art--standard {
  right: 21px;
  bottom: -16px;
}

/* Narrow-tall (1 × ≥2): centered horizontally, peeks above the tile.
   The illustration sits BEHIND the tile — only the portion above the
   tile's top edge is visible. We achieve this with clip-path so the
   in-tile portion is hidden, while the surrounding tile-wrapper opts
   into overflow:visible (see the unscoped :has rule below). */
.doc-art--narrow-tall {
  top: -52px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 124px;
  /* Hide everything from the tile's top edge downward (the bottom 72px
     of the 124px illustration). Only the top 52px shows above the tile. */
  clip-path: inset(0 0 72px 0);
}

/* ── Details (mirrors LinkContent visuals) ─────────── */

.doc-details {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
  padding: 2px;
  overflow: hidden;
  min-height: 0;
}

.doc-details--inline {
  flex: 1;
  min-width: 0;
  width: calc(100% + 16px);
  margin-left: -8px;
  margin-right: -8px;
}

.doc-details--bottom {
  margin-top: auto;
  width: calc(100% + 16px);
  margin-left: -8px;
  margin-bottom: -4px;
}

.doc-tile-content.is-owner .doc-details {
  cursor: text;
}

.doc-details.is-hovered {
  background-color: color-mix(
    in srgb,
    transparent 45%,
    color-mix(in srgb, var(--tile-bg) 82%, var(--tile-text-color) 3%) 65%
  );
}

.doc-details.is-editing {
  background-color: var(--tile-bg);
  border-color: transparent;
}

.doc-details.additional-top-padding {
  padding-top: 4px;
}

.tile-details-placeholder {
  color: var(--tile-text-color);
  opacity: 0.5;
  padding: 6px 6px;
  margin-top: -4px;
  transition: opacity 0.2s ease;
}

/* ── Upload progress ──────────────────────────────── */

.doc-upload-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  z-index: 4;
  pointer-events: none;
}

.doc-upload-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #6ea8fe, #9b7bff);
  transition: width 0.2s ease;
}
</style>

<!--
  Unscoped: let the surrounding GridTile wrapper expose overflow above the
  tile bounds when this is a narrow-tall (1 × ≥2) document tile so the file
  illustration can peek above the tile. All other tile shapes keep the
  default overflow:hidden clipping.
-->
<style>
.tile-wrapper:has(.doc-tile-content.is-narrow-tall) {
  overflow: visible;
}
</style>

