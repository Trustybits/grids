<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div
    class="doc-tile-content"
    :class="{
      'is-mini': isOneByOne,
      'is-banner': isBanner,
      'is-narrow-tall': isNarrowTall,
      'is-editing': isEditing,
      'is-owner': gridStore.canEdit,
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

    <!-- Single-file illustration (non-narrow-tall placements render in-tile). -->
    <div
      v-if="showIllustration && illustrationPlacement !== 'narrow-tall' && !isMultiFile"
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

    <!-- Multi-file fan stack: 4 illustrations that fan out on hover. -->
    <div
      v-if="showIllustration && illustrationPlacement !== 'narrow-tall' && isMultiFile"
      class="doc-art-stack"
      :class="`doc-art-stack--${illustrationPlacement}`"
      aria-hidden="true"
    >
      <img
        v-for="(src, idx) in stackIllustrationSrcs"
        :key="idx"
        :src="src"
        alt=""
        class="doc-art-stack__card"
        :class="`doc-art-stack__card--${idx}`"
        draggable="false"
      />
    </div>

    <!-- 1×2: teleport illustration to tile-wrapper so it sits BEHIND card-body -->
    <Teleport :to="tileWrapperEl" :disabled="!tileWrapperEl">
      <div
        v-if="showIllustration && illustrationPlacement === 'narrow-tall'"
        class="doc-art-behind"
        aria-hidden="true"
      >
        <img
          :src="illustrationSrc"
          alt=""
          class="doc-art-behind__img"
          draggable="false"
        />
      </div>
    </Teleport>

    <!-- Bottom scrim: gradient + progressive blur behind the details text -->
    <div
      v-if="showScrim"
      class="doc-bottom-scrim"
      :class="{ 'doc-bottom-scrim--banner': isBanner }"
      :style="{ height: scrimHeight + 'px' }"
      aria-hidden="true"
    />

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
        gridStore.uploadingTiles[tileId] !== undefined &&
        gridStore.uploadingTiles[tileId]! >= 0
      "
      class="doc-upload-progress"
    >
      <div
        class="doc-upload-progress__bar"
        :style="{
          width: `${Math.round(
            (gridStore.uploadingTiles[tileId] as number) * 100,
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
import type { DocumentsContent as DocumentsContentType } from "@grids/contracts/types";
import { useGridStore } from "@/stores/grid";
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
import { classifyDocumentItem } from "@/utils/DocumentTypeKind";

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
  name: "DocumentsContent",
  components: { FileIcon, FolderIcon, DocumentPreviewer, DocumentDetailsFields },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => DocumentsContentType,
      required: true,
    },
    tileId: {
      type: String,
      required: true,
    },
  },
  setup(props, { emit }) {
    const gridStore = useGridStore();
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);

    const { backgroundColor, textColor, overlayColor, handleBackgroundColorChange } =
      useColorPicker(props.tileId, props.content, emit, "background");

    const items = computed(() => props.content.items ?? []);
    const primary = computed(() => items.value[0]);

    const isUploading = computed(() => {
      const p = gridStore.uploadingTiles[props.tileId];
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
    //   1×2 only         : "narrow-tall" — slides up from behind tile on hover
    //   1×3+             : no illustration
    //   2×2              : "two-right" — right-aligned, vertically centered
    //   2×3, 2×4+        : "two-bottom-right" — bottom-right corner
    //   ≥3 × ≥2          : "standard" — fixed size, anchored to bottom-right
    const showIllustration = computed(() => {
      if (isOneByOne.value) return false;
      if (isBanner.value && w.value < 3) return false;
      if (w.value === 1 && h.value > 2) return false;
      return true;
    });
    const illustrationPlacement = computed<
      "banner" | "narrow-tall" | "two-right" | "two-bottom-right" | "standard"
    >(() => {
      if (isBanner.value) return "banner";
      if (w.value === 1 && h.value === 2) return "narrow-tall";
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

    // Scrim shows on any tile with an illustration (banners + non-mini non-banner)
    const showScrim = computed(
      () => showIllustration.value && (showBottomDetails.value || showInlineDetails.value),
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

    const isMultiFile = computed(() => items.value.length > 1);

    /** Build an array of 4 illustration URLs for the multi-file fan stack.
     *  - All same type → all 4 identical
     *  - Mixed types → majority type gets more slots; up to 4 distinct types */
    const stackIllustrationSrcs = computed<string[]>(() => {
      const all = items.value;
      if (all.length <= 1) return [];

      const freq = new Map<string, number>();
      for (const item of all) {
        const k = classifyDocumentItem(item);
        const src = ILLUSTRATION_BY_KIND[k] ?? ILLUSTRATION_FALLBACK;
        freq.set(src, (freq.get(src) || 0) + 1);
      }

      const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
      const uniqueSrcs = sorted.map(([src]) => src);

      if (uniqueSrcs.length >= 4) return uniqueSrcs.slice(0, 4);
      if (uniqueSrcs.length === 1) return [uniqueSrcs[0], uniqueSrcs[0], uniqueSrcs[0], uniqueSrcs[0]];

      const result: string[] = [];
      let remaining = 4;
      for (let i = 0; i < sorted.length && remaining > 0; i++) {
        const [src, count] = sorted[i];
        const share = i === sorted.length - 1
          ? remaining
          : Math.max(1, Math.round((count / all.length) * 4));
        const slots = Math.min(share, remaining);
        for (let j = 0; j < slots; j++) result.push(src);
        remaining -= slots;
      }
      while (result.length < 4) result.push(uniqueSrcs[0]);
      return result;
    });

    // ── Teleport target for narrow-tall illustration ──
    const tileWrapperEl = ref<HTMLElement | null>(null);

    // ── Bottom-scrim height (gradient + blur overlay) ──
    const scrimHeight = ref(0);
    let scrimObserver: ResizeObserver | null = null;

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
      if (!gridStore.canEdit) return;

      const nextTitle = draftTitle.value.trim();
      const nextDescription = draftDescription.value.trim();

      props.content.customTitle = nextTitle;
      props.content.customDescription = nextDescription;

      gridStore.patchTileContent(props.tileId, {
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
      gridStore.commitEditing();
      removeExitClickHandler();
      isEditing.value = false;
      nextTick(() => syncDrafts());
    };

    const startEditing = (focusTarget?: "title" | "description") => {
      if (!gridStore.canEdit || isEditing.value) return;
      gridStore.beginEditing(props.tileId);
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
      if (!gridStore.canEdit) return;

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
      const gridId = gridStore.currentGrid?.id;
      if (!gridId || !gridStore.canEdit) return;
      const p = primary.value;
      if (!p || p.thumbnailUrl) return;
      if (!documentItemIsPdf(p.fileName, p.mimeType)) return;
      if (p.url.startsWith("blob:")) return;
      if (requestedThumbIds.value.has(p.id)) return;
      requestedThumbIds.value.add(p.id);
      void ensureDocumentItemThumbnailOnServer(gridId, props.tileId, p.id)
        .then((res) => {
          if (res.thumbnailUrl) {
            gridStore.patchDocumentItem(props.tileId, p.id, {
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
      [primary, () => gridStore.currentGrid?.id, () => gridStore.canEdit],
      () => {
        requestPrimaryPdfThumb();
      },
      { immediate: true },
    );

    const updateScrimHeight = () => {
      const tile = tileRef.value;
      if (!tile || !showScrim.value) {
        scrimHeight.value = 0;
        return;
      }
      if (isBanner.value) {
        scrimHeight.value = tile.getBoundingClientRect().height;
        return;
      }
      const details = detailsRef.value;
      if (!details) {
        scrimHeight.value = 0;
        return;
      }
      const tileRect = tile.getBoundingClientRect();
      const detailsRect = details.getBoundingClientRect();
      scrimHeight.value = Math.max(0, tileRect.bottom - detailsRect.top + 12);
    };

    watch(detailsRef, (el, oldEl) => {
      if (oldEl && scrimObserver) scrimObserver.unobserve(oldEl);
      if (el && scrimObserver) scrimObserver.observe(el);
      nextTick(updateScrimHeight);
    });

    onMounted(() => {
      handleBackgroundColorChange(props.content.backgroundColor ?? "");

      // Find the tile-wrapper ancestor for the narrow-tall teleport target.
      if (tileRef.value) {
        tileWrapperEl.value = tileRef.value.closest(".tile-wrapper") as HTMLElement | null;
      }

      scrimObserver = new ResizeObserver(() => updateScrimHeight());
      if (tileRef.value) scrimObserver.observe(tileRef.value);
      if (detailsRef.value) scrimObserver.observe(detailsRef.value);
    });

    onUnmounted(() => {
      scrimObserver?.disconnect();
      removeExitClickHandler();
    });

    return {
      gridStore,
      items,
      isUploading,
      // sizes
      isOneByOne,
      isBanner,
      isNarrowTall,
      showIllustration,
      illustrationPlacement,
      illustrationSrc,
      isMultiFile,
      stackIllustrationSrcs,
      showInlineDetails,
      showBottomDetails,
      showScrim,
      // text
      displayTitle,
      displayDescription,
      draftTitle,
      draftDescription,
      // refs
      tileRef,
      tileWrapperEl,
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
      // scrim
      scrimHeight,
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

.doc-color-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  mix-blend-mode: color;
  pointer-events: none;
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
  transform: translateY(-23%) translateX(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

/* 2×2 (illustration_on_right): right-aligned, vertically centered.
   The illustration clips against the right edge and peeks above. */
.doc-art--two-right {
  bottom: -10px;
  right: -82px;
  transform: translateX(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

/* 2×3+ (illustration_on_bottomRight): anchored to bottom-right corner. */
.doc-art--two-bottom-right {
  right: -82px;
  bottom: -10px;
  transform: translateX(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

/* Hover: slide illustration left 30px with spring easing */
.doc-tile-content:hover .doc-art--banner {
  transform: translateY(-23%) translateX(-30px);
}

.doc-tile-content:hover .doc-art--two-right {
  transform: translateX(-30px);
}

.doc-tile-content:hover .doc-art--two-bottom-right {
  transform: translateX(-30px);
}

/* Standard (≥3 × ≥2): anchored to bottom-right with a small overflow.
   On smaller tiles the right/bottom edges clip naturally. */
.doc-art--standard {
  right: 21px;
  bottom: -35px;
  transform: translateY(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

.doc-tile-content:hover .doc-art--standard {
  transform: translateY(-24px);
}

/* ── Multi-file fan stack ─────────────────────────── */

/* Container inherits placement from the same modifier classes as single-file. */
.doc-art-stack {
  position: absolute;
  pointer-events: none;
  z-index: 1;
  width: 191px;
  height: 193px;
}

/* Placement modifiers — same anchors as single-file. */
.doc-art-stack--banner {
  top: 50%;
  right: -87px;
  transform: translateY(-23%) translateX(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

.doc-art-stack--two-right {
  bottom: -10px;
  right: -82px;
  transform: translateX(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

.doc-art-stack--two-bottom-right {
  right: -82px;
  bottom: -10px;
  transform: translateX(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

.doc-art-stack--standard {
  right: 21px;
  bottom: -35px;
  transform: translateY(0);
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

/* Hover: same slide as single-file per placement. */
.doc-tile-content:hover .doc-art-stack--banner {
  transform: translateY(-23%) translateX(-30px);
}

.doc-tile-content:hover .doc-art-stack--two-right {
  transform: translateX(-30px);
}

.doc-tile-content:hover .doc-art-stack--two-bottom-right {
  transform: translateX(-30px);
}

.doc-tile-content:hover .doc-art-stack--standard {
  transform: translateY(-24px);
}

/* Individual cards: default state — stacked with slight horizontal offset. */
.doc-art-stack__card {
  position: absolute;
  bottom: 0;
  width: 154px;
  height: 190px;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transform-origin: bottom center;
  transition:
    transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1),
    width 800ms cubic-bezier(0.2, 1.4, 0.36, 1),
    height 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

.doc-art-stack__card--0 { left: 22px; z-index: 1; }
.doc-art-stack__card--1 { left: 26px; z-index: 2; }
.doc-art-stack__card--2 { left: 30px; z-index: 3; }
.doc-art-stack__card--3 { left: 34px; z-index: 4; }

/* Hover: fan out with rotation + grow to 170×210. */
.doc-tile-content:hover .doc-art-stack__card {
  width: 170px;
  height: 210px;
}

.doc-tile-content:hover .doc-art-stack__card--0 {
  transform: rotate(-17deg) translateX(-20px);
}

.doc-tile-content:hover .doc-art-stack__card--1 {
  transform: rotate(-10deg) translateX(-8px);
}

.doc-tile-content:hover .doc-art-stack__card--2 {
  transform: rotate(-2deg) translateX(4px);
}

.doc-tile-content:hover .doc-art-stack__card--3 {
  transform: rotate(5deg) translateX(12px);
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

/* ── Bottom scrim (gradient + progressive blur) ───── */

.doc-bottom-scrim {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
  transition: height 0.35s ease;
}

.doc-bottom-scrim::before {
  content: '';
  position: absolute;
  inset: 0;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  mask-image: linear-gradient(to bottom, transparent 0%, black 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 100%);
}

.doc-bottom-scrim::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.6) 43%,
    rgba(0, 0, 0, 0.89) 72%,
    rgba(0, 0, 0, 1) 100%
  );
}

/* Banner variant: very subtle scrim — illustration stays clearly visible */
.doc-bottom-scrim--banner::before {
  backdrop-filter: blur(1.5px);
  -webkit-backdrop-filter: blur(1.5px);
  mask-image: linear-gradient(to right, transparent 40%, black 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 40%, black 100%);
}

.doc-bottom-scrim--banner::after {
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0) 30%,
    rgba(0, 0, 0, 0.12) 55%,
    rgba(0, 0, 0, 0.25) 75%,
    rgba(0, 0, 0, 0.35) 100%
  );
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
  Unscoped: the 1×2 document tile teleports its illustration into the
  tile-wrapper, as a sibling of card-body. This lets it sit visually
  BEHIND the opaque card-body background and slide up above the tile
  on hover — no clipping overrides needed on card-body at all.
-->
<style>
.tile-wrapper[data-tile-w="1"][data-tile-h="2"]:has(.doc-tile-content) {
  position: relative;
  overflow: visible !important;
}

/* Teleported illustration — sibling of .card-body, sits behind it. */
.doc-art-behind {
  position: absolute;
  top: 3px;
  left: 12px;
  width: 52px;
  height: 64px;
  z-index: 0;
  pointer-events: none;
  transition: transform 800ms cubic-bezier(0.2, 1.4, 0.36, 1);
}

.doc-art-behind__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

/* card-body already has z-index via its stacking context (transform);
   ensure it paints above the teleported illustration. */
.tile-wrapper[data-tile-w="1"][data-tile-h="2"]:has(.doc-tile-content) > .card-body {
  z-index: 1;
}

/* Hover: slide illustration up 26px so it peeks above the tile. */
.tile-wrapper[data-tile-w="1"][data-tile-h="2"]:hover > .doc-art-behind {
  transform: translateY(-26px);
}
</style>

