<template>
  <div
    class="document-stack-tile"
    :class="{
      'is-owner': layoutStore.canEdit,
      'is-uploading': isUploading,
      'has-multiple': items.length > 1,
    }"
    :style="{
      background: backgroundColor,
      color: textColor,
    }"
    @click="onRootClick"
  >
    <div class="doc-stack-visual" aria-hidden="true">
      <div class="doc-stack-layer doc-stack-layer--3"></div>
      <div class="doc-stack-layer doc-stack-layer--2"></div>
      <div class="doc-stack-layer doc-stack-layer--1"></div>
    </div>

    <div class="doc-tile-foreground">
      <div class="doc-tile-header">
        <div class="doc-tile-logo">
          <DocumentTileIcon class="doc-tile-logo-icon" />
        </div>
        <div class="doc-tile-text">
          <p class="doc-tile-title" :style="{ color: textColor }">{{ displayTitle }}</p>
          <p
            v-if="displaySubtitle"
            class="doc-tile-subtitle"
            :style="{ color: textColor, opacity: 0.72 }"
          >{{ displaySubtitle }}</p>
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

    <teleport to="body">
      <Transition name="doc-preview-shell">
        <div
          v-if="previewOpen"
          class="doc-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
          @click.self="closePreview"
        >
          <div
            class="doc-preview-panel"
          >
            <button
              type="button"
              class="doc-preview-close"
              aria-label="Close preview"
              @click="closePreview"
            >
              ×
            </button>
            <button
              v-if="items.length > 1"
              type="button"
              class="doc-preview-nav doc-preview-nav--prev"
              aria-label="Previous document"
              @click.stop="prevDoc"
            >
              ‹
            </button>
            <button
              v-if="items.length > 1"
              type="button"
              class="doc-preview-nav doc-preview-nav--next"
              aria-label="Next document"
              @click.stop="nextDoc"
            >
              ›
            </button>

            <div v-if="loadError" class="doc-preview-error">{{ loadError }}</div>
            <div v-else-if="previewLoading" class="doc-preview-loading">Loading…</div>
            <div v-else class="doc-preview-body">
              <div
                v-if="previewKind === 'pdf'"
                ref="pdfMountRef"
                class="doc-preview-scroll doc-preview-pdf"
              />
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-else-if="previewKind === 'html'" class="doc-preview-scroll doc-preview-html" v-html="htmlContent" />
              <pre
                v-else-if="previewKind === 'text'"
                class="doc-preview-scroll doc-preview-text"
                >{{ textContent }}</pre
              >
              <div v-else class="doc-preview-fallback">
                <p>No in-browser preview for this file type.</p>
                <a
                  v-if="currentPreviewUrl"
                  class="btn btn-primary btn-sm"
                  :href="currentPreviewUrl"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  >Download</a
                >
              </div>
            </div>
            <div v-if="items.length > 1" class="doc-preview-footer">
              {{ previewIndex + 1 }} / {{ items.length }}
            </div>
          </div>
        </div>
      </Transition>
    </teleport>
  </div>
</template>

<script lang="ts">
/* eslint-disable vue/no-mutating-props */
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import type {
  DocumentItem,
  DocumentStackContent as DocumentStackContentType,
} from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import DocumentTileIcon from "@/components/icons/DocumentTileIcon.vue";
import { useColorPicker } from "@/composables/useColorPicker";
import {
  loadDocumentBytes,
  uint8ArrayToArrayBuffer,
} from "@/utils/documentBytes";
import { marked } from "marked";
import DOMPurify from "dompurify";
import mammoth from "mammoth";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function previewKindForItem(item: DocumentItem): "pdf" | "docx" | "doc" | "txt" | "md" | "other" {
  const mime = (item.mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument")
  ) {
    return "docx";
  }
  if (mime.includes("msword")) return "doc";
  if (mime.includes("markdown")) return "md";
  if (mime.includes("text/plain")) return "txt";
  const e = extOf(item.fileName);
  if (e === "pdf") return "pdf";
  if (e === "docx") return "docx";
  if (e === "doc") return "doc";
  if (e === "md") return "md";
  if (e === "txt") return "txt";
  return "other";
}

export default defineComponent({
  name: "DocumentStackContent",
  components: { DocumentTileIcon },
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
    const items = computed(() => props.content.items ?? []);
    const primary = computed(() => items.value[0]);
    const displayTitle = computed(
      () => primary.value?.fileName || "Document",
    );
    const displaySubtitle = computed(() => {
      const n = items.value.length;
      if (n <= 1) {
        const k = primary.value ? previewKindForItem(primary.value) : "other";
        if (k === "pdf") return "PDF";
        if (k === "docx") return "Word";
        if (k === "doc") return "Word (legacy)";
        if (k === "md") return "Markdown";
        if (k === "txt") return "Text";
        return "";
      }
      return `${n} documents`;
    });

    const isUploading = computed(() => {
      const p = layoutStore.uploadingTiles[props.tileId];
      return p !== undefined && p >= 0;
    });

    const previewOpen = ref(false);
    const previewIndex = ref(0);
    const previewLoading = ref(false);
    const loadError = ref("");
    const previewKind = ref<"pdf" | "html" | "text" | "none">("none");
    const htmlContent = ref("");
    const textContent = ref("");
    const pdfMountRef = ref<HTMLElement | null>(null);

    const currentPreviewUrl = computed(
      () => items.value[previewIndex.value]?.url ?? "",
    );

    const openPreview = (event?: MouseEvent) => {
      if (event) {
        const t = event.target as HTMLElement;
        if (t.closest("a, button, input")) return;
      }
      if (!items.value.length) return;
      previewIndex.value = 0;
      previewOpen.value = true;
    };

    const closePreview = () => {
      previewOpen.value = false;
      previewKind.value = "none";
      htmlContent.value = "";
      textContent.value = "";
      loadError.value = "";
      clearPdfMount();
    };

    const clearPdfMount = () => {
      if (pdfMountRef.value) {
        pdfMountRef.value.innerHTML = "";
      }
    };

    const onRootClick = (event: MouseEvent) => {
      openPreview(event);
    };

    const nextDoc = () => {
      if (items.value.length <= 1) return;
      previewIndex.value = (previewIndex.value + 1) % items.value.length;
    };

    const prevDoc = () => {
      if (items.value.length <= 1) return;
      previewIndex.value =
        (previewIndex.value - 1 + items.value.length) % items.value.length;
    };

    const renderPdfBytes = async (bytes: Uint8Array) => {
      clearPdfMount();
      const el = pdfMountRef.value;
      // #region agent log
      fetch("http://127.0.0.1:7798/ingest/9bdcd177-980d-473a-a0d6-90ada5c856d3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "01bea2",
        },
        body: JSON.stringify({
          sessionId: "01bea2",
          runId: "post-fix",
          hypothesisId: "H1",
          location: "DocumentStackContent.vue:renderPdfBytes:mount-check",
          message: "renderPdfBytes mount + byteLength",
          data: { hasEl: !!el, byteLength: bytes.byteLength },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (!el) return;
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

      const copy = new Uint8Array(bytes);
      const loadingTask = pdfjsLib.getDocument({ data: copy });
      try {
        const pdf = await loadingTask.promise;
        // #region agent log
        fetch("http://127.0.0.1:7798/ingest/9bdcd177-980d-473a-a0d6-90ada5c856d3", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "01bea2",
          },
          body: JSON.stringify({
            sessionId: "01bea2",
            runId: "post-fix",
            hypothesisId: "H2",
            location: "DocumentStackContent.vue:renderPdfBytes:getDocument-ok",
            message: "getDocument ok",
            data: { numPages: pdf.numPages },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 1.25 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "doc-pdf-page";
          el.appendChild(canvas);
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }
      } catch (pdfErr) {
        // #region agent log
        fetch("http://127.0.0.1:7798/ingest/9bdcd177-980d-473a-a0d6-90ada5c856d3", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "01bea2",
          },
          body: JSON.stringify({
            sessionId: "01bea2",
            runId: "post-fix",
            hypothesisId: "H2",
            location:
              "DocumentStackContent.vue:renderPdfBytes:getDocument-error",
            message: "getDocument or render failed",
            data: {
              err:
                pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        throw pdfErr;
      }
    };

    const loadCurrentDocument = async () => {
      loadError.value = "";
      previewLoading.value = true;
      previewKind.value = "none";
      htmlContent.value = "";
      textContent.value = "";
      clearPdfMount();
      const item = items.value[previewIndex.value];
      if (!item?.url) {
        previewLoading.value = false;
        loadError.value = "No document URL.";
        return;
      }
      const url = item.url;
      const kind = previewKindForItem(item);
      try {
        if (kind === "doc") {
          previewKind.value = "none";
          loadError.value =
            "Preview isn’t available for .doc files. Download to open in Word.";
          return;
        }
        if (kind === "other") {
          previewKind.value = "none";
          loadError.value = "Unsupported type for preview.";
          return;
        }

        const bytes = await loadDocumentBytes(url);

        if (kind === "pdf") {
          // #region agent log
          fetch("http://127.0.0.1:7798/ingest/9bdcd177-980d-473a-a0d6-90ada5c856d3", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "01bea2",
            },
            body: JSON.stringify({
              sessionId: "01bea2",
              runId: "post-fix",
              hypothesisId: "H1",
              location:
                "DocumentStackContent.vue:loadCurrentDocument:pdf-branch-entry",
              message: "pdf branch entered",
              data: {
                previewLoading: previewLoading.value,
                previewKindBefore: previewKind.value,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          previewKind.value = "pdf";
          previewLoading.value = false;
          await nextTick();
          // #region agent log
          fetch("http://127.0.0.1:7798/ingest/9bdcd177-980d-473a-a0d6-90ada5c856d3", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "01bea2",
            },
            body: JSON.stringify({
              sessionId: "01bea2",
              runId: "post-fix",
              hypothesisId: "H1",
              location:
                "DocumentStackContent.vue:loadCurrentDocument:after-nextTick-pdf",
              message: "after nextTick before renderPdfBytes",
              data: {
                previewLoading: previewLoading.value,
                hasPdfMountRef: !!pdfMountRef.value,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          await renderPdfBytes(bytes);
        } else if (kind === "docx") {
          const result = await mammoth.convertToHtml({
            arrayBuffer: uint8ArrayToArrayBuffer(bytes),
          });
          previewKind.value = "html";
          htmlContent.value = DOMPurify.sanitize(result.value || "");
        } else if (kind === "md") {
          const raw = new TextDecoder().decode(bytes);
          const rawHtml = await marked.parse(raw);
          previewKind.value = "html";
          htmlContent.value = DOMPurify.sanitize(String(rawHtml));
        } else if (kind === "txt") {
          textContent.value = new TextDecoder().decode(bytes);
          previewKind.value = "text";
        }
      } catch (e) {
        console.error(e);
        loadError.value =
          e instanceof Error ? e.message : "Could not load document.";
        previewKind.value = "none";
      } finally {
        previewLoading.value = false;
      }
    };

    watch([previewOpen, previewIndex], () => {
      if (!previewOpen.value) return;
      void loadCurrentDocument();
    });

    const onKey = (e: KeyboardEvent) => {
      if (!previewOpen.value) return;
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowLeft") prevDoc();
      if (e.key === "ArrowRight") nextDoc();
    };

    onMounted(() => {
      window.addEventListener("keydown", onKey);
    });
    onUnmounted(() => {
      window.removeEventListener("keydown", onKey);
    });

    return {
      layoutStore,
      items,
      displayTitle,
      displaySubtitle,
      isUploading,
      previewOpen,
      previewIndex,
      previewLoading,
      loadError,
      previewKind,
      htmlContent,
      textContent,
      pdfMountRef,
      currentPreviewUrl,
      onRootClick,
      closePreview,
      nextDoc,
      prevDoc,
      backgroundColor,
      textColor,
      handleBackgroundColorChange,
    };
  },
});
</script>

<style scoped>
.document-stack-tile {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
}

.doc-stack-visual {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.doc-stack-layer {
  position: absolute;
  left: 10%;
  right: 10%;
  top: 12%;
  bottom: 18%;
  border-radius: 10px;
  background: var(--color-content-background, rgba(40, 40, 52, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  transform-origin: center bottom;
  transition:
    transform 0.35s ease,
    opacity 0.35s ease;
}

.document-stack-tile.has-multiple .doc-stack-layer--3 {
  transform: rotate(-5deg) translate(-4px, 6px) scale(0.94);
  opacity: 0.45;
  animation: doc-stack-drift-a 7s ease-in-out infinite;
}

.document-stack-tile.has-multiple .doc-stack-layer--2 {
  transform: rotate(3deg) translate(4px, 3px) scale(0.97);
  opacity: 0.65;
  animation: doc-stack-drift-b 8s ease-in-out infinite;
}

.document-stack-tile.has-multiple .doc-stack-layer--1 {
  transform: rotate(0deg);
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .doc-stack-layer {
    animation: none !important;
  }
}

@keyframes doc-stack-drift-a {
  50% {
    transform: rotate(-4deg) translate(-2px, 4px) scale(0.95);
  }
}

@keyframes doc-stack-drift-b {
  50% {
    transform: rotate(4deg) translate(2px, 2px) scale(0.98);
  }
}

.document-stack-tile:hover.has-multiple .doc-stack-layer--3,
.document-stack-tile:hover.has-multiple .doc-stack-layer--2 {
  opacity: 0.85;
  transform: rotate(0deg) translate(0, 0) scale(1);
}

.doc-tile-foreground {
  position: relative;
  z-index: 2;
  padding: 12px 14px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  pointer-events: none;
}

.doc-tile-header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.doc-tile-logo {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary, #fff);
}

.doc-tile-logo-icon {
  width: 22px;
  height: 22px;
}

.doc-tile-text {
  min-width: 0;
  flex: 1;
}

.doc-tile-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25;
  color: var(--color-text-primary, #fff);
  word-break: break-word;
}

.doc-tile-subtitle {
  margin: 4px 0 0;
  font-size: 0.78rem;
  opacity: 0.72;
  color: var(--color-text-primary, #fff);
}

.doc-upload-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  z-index: 4;
}

.doc-upload-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #6ea8fe, #9b7bff);
  transition: width 0.2s ease;
}

.doc-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  padding: 0;
}

.doc-preview-panel {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border-radius: 0;
  background: var(--color-tile-background, #1a1a22);
  box-shadow: none;
  border: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform-origin: center center;
}

.doc-preview-shell-enter-active,
.doc-preview-shell-leave-active {
  transition: opacity 0.28s ease;
}
.doc-preview-shell-enter-from,
.doc-preview-shell-leave-to {
  opacity: 0;
}

.doc-preview-close {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 3;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.doc-preview-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 28px;
  cursor: pointer;
}

.doc-preview-nav--prev {
  left: 10px;
}
.doc-preview-nav--next {
  right: 10px;
}

.doc-preview-body {
  flex: 1;
  min-height: 0;
  position: relative;
}

.doc-preview-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 52px 56px 40px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.doc-preview-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.doc-preview-pdf {
  text-align: center;
}

.doc-preview-pdf :deep(.doc-pdf-page) {
  display: block;
  margin: 0 auto 16px;
  max-width: 100%;
  height: auto;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
}

.doc-preview-html {
  color: var(--color-text-primary, #eee);
  font-size: 0.95rem;
  line-height: 1.5;
}

.doc-preview-text {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88rem;
  color: var(--color-text-primary, #eee);
  white-space: pre-wrap;
}

.doc-preview-loading,
.doc-preview-error {
  padding: 48px 24px;
  text-align: center;
  color: var(--color-text-primary, #ddd);
}

.doc-preview-fallback {
  padding: 48px 24px;
  text-align: center;
  color: var(--color-text-primary, #ddd);
}

.doc-preview-footer {
  flex: 0 0 auto;
  text-align: center;
  padding: 8px;
  font-size: 0.85rem;
  opacity: 0.75;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
