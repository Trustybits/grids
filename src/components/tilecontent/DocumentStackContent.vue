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

    <DocumentPreviewer
      v-model:open="previewOpen"
      :items="items"
      :start-index="previewStartIndex"
      @close="closePreview"
    />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from "vue";
import type {
  DocumentItem,
  DocumentStackContent as DocumentStackContentType,
} from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";
import DocumentTileIcon from "@/components/icons/DocumentTileIcon.vue";
import DocumentPreviewer from "@/components/tilecontent/DocumentPreviewer.vue";
import { useColorPicker } from "@/composables/useColorPicker";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function previewKindForItem(
  item: DocumentItem,
): "pdf" | "docx" | "doc" | "txt" | "md" | "other" {
  const mime = (item.mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || mime.includes("officedocument")) {
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
    const previewStartIndex = ref(0);

    const openPreview = (event?: MouseEvent) => {
      if (event) {
        const t = event.target as HTMLElement;
        if (t.closest("a, button, input")) return;
      }
      if (!items.value.length) return;
      previewStartIndex.value = 0;
      previewOpen.value = true;
    };

    const closePreview = () => {
      previewOpen.value = false;
    };

    const onRootClick = (event: MouseEvent) => {
      openPreview(event);
    };

    return {
      layoutStore,
      items,
      displayTitle,
      displaySubtitle,
      isUploading,
      previewOpen,
      previewStartIndex,
      onRootClick,
      closePreview,
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
</style>
