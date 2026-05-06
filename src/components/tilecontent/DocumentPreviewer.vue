<template>
  <teleport to="body">
    <Transition name="doc-prev-shell">
      <div
        v-if="open"
        class="doc-prev-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Document preview"
        @click.self="close"
      >
        <aside class="doc-prev-side" aria-label="Document navigation">
          <header class="doc-prev-side-header">{{ currentFileName }}</header>
          <div ref="sideBodyRef" class="doc-prev-side-body">
            <div v-if="kind === 'pdf'" class="doc-prev-thumbs">
              <button
                v-for="n in pdfPageCount"
                :key="n"
                type="button"
                class="doc-prev-thumb"
                :class="{ 'is-active': activePage === n }"
                :aria-label="`Go to page ${n}`"
                :aria-current="activePage === n ? 'page' : undefined"
                @click="scrollToPage(n)"
              >
                <canvas
                  :ref="(el) => setThumbCanvas(n, el as HTMLCanvasElement | null)"
                  class="doc-prev-thumb-canvas"
                />
              </button>
            </div>
            <ul v-else-if="outline.length" class="doc-prev-outline">
              <li
                v-for="entry in outline"
                :key="entry.id"
                class="doc-prev-outline-item"
                :class="[`is-level-${entry.level}`, { 'is-active': activeOutlineId === entry.id }]"
              >
                <button
                  type="button"
                  class="doc-prev-outline-btn"
                  @click="scrollToOutline(entry.id)"
                >
                  {{ entry.text }}
                </button>
              </li>
            </ul>
            <div v-else class="doc-prev-side-empty" aria-hidden="true" />
          </div>
          <footer class="doc-prev-side-footer">{{ sideSummary }}</footer>
        </aside>

        <div class="doc-prev-main">
          <header class="doc-prev-toolbar">
            <div class="doc-prev-toolbar-section doc-prev-toolbar-section--left">
              <div class="doc-prev-doctype" :title="kindLabel">
                <DocumentTileIcon :size="22" />
              </div>
            </div>
            <div class="doc-prev-toolbar-section doc-prev-toolbar-section--center">
              <p class="doc-prev-doc-name" :title="currentFileName">
                {{ currentFileName }}
              </p>
            </div>
            <div class="doc-prev-toolbar-section doc-prev-toolbar-section--right">
              <button
                v-if="kind === 'pdf'"
                type="button"
                class="doc-prev-spread-toggle"
                :class="{ 'is-active': spread === 2 }"
                :aria-pressed="spread === 2"
                aria-label="Two-page spread"
                @click="toggleSpread"
              >
                <TwoPageIcon :width="37" :height="20" />
              </button>
              <div v-if="kind === 'pdf'" class="doc-prev-zoom-wrap">
                <button
                  ref="zoomBtnRef"
                  type="button"
                  class="doc-prev-zoom-btn"
                  :aria-expanded="zoomMenuOpen"
                  aria-haspopup="menu"
                  @click="toggleZoomMenu"
                >
                  {{ zoomPercent }}%
                </button>
                <div
                  v-if="zoomMenuOpen"
                  class="doc-prev-zoom-menu"
                  role="menu"
                  @click.stop
                >
                  <button type="button" class="doc-prev-zoom-row" role="menuitem" @click="zoomIn">
                    <span>zoom in</span><kbd>Ctrl++</kbd>
                  </button>
                  <button type="button" class="doc-prev-zoom-row" role="menuitem" @click="zoomOut">
                    <span>zoom out</span><kbd>Ctrl+-</kbd>
                  </button>
                  <button type="button" class="doc-prev-zoom-row" role="menuitem" @click="zoomToFit">
                    <span>zoom to fit</span><kbd>Shift+1</kbd>
                  </button>
                  <button type="button" class="doc-prev-zoom-row" role="menuitem" @click="zoomTo100">
                    <span>zoom to 100%</span><kbd>Ctrl+0</kbd>
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="doc-prev-close"
                aria-label="Close preview"
                @click="close"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          <div class="doc-prev-carousel">
            <button
              v-if="items.length > 1"
              type="button"
              class="doc-prev-nav doc-prev-nav--prev"
              aria-label="Previous document"
              @click="prevDoc"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6L9 12L15 18" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <div ref="stageRef" class="doc-prev-stage">
              <div v-if="loadError" class="doc-prev-message">{{ loadError }}</div>
              <div v-else-if="loading" class="doc-prev-message">Loading…</div>
              <div
                v-else-if="kind === 'pdf'"
                ref="pdfMountRef"
                class="doc-prev-scroll doc-prev-pdf"
                :class="{ 'is-spread': spread === 2 }"
              />
              <div
                v-else-if="kind === 'html' && format === 'docx'"
                ref="htmlScrollRef"
                class="doc-prev-scroll doc-prev-page-stage"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <article ref="htmlMountRef" class="doc-prev-page" v-html="htmlContent" />
              </div>
              <div
                v-else-if="kind === 'html'"
                ref="htmlScrollRef"
                class="doc-prev-scroll doc-prev-reader"
              >
                <!-- eslint-disable-next-line vue/no-v-html -->
                <article ref="htmlMountRef" class="doc-prev-reader-body" v-html="htmlContent" />
              </div>
              <div
                v-else-if="kind === 'text'"
                ref="textScrollRef"
                class="doc-prev-scroll doc-prev-reader"
              >
                <pre class="doc-prev-reader-body doc-prev-reader-body--mono">{{ textContent }}</pre>
              </div>
              <div v-else class="doc-prev-fallback">
                <p>No in-browser preview for this file type.</p>
                <a
                  v-if="currentItem?.url"
                  class="btn btn-primary btn-sm"
                  :href="currentItem.url"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  >Download</a
                >
              </div>

              <div
                v-if="items.length > 1"
                class="doc-prev-filechanger"
                role="tablist"
                aria-label="Document files"
              >
                <button
                  v-for="(item, idx) in items"
                  :key="item.id || idx"
                  type="button"
                  role="tab"
                  class="doc-prev-filechanger-tab"
                  :class="{ 'is-active': idx === currentIndex }"
                  :aria-selected="idx === currentIndex"
                  :title="item.fileName"
                  @click="goTo(idx)"
                >
                  <span class="doc-prev-filechanger-icon" aria-hidden="true">
                    <DocumentTileIcon :size="16" />
                  </span>
                  <span class="doc-prev-filechanger-label">{{ idx + 1 }}</span>
                </button>
              </div>
            </div>

            <button
              v-if="items.length > 1"
              type="button"
              class="doc-prev-nav doc-prev-nav--next"
              aria-label="Next document"
              @click="nextDoc"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6L15 12L9 18" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import type { PropType } from "vue";
import type { DocumentItem } from "@/types/TileContent";
import DocumentTileIcon from "@/components/icons/DocumentTileIcon.vue";
import CloseIcon from "@/components/icons/actionbar/CloseIcon.vue";
import TwoPageIcon from "@/components/icons/actionbar/TwoPageIcon.vue";
import {
  loadDocumentBytes,
  uint8ArrayToArrayBuffer,
} from "@/utils/documentBytes";
import { marked } from "marked";
import DOMPurify from "dompurify";
import mammoth from "mammoth";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
// pdfjs-dist's TS types ship with esm bundler resolution edge cases;
// importing the type alone keeps the component lean.
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

type Kind = "pdf" | "html" | "text" | "fallback" | "none";
// Granular format separates the "paper" formats (PDF / DOCX) from the
// "lightweight reader" formats (Markdown / plain text). Different formats
// share a render `kind` (e.g. DOCX and MD both render as `html`) but get
// different presentation: paper formats use a white letter-paper card,
// reader formats use a dark, max-width reader styled like Cursor's MD
// preview.
type Format = "pdf" | "docx" | "md" | "txt" | "doc" | "unknown";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function detectKind(item: DocumentItem | undefined): {
  kind: Kind;
  format: Format;
  label: string;
} {
  if (!item) return { kind: "none", format: "unknown", label: "" };
  const mime = (item.mimeType || "").toLowerCase();
  const e = extOf(item.fileName);
  if (mime.includes("pdf") || e === "pdf")
    return { kind: "pdf", format: "pdf", label: "PDF" };
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument") ||
    e === "docx"
  ) {
    return { kind: "html", format: "docx", label: "Word" };
  }
  if (mime.includes("msword") || e === "doc") {
    return { kind: "fallback", format: "doc", label: "Word" };
  }
  if (mime.includes("markdown") || e === "md") {
    return { kind: "html", format: "md", label: "Markdown" };
  }
  if (mime.includes("text/plain") || e === "txt") {
    return { kind: "text", format: "txt", label: "Text" };
  }
  return { kind: "fallback", format: "unknown", label: "Document" };
}

function slugify(text: string, idx: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `doc-prev-h-${idx}-${base || "section"}`;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1;
// 100% zoom = render the doc at its native page size in CSS pixels
// (PDFs report sizes in points where 1pt = 1 CSS px in pdfjs viewports).
// US Letter at 72 DPI = 612 wide; used as the fit-baseline width for
// PDFs whose native page size we don't know yet, and as the rendered
// page width for non-PDF formats (DOCX / Markdown / plain text).
const LETTER_PAGE_WIDTH = 612;
const THUMB_WIDTH = 120;
// Horizontal breathing room reserved on either side of the rendered doc when
// computing fit-to-stage zoom — keeps the page off the carousel chevrons.
const STAGE_SIDE_PADDING = 64;
// Gap between two pages when 2-up spread is active.
const SPREAD_GAP = 16;

export default defineComponent({
  name: "DocumentPreviewer",
  components: { DocumentTileIcon, CloseIcon, TwoPageIcon },
  props: {
    items: {
      type: Array as PropType<DocumentItem[]>,
      required: true,
    },
    open: {
      type: Boolean,
      default: false,
    },
    startIndex: {
      type: Number,
      default: 0,
    },
  },
  emits: ["close", "update:open"],
  setup(props, { emit }) {
    const currentIndex = ref(props.startIndex || 0);
    const kind = ref<Kind>("none");
    const format = ref<Format>("unknown");
    const kindLabel = ref("");
    const htmlContent = ref("");
    const textContent = ref("");
    const loading = ref(false);
    const loadError = ref("");

    const zoom = ref(ZOOM_DEFAULT);
    const spread = ref<1 | 2>(1);
    const zoomMenuOpen = ref(false);

    // Plain (non-reactive) handle to the pdfjs document. pdfjs internals
    // use `#private` fields which throw "Cannot read from private field"
    // when accessed through a Vue Proxy, so this MUST stay un-reactive.
    let pdfDoc: PDFDocumentProxy | null = null;
    let nativePageWidth = LETTER_PAGE_WIDTH;
    const pdfPageCount = ref(0);
    const activePage = ref(1);

    const outline = ref<{ id: string; text: string; level: number }[]>([]);
    const activeOutlineId = ref<string | null>(null);

    const pdfMountRef = ref<HTMLElement | null>(null);
    const htmlMountRef = ref<HTMLElement | null>(null);
    const htmlScrollRef = ref<HTMLElement | null>(null);
    const textScrollRef = ref<HTMLElement | null>(null);
    const stageRef = ref<HTMLElement | null>(null);
    const sideBodyRef = ref<HTMLElement | null>(null);
    const zoomBtnRef = ref<HTMLElement | null>(null);
    const thumbCanvases = new Map<number, HTMLCanvasElement>();
    let pageObserver: IntersectionObserver | null = null;
    let outlineObserver: IntersectionObserver | null = null;
    let pdfRenderToken = 0;
    let pdfLoadToken = 0;

    const currentItem = computed(() => props.items[currentIndex.value]);
    const currentFileName = computed(
      () => currentItem.value?.fileName || "Document",
    );
    const zoomPercent = computed(() => Math.round(zoom.value * 100));
    const sideSummary = computed(() => {
      if (kind.value === "pdf" && pdfPageCount.value > 0) {
        return `${activePage.value} / ${pdfPageCount.value} pages`;
      }
      if (outline.value.length) {
        return `${outline.value.length} sections`;
      }
      return "";
    });

    const setThumbCanvas = (
      pageNum: number,
      el: HTMLCanvasElement | null,
    ) => {
      if (el) {
        thumbCanvases.set(pageNum, el);
        void renderThumbnail(pageNum);
      } else {
        thumbCanvases.delete(pageNum);
      }
    };

    const close = () => {
      zoomMenuOpen.value = false;
      emit("update:open", false);
      emit("close");
    };

    const nextDoc = () => {
      if (props.items.length <= 1) return;
      currentIndex.value = (currentIndex.value + 1) % props.items.length;
    };

    const prevDoc = () => {
      if (props.items.length <= 1) return;
      currentIndex.value =
        (currentIndex.value - 1 + props.items.length) % props.items.length;
    };

    const goTo = (idx: number) => {
      if (idx < 0 || idx >= props.items.length) return;
      currentIndex.value = idx;
    };

    const teardownObservers = () => {
      pageObserver?.disconnect();
      pageObserver = null;
      outlineObserver?.disconnect();
      outlineObserver = null;
    };

    const teardownPdf = () => {
      pdfRenderToken += 1;
      const doc = pdfDoc;
      pdfDoc = null;
      try {
        doc?.cleanup();
      } catch {
        // pdfjs may throw if cleanup runs while a render is mid-flight
      }
      try {
        void doc?.destroy();
      } catch {
        // ignore destroy errors during teardown
      }
      pdfPageCount.value = 0;
      activePage.value = 1;
      thumbCanvases.clear();
      if (pdfMountRef.value) pdfMountRef.value.innerHTML = "";
    };

    const resetState = () => {
      teardownObservers();
      teardownPdf();
      htmlContent.value = "";
      textContent.value = "";
      loadError.value = "";
      outline.value = [];
      activeOutlineId.value = null;
      kind.value = "none";
      format.value = "unknown";
      zoomMenuOpen.value = false;
      // Default each newly opened doc to 100% single-page view per spec.
      zoom.value = ZOOM_DEFAULT;
      spread.value = 1;
    };

    const renderThumbnail = async (pageNum: number) => {
      const canvas = thumbCanvases.get(pageNum);
      const doc = pdfDoc;
      if (!canvas || !doc) return;
      try {
        const page = await doc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = THUMB_WIDTH / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch {
        // thumbnail failures are non-fatal
      }
    };

    const renderPdfPages = async () => {
      const el = pdfMountRef.value;
      const doc = pdfDoc;
      if (!el || !doc) return;
      const token = ++pdfRenderToken;
      el.innerHTML = "";
      teardownObservers();

      // 100% zoom = native PDF page size (1pt = 1 CSS px in pdfjs viewports).
      // 2-up spread additionally halves the per-page width while preserving aspect.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const spreadFactor = spread.value === 2 ? 0.5 : 1;
      const renderScale = zoom.value * spreadFactor;

      const renderPage = async (pageNum: number, page: PDFPageProxy) => {
        const viewport = page.getViewport({ scale: renderScale });
        const wrapper = document.createElement("div");
        wrapper.className = "doc-prev-pdf-page";
        wrapper.dataset.page = String(pageNum);
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        wrapper.appendChild(canvas);
        el.appendChild(wrapper);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      };

      // Cache the native (zoom=1) width of the first page so zoom-to-fit and
      // 2-up auto-fit can reason about the document's natural size, even if
      // the document is non-letter (e.g. A4 or landscape).
      try {
        const firstPage = await doc.getPage(1);
        if (token !== pdfRenderToken) return;
        const native = firstPage.getViewport({ scale: 1 });
        nativePageWidth = native.width;
      } catch {
        nativePageWidth = LETTER_PAGE_WIDTH;
      }

      for (let p = 1; p <= doc.numPages; p++) {
        if (token !== pdfRenderToken) return;
        const page = await doc.getPage(p);
        if (token !== pdfRenderToken) return;
        await renderPage(p, page);
      }

      if (token !== pdfRenderToken) return;
      attachPageObserver();
    };

    const attachPageObserver = () => {
      const root = pdfMountRef.value;
      if (!root) return;
      const observer = new IntersectionObserver(
        (entries) => {
          let bestRatio = 0;
          let bestPage = activePage.value;
          for (const entry of entries) {
            if (entry.intersectionRatio > bestRatio) {
              bestRatio = entry.intersectionRatio;
              const p = Number(
                (entry.target as HTMLElement).dataset.page || "0",
              );
              if (p > 0) bestPage = p;
            }
          }
          if (bestRatio > 0) activePage.value = bestPage;
        },
        { root, threshold: [0.25, 0.5, 0.75] },
      );
      pageObserver = observer;
      root
        .querySelectorAll(".doc-prev-pdf-page")
        .forEach((el) => observer.observe(el));
    };

    const buildOutline = async () => {
      await nextTick();
      const root = htmlMountRef.value;
      if (!root) return;
      const headings = Array.from(
        root.querySelectorAll("h1, h2, h3"),
      ) as HTMLElement[];
      const built: { id: string; text: string; level: number }[] = [];
      headings.forEach((h, idx) => {
        const text = (h.textContent || "").trim();
        if (!text) return;
        const id = h.id || slugify(text, idx);
        h.id = id;
        const level = Number(h.tagName.slice(1));
        built.push({ id, text, level });
      });
      outline.value = built;
      attachOutlineObserver(headings);
    };

    const attachOutlineObserver = (headings: HTMLElement[]) => {
      const root = htmlScrollRef.value;
      if (!root || !headings.length) return;
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((e) => e.isIntersecting);
          if (visible.length) {
            visible.sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
            );
            activeOutlineId.value = (visible[0].target as HTMLElement).id;
            return;
          }
          // Fallback when no heading is currently in the observation band:
          // pick the last heading whose top is above the viewport top — this
          // keeps a heading "active" while reading through long body content
          // and especially at the very end of the document.
          const rootRect = root.getBoundingClientRect();
          let lastAbove: HTMLElement | null = null;
          for (const h of headings) {
            const r = h.getBoundingClientRect();
            if (r.top - rootRect.top <= rootRect.height * 0.3) lastAbove = h;
            else break;
          }
          if (lastAbove) activeOutlineId.value = lastAbove.id;
        },
        { root, rootMargin: "0px 0px -70% 0px", threshold: [0, 0.01, 0.5] },
      );
      outlineObserver = observer;
      headings.forEach((h) => observer.observe(h));
    };

    const loadCurrent = async () => {
      resetState();
      const item = currentItem.value;
      if (!item?.url) {
        loadError.value = "No document URL.";
        return;
      }
      const detected = detectKind(item);
      kind.value = detected.kind;
      format.value = detected.format;
      kindLabel.value = detected.label;

      if (detected.kind === "fallback") {
        loadError.value = "";
        return;
      }
      if (detected.kind === "none") {
        loadError.value = "Unsupported type for preview.";
        return;
      }

      loading.value = true;
      const token = ++pdfLoadToken;
      try {
        const bytes = await loadDocumentBytes(item.url);
        if (token !== pdfLoadToken) return;

        if (detected.kind === "pdf") {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
          const copy = new Uint8Array(bytes);
          const loadingTask = pdfjsLib.getDocument({ data: copy });
          const doc = await loadingTask.promise;
          if (token !== pdfLoadToken) {
            doc.destroy();
            return;
          }
          pdfDoc = doc;
          pdfPageCount.value = doc.numPages;
          loading.value = false;
          await nextTick();
          await renderPdfPages();
        } else if (detected.kind === "html") {
          let raw: string;
          if (detected.format === "md") {
            const text = new TextDecoder().decode(bytes);
            raw = String(await marked.parse(text));
          } else {
            const result = await mammoth.convertToHtml({
              arrayBuffer: uint8ArrayToArrayBuffer(bytes),
            });
            raw = result.value || "";
          }
          if (token !== pdfLoadToken) return;
          htmlContent.value = DOMPurify.sanitize(raw);
          loading.value = false;
          await buildOutline();
        } else if (detected.kind === "text") {
          textContent.value = new TextDecoder().decode(bytes);
          loading.value = false;
        }
      } catch (e) {
        if (token !== pdfLoadToken) return;
        console.error("[DocumentPreviewer] load failed", e);
        loadError.value =
          e instanceof Error ? e.message : "Could not load document.";
        loading.value = false;
        kind.value = "none";
      }
    };

    const clampZoom = (v: number) =>
      Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(v * 100) / 100));

    const setZoom = (v: number) => {
      zoom.value = clampZoom(v);
    };

    const zoomIn = () => {
      setZoom(zoom.value + ZOOM_STEP);
      zoomMenuOpen.value = false;
    };
    const zoomOut = () => {
      setZoom(zoom.value - ZOOM_STEP);
      zoomMenuOpen.value = false;
    };
    const zoomTo100 = () => {
      setZoom(1);
      zoomMenuOpen.value = false;
    };
    // Width that one page actually occupies on screen at the given zoom,
    // accounting for 2-up spread halving each page.
    const renderedPageWidth = (z: number) =>
      nativePageWidth * z * (spread.value === 2 ? 0.5 : 1);

    const zoomToFit = () => {
      const stage = stageRef.value;
      if (!stage) {
        setZoom(1);
        zoomMenuOpen.value = false;
        return;
      }
      const stageWidth = stage.clientWidth - STAGE_SIDE_PADDING;
      const cols = spread.value === 2 ? 2 : 1;
      const gaps = spread.value === 2 ? SPREAD_GAP : 0;
      const targetPerPage = (stageWidth - gaps) / cols;
      const baseScale = spread.value === 2 ? 0.5 : 1;
      const fit = clampZoom(targetPerPage / (nativePageWidth * baseScale));
      zoom.value = fit;
      zoomMenuOpen.value = false;
    };

    const toggleSpread = () => {
      const next: 1 | 2 = spread.value === 2 ? 1 : 2;
      spread.value = next;
      // When entering 2-up, auto-fit if the current zoom would overflow the
      // stage so the user immediately sees both pages side-by-side.
      if (next === 2 && stageRef.value) {
        const stageWidth = stageRef.value.clientWidth - STAGE_SIDE_PADDING;
        const projected = renderedPageWidth(zoom.value) * 2 + SPREAD_GAP;
        if (projected > stageWidth) {
          const baseScale = 0.5;
          const targetPerPage = (stageWidth - SPREAD_GAP) / 2;
          zoom.value = clampZoom(targetPerPage / (nativePageWidth * baseScale));
        }
      }
    };

    const toggleZoomMenu = () => {
      zoomMenuOpen.value = !zoomMenuOpen.value;
    };

    const scrollToPage = (n: number) => {
      const root = pdfMountRef.value;
      if (!root) return;
      const target = root.querySelector(
        `.doc-prev-pdf-page[data-page="${n}"]`,
      ) as HTMLElement | null;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const scrollToOutline = (id: string) => {
      const root = htmlMountRef.value;
      if (!root) return;
      const el = root.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const onKey = (e: KeyboardEvent) => {
      if (!props.open) return;
      if (e.key === "Escape") {
        close();
        return;
      }
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (inField) return;
      if (e.key === "ArrowLeft") {
        prevDoc();
        return;
      }
      if (e.key === "ArrowRight") {
        nextDoc();
        return;
      }
      if (kind.value !== "pdf") return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        zoomTo100();
      } else if (e.shiftKey && e.key === "1") {
        e.preventDefault();
        zoomToFit();
      }
    };

    const onDocumentClick = (e: MouseEvent) => {
      if (!zoomMenuOpen.value) return;
      const t = e.target as Node;
      const btn = zoomBtnRef.value;
      if (btn && (btn === t || btn.contains(t))) return;
      const menu = (btn?.parentElement || null)?.querySelector(
        ".doc-prev-zoom-menu",
      );
      if (menu && (menu === t || menu.contains(t))) return;
      zoomMenuOpen.value = false;
    };

    watch(
      () => props.open,
      (isOpen) => {
        if (isOpen) {
          currentIndex.value = props.startIndex || 0;
          void loadCurrent();
        } else {
          resetState();
        }
      },
      { immediate: true },
    );

    watch(currentIndex, () => {
      if (!props.open) return;
      void loadCurrent();
    });

    watch([zoom, spread], () => {
      if (kind.value === "pdf") void renderPdfPages();
    });

    onMounted(() => {
      window.addEventListener("keydown", onKey);
      document.addEventListener("click", onDocumentClick, true);
    });

    onUnmounted(() => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocumentClick, true);
      teardownObservers();
      teardownPdf();
    });

    return {
      currentIndex,
      currentItem,
      currentFileName,
      kind,
      format,
      kindLabel,
      htmlContent,
      textContent,
      loading,
      loadError,
      pdfPageCount,
      activePage,
      outline,
      activeOutlineId,
      sideSummary,
      zoom,
      zoomPercent,
      zoomMenuOpen,
      spread,
      pdfMountRef,
      htmlMountRef,
      htmlScrollRef,
      textScrollRef,
      stageRef,
      sideBodyRef,
      zoomBtnRef,
      setThumbCanvas,
      close,
      nextDoc,
      prevDoc,
      goTo,
      toggleSpread,
      toggleZoomMenu,
      zoomIn,
      zoomOut,
      zoomTo100,
      zoomToFit,
      scrollToPage,
      scrollToOutline,
    };
  },
});
</script>

<style scoped>
.doc-prev-backdrop {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: #0e0e10;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  color: var(--color-light-100, #fefdec);
  font-family: var(--font-family-base);
}

.doc-prev-shell-enter-active,
.doc-prev-shell-leave-active {
  transition: opacity 0.28s var(--easing-smooth, ease);
}
.doc-prev-shell-enter-from,
.doc-prev-shell-leave-to {
  opacity: 0;
}

/* ── LeftPanel ───────────────────────────────────────────────── */
.doc-prev-side {
  flex: 0 0 320px;
  min-width: 320px;
  background: #0e0e10;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  padding: 24px 0 16px;
}

.doc-prev-side-header {
  flex: 0 0 auto;
  padding: 0 20px 20px;
  font-size: 0.8rem;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.34);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-prev-side-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 0 20px;
  scrollbar-width: none;
}
.doc-prev-side-body::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.doc-prev-side-footer {
  flex: 0 0 auto;
  padding: 16px 20px 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.34);
  text-align: center;
}

/* PDF thumbnails */
.doc-prev-thumbs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 4px 0 16px;
}
.doc-prev-thumb {
  position: relative;
  display: block;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.18s var(--easing-smooth, ease);
}
.doc-prev-thumb:hover {
  border-color: rgba(211, 189, 255, 0.5);
}
.doc-prev-thumb.is-active {
  border-color: var(--color-purple, #d3bdff);
  box-shadow: 0 0 0 2px rgba(211, 189, 255, 0.25);
}
.doc-prev-thumb-canvas {
  display: block;
  width: 120px;
  height: auto;
  border-radius: 4px;
  background: #fff;
}

/* MD / DOCX / TXT outline (table of contents)
   Styled to match Figma node 1446:16198 — three-state ghost button.
   - h1: 16px Inter Semi Bold, uppercase, 0.8px tracking, 10px padding
   - h2: 14px Inter Semi Bold, 0.7px tracking, 30px left indent
   - hover: white text on --color-light-100-8
   - active: --color-dark-0 text on --color-light-100 (inverted) */
.doc-prev-outline {
  list-style: none;
  margin: 0;
  padding: 4px 0 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.doc-prev-outline-item {
  margin: 0;
}
.doc-prev-outline-btn {
  display: block;
  width: 100%;
  background: var(--color-light-100-0, rgba(255, 255, 255, 0));
  border: none;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  font-weight: var(--font-weight-semibold, 600);
  border-radius: var(--radius-sm, 8px);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  transition:
    color var(--duration-fast, 150ms) var(--easing-smooth, ease),
    background-color var(--duration-fast, 150ms) var(--easing-smooth, ease);
}
.doc-prev-outline-item.is-level-1 .doc-prev-outline-btn {
  padding: 10px;
  font-size: 1rem;
  line-height: 1;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-light-100-55, rgba(255, 255, 255, 0.55));
}
.doc-prev-outline-item.is-level-2 .doc-prev-outline-btn,
.doc-prev-outline-item.is-level-3 .doc-prev-outline-btn {
  padding: 10px 10px 10px 30px;
  font-size: 0.875rem;
  line-height: 1.143;
  letter-spacing: 0.04em;
  color: var(--color-light-100-34, rgba(255, 255, 255, 0.34));
}
.doc-prev-outline-item.is-level-3 .doc-prev-outline-btn {
  padding-left: 50px;
  color: var(--color-light-100-34, rgba(255, 255, 255, 0.34));
}
.doc-prev-outline-btn:hover {
  background: var(--color-light-100-8, rgba(255, 255, 255, 0.08));
  color: var(--color-light-100, #ffffff);
}
.doc-prev-outline-item.is-active .doc-prev-outline-btn {
  background: var(--color-light-100, #ffffff);
  color: var(--color-dark-0, #33312c);
}

.doc-prev-side-empty {
  height: 100%;
}

/* ── Main column ─────────────────────────────────────────────── */
.doc-prev-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #131316;
}

/* Toolbar */
.doc-prev-toolbar {
  flex: 0 0 68px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.doc-prev-toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}
.doc-prev-toolbar-section--left {
  justify-content: flex-start;
}
.doc-prev-toolbar-section--center {
  justify-content: center;
  min-width: 0;
}
.doc-prev-toolbar-section--right {
  justify-content: flex-end;
}

.doc-prev-doctype {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.55);
}

.doc-prev-doc-name {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.55);
  max-width: 60ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Two-page spread toggle — matches Figma node 1417:11686 (ghost button).
   Inactive: transparent + 0.34 icon | Hover: 0.08 bg + 0.76 icon
   Active: 0.08 bg + 1.0 icon. */
.doc-prev-spread-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: none;
  border-radius: var(--radius-sm, 8px);
  background: var(--color-light-100-0, rgba(255, 255, 255, 0));
  color: var(--color-light-100-34, rgba(255, 255, 255, 0.34));
  cursor: pointer;
  transition:
    background-color var(--duration-fast, 150ms) var(--easing-smooth, ease),
    color var(--duration-fast, 150ms) var(--easing-smooth, ease);
}
.doc-prev-spread-toggle:hover {
  background: var(--color-light-100-8, rgba(255, 255, 255, 0.08));
  color: var(--color-light-100-76, rgba(255, 255, 255, 0.76));
}
.doc-prev-spread-toggle.is-active {
  background: var(--color-light-100-8, rgba(255, 255, 255, 0.08));
  color: var(--color-light-100, #ffffff);
}

.doc-prev-zoom-wrap {
  position: relative;
}
.doc-prev-zoom-btn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  min-width: 56px;
  transition: background 0.15s ease, color 0.15s ease;
}
.doc-prev-zoom-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-light-100, #fefdec);
}
.doc-prev-zoom-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 254px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  padding: 6px;
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.doc-prev-zoom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  padding: 9px 10px;
  font-size: 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.12s ease;
}
.doc-prev-zoom-row:hover {
  background: rgba(255, 255, 255, 0.05);
}
.doc-prev-zoom-row kbd {
  font-family: var(--font-family-mono, monospace);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.34);
  background: transparent;
  padding: 0;
}

/* Close button — actionbar CloseIcon styled as a ghost button. */
.doc-prev-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 10px;
  border: none;
  border-radius: var(--radius-sm, 8px);
  background: var(--color-light-100-0, rgba(255, 255, 255, 0));
  color: var(--color-light-100-34, rgba(255, 255, 255, 0.34));
  cursor: pointer;
  margin-left: 4px;
  transition:
    background-color var(--duration-fast, 150ms) var(--easing-smooth, ease),
    color var(--duration-fast, 150ms) var(--easing-smooth, ease);
}
.doc-prev-close:hover {
  background: var(--color-light-100-8, rgba(255, 255, 255, 0.08));
  color: var(--color-light-100-76, rgba(255, 255, 255, 0.76));
}
.doc-prev-close:active {
  color: var(--color-light-100, #ffffff);
}

/* Carousel */
.doc-prev-carousel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  position: relative;
}

.doc-prev-nav {
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.15s ease;
}
.doc-prev-nav:hover {
  color: var(--color-light-100, #fefdec);
}

.doc-prev-stage {
  flex: 1 1 auto;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.doc-prev-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.doc-prev-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
}

/* All file types render onto white "page" cards sized to letter aspect (612 wide).
   For PDFs we center each page; the canvas itself is rendered at the chosen
   zoom. For HTML/text we render onto a single tall card whose width is fixed
   at the letter-paper width. */
.doc-prev-pdf {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-content: flex-start;
  padding: 32px 32px 96px;
  gap: 24px;
  /* TOKEN: letter "page gap" between pages — see notes; uses literal value. */
}
.doc-prev-pdf.is-spread {
  gap: 16px;
}
.doc-prev-pdf :deep(.doc-prev-pdf-page) {
  flex: 0 0 auto;
  background: var(--color-light-100, #ffffff);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  /* TOKEN GAP: Figma uses --radius/tiny: 4px which doesn't exist in tokens.scss.
     Falling back to a literal 4px. */
  border-radius: 4px;
  overflow: hidden;
}
.doc-prev-pdf :deep(.doc-prev-pdf-page canvas) {
  display: block;
  max-width: 100%;
  height: auto;
}

/* HTML / Markdown / DOCX / plain text rendering — every non-PDF document is
   rendered onto a single letter-paper-width white "page" card to mirror the
   PDF rendering and match Figma node 1446:15835 (poc + text variants). */
.doc-prev-page-stage {
  display: flex;
  justify-content: center;
  padding: 32px 32px 96px;
}
.doc-prev-page {
  width: 612px;
  max-width: 100%;
  min-height: 792px;
  background: var(--color-light-100, #ffffff);
  /* TOKEN GAP: Figma uses --radius/tiny: 4px which isn't defined in
     tokens.scss (--radius-sm: 8px is the smallest token). Using a literal
     until a token is added. */
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  padding: 72px 64px;
  /* Tail padding so the IntersectionObserver can mark the last heading
     active even when scrolled to the very bottom of the document. */
  padding-bottom: max(96px, 60vh);
  margin: 0;
  color: var(--color-dark-0, #33312c);
}
.doc-prev-page > :first-child {
  margin-top: 0;
}
.doc-prev-page :deep(h1) {
  font-size: 1.85rem;
  font-weight: var(--font-weight-bold, 700);
  margin: 1.4em 0 0.6em;
  color: var(--color-dark-0, #33312c);
}
.doc-prev-page :deep(h2) {
  font-size: 1.35rem;
  font-weight: var(--font-weight-semibold, 600);
  margin: 1.4em 0 0.5em;
  color: var(--color-dark-0, #33312c);
}
.doc-prev-page :deep(h3) {
  font-size: 1.1rem;
  font-weight: var(--font-weight-semibold, 600);
  margin: 1.2em 0 0.4em;
  color: var(--color-dark-0, #33312c);
}
.doc-prev-page :deep(p),
.doc-prev-page :deep(li) {
  margin: 0 0 0.7em;
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--color-dark-0, #33312c);
}
.doc-prev-page :deep(a) {
  color: #5b3fd0;
  text-decoration: underline;
}
.doc-prev-page :deep(code) {
  background: rgba(51, 49, 44, 0.08);
  padding: 0.1em 0.35em;
  border-radius: 4px;
  font-family: var(--font-family-mono, monospace);
  font-size: 0.9em;
}
.doc-prev-page :deep(pre) {
  background: rgba(51, 49, 44, 0.06);
  padding: 12px 16px;
  border-radius: var(--radius-sm, 8px);
  overflow-x: auto;
}
.doc-prev-page :deep(pre code) {
  background: transparent;
  padding: 0;
}
.doc-prev-page :deep(blockquote) {
  border-left: 2px solid var(--color-purple, #d3bdff);
  padding-left: 14px;
  color: rgba(51, 49, 44, 0.7);
  margin: 0 0 0.8em;
}
.doc-prev-page :deep(img) {
  max-width: 100%;
  height: auto;
}

/* ──────────────────────────────────────────────────────────────
   Reader styles for Markdown / plain text — matches Cursor's MD
   preview: dark theme, max-readable width, viewport-responsive padding.
   No white "paper" card; this is for lightweight text formats that
   weren't authored against paper dimensions.
   ──────────────────────────────────────────────────────────────── */
.doc-prev-reader {
  display: flex;
  justify-content: center;
  padding: clamp(24px, 6vw, 64px) clamp(16px, 5vw, 48px);
  padding-bottom: max(96px, 70vh);
}
.doc-prev-reader-body {
  width: 100%;
  max-width: 720px;
  color: var(--color-light-100, #ffffff);
  font-size: 0.95rem;
  line-height: 1.7;
}
.doc-prev-reader-body > :first-child {
  margin-top: 0;
}
.doc-prev-reader-body :deep(h1) {
  font-size: 1.65rem;
  font-weight: var(--font-weight-bold, 700);
  margin: 1.6em 0 0.55em;
  color: var(--color-light-100, #ffffff);
}
.doc-prev-reader-body :deep(h1:first-child) {
  margin-top: 0;
}
.doc-prev-reader-body :deep(h2) {
  font-size: 1.3rem;
  font-weight: var(--font-weight-semibold, 600);
  margin: 1.6em 0 0.5em;
  color: var(--color-light-100, #ffffff);
}
.doc-prev-reader-body :deep(h3) {
  font-size: 1.1rem;
  font-weight: var(--font-weight-semibold, 600);
  margin: 1.4em 0 0.45em;
  color: var(--color-light-100, #ffffff);
}
.doc-prev-reader-body :deep(h4),
.doc-prev-reader-body :deep(h5),
.doc-prev-reader-body :deep(h6) {
  font-size: 1rem;
  font-weight: var(--font-weight-semibold, 600);
  margin: 1.2em 0 0.4em;
  color: var(--color-light-100, #ffffff);
}
.doc-prev-reader-body :deep(p),
.doc-prev-reader-body :deep(li) {
  margin: 0 0 0.7em;
  color: var(--color-light-100-76, rgba(255, 255, 255, 0.76));
}
.doc-prev-reader-body :deep(ul),
.doc-prev-reader-body :deep(ol) {
  padding-left: 1.4em;
  margin: 0 0 0.9em;
}
.doc-prev-reader-body :deep(a) {
  color: var(--color-purple, #d3bdff);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.doc-prev-reader-body :deep(a:hover) {
  text-decoration-thickness: 2px;
}
.doc-prev-reader-body :deep(code) {
  background: var(--color-light-100-8, rgba(255, 255, 255, 0.08));
  color: var(--color-pink, #ffa8db);
  padding: 0.12em 0.4em;
  border-radius: 4px;
  font-family: var(--font-family-mono, monospace);
  font-size: 0.875em;
}
.doc-prev-reader-body :deep(pre) {
  background: var(--color-light-100-8, rgba(255, 255, 255, 0.08));
  padding: 14px 18px;
  border-radius: var(--radius-sm, 8px);
  overflow-x: auto;
  margin: 0 0 1em;
  font-size: 0.875rem;
  line-height: 1.55;
}
.doc-prev-reader-body :deep(pre code) {
  background: transparent;
  color: var(--color-light-100, #ffffff);
  padding: 0;
  font-size: inherit;
}
.doc-prev-reader-body :deep(blockquote) {
  border-left: 3px solid var(--color-purple, #d3bdff);
  padding: 0 0 0 14px;
  color: var(--color-light-100-55, rgba(255, 255, 255, 0.55));
  margin: 0 0 1em;
  font-style: italic;
}
.doc-prev-reader-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-light-100-8, rgba(255, 255, 255, 0.08));
  margin: 2em 0;
}
.doc-prev-reader-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 1.2em;
  font-size: 0.9rem;
}
.doc-prev-reader-body :deep(th),
.doc-prev-reader-body :deep(td) {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-light-100-8, rgba(255, 255, 255, 0.08));
}
.doc-prev-reader-body :deep(th) {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-light-100, #ffffff);
}
.doc-prev-reader-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm, 8px);
}
.doc-prev-reader-body :deep(strong) {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-light-100, #ffffff);
}

/* Plain-text variant of the reader — monospace, soft wrapping. */
.doc-prev-reader-body--mono {
  font-family: var(--font-family-mono, monospace);
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  color: var(--color-light-100-76, rgba(255, 255, 255, 0.76));
}

.doc-prev-message,
.doc-prev-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  color: rgba(255, 255, 255, 0.65);
  text-align: center;
}

/* File changer strip */
.doc-prev-filechanger {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: rgba(20, 20, 24, 0.85);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 8px 12px;
  z-index: 4;
  max-width: calc(100% - 96px);
  overflow-x: auto;
  scrollbar-width: none;
}
.doc-prev-filechanger::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.doc-prev-filechanger-tab {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.45);
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  min-width: 56px;
  height: 36px;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease,
    border-color 0.15s ease;
}
.doc-prev-filechanger-tab:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.08);
}
.doc-prev-filechanger-tab.is-active {
  background: var(--color-light-100, #fefdec);
  color: #18181b;
  border-color: var(--color-light-100, #fefdec);
  height: 44px;
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
.doc-prev-filechanger-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.doc-prev-filechanger-label {
  display: inline-block;
  min-width: 12px;
  text-align: right;
}

/* Responsive — collapse the side panel on narrow viewports */
@media (max-width: 900px) {
  .doc-prev-side {
    display: none;
  }
  .doc-prev-page-stage {
    padding: 24px 16px 96px;
  }
  .doc-prev-page {
    padding: 48px 32px;
    padding-bottom: max(72px, 60vh);
  }
  .doc-prev-reader {
    padding: 24px 16px;
    padding-bottom: max(96px, 70vh);
  }
}
</style>
