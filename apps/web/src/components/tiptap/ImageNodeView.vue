<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/vue-3";
import AlignLeftIcon from "@/components/icons/toolbar/AlignLeftIcon.vue";
import AlignCenterIcon from "@/components/icons/toolbar/AlignCenterIcon.vue";
import AlignRightIcon from "@/components/icons/toolbar/AlignRightIcon.vue";

const props = defineProps<NodeViewProps>();

const imageRef = ref<HTMLImageElement>();
const resizing = ref(false);
const localWidth = ref<number | null>(
  props.node.attrs.width ? parseInt(props.node.attrs.width) : null,
);

const align = computed(() => props.node.attrs.align || "center");

const imageStyle = computed(() => {
  const w = localWidth.value;
  if (w) return { width: `${w}px`, height: "auto" };
  return { maxWidth: "100%", height: "auto" };
});

const wrapperAlign = computed(() => {
  switch (align.value) {
    case "left":
      return "left" as const;
    case "right":
      return "right" as const;
    default:
      return "center" as const;
  }
});

function setAlign(value: string) {
  props.updateAttributes({ align: value });
}

let startX = 0;
let startWidth = 0;

function startResize(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  resizing.value = true;
  startX = event.clientX;
  const img = imageRef.value;
  if (img) startWidth = img.offsetWidth;
  document.addEventListener("mousemove", onResize);
  document.addEventListener("mouseup", stopResize);
}

function onResize(event: MouseEvent) {
  const dx = event.clientX - startX;
  localWidth.value = Math.max(48, startWidth + dx);
}

function stopResize() {
  resizing.value = false;
  document.removeEventListener("mousemove", onResize);
  document.removeEventListener("mouseup", stopResize);
  if (localWidth.value) {
    props.updateAttributes({ width: `${localWidth.value}` });
  }
}

onUnmounted(() => {
  document.removeEventListener("mousemove", onResize);
  document.removeEventListener("mouseup", stopResize);
});

const alignOptions = [
  { value: "left", label: "Align left" },
  { value: "center", label: "Align center" },
  { value: "right", label: "Align right" },
] as const;
</script>

<template>
  <NodeViewWrapper
    class="image-node-view"
    :style="{ textAlign: wrapperAlign }"
  >
    <div
      class="image-wrap"
      :class="{ 'is-selected': selected, 'is-resizing': resizing }"
    >
      <img
        ref="imageRef"
        :src="node.attrs.src"
        :alt="node.attrs.alt || ''"
        :style="imageStyle"
        draggable="false"
      />

      <!-- alignment toolbar -->
      <div v-if="selected && editor?.isEditable" class="img-toolbar">
        <button
          v-for="opt in alignOptions"
          :key="opt.value"
          :title="opt.label"
          :class="{ active: align === opt.value }"
          @mousedown.prevent.stop="setAlign(opt.value)"
        >
          <AlignLeftIcon v-if="opt.value === 'left'" :size="16" />
          <AlignCenterIcon v-else-if="opt.value === 'center'" :size="16" />
          <AlignRightIcon v-else :size="16" />
        </button>
      </div>

      <!-- resize handle -->
      <div
        v-if="selected && editor?.isEditable"
        class="img-resize-handle"
        @mousedown="startResize"
      />
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.image-node-view {
  display: block;
  width: 100%;
  line-height: 0;
  padding: 4px 0;
}

.image-wrap {
  display: inline-block;
  position: relative;
  line-height: 0;
  border-radius: var(--radius-sm, 6px);
  outline: 2px solid transparent;
  transition: outline 0.15s ease;
}

.image-wrap.is-selected {
  outline-color: rgba(100, 150, 255, 0.55);
}

.image-wrap img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm, 6px);
  user-select: none;
  pointer-events: none;
}

/* ── alignment toolbar ── */
.img-toolbar {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  padding: 4px;
  background: rgba(24, 24, 24, 0.92);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  z-index: 10;
}

.img-toolbar button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.img-toolbar button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.img-toolbar button.active {
  background: rgba(100, 150, 255, 0.22);
  color: #6496ff;
}

/* ── resize handle ── */
.img-resize-handle {
  position: absolute;
  bottom: -5px;
  right: -5px;
  width: 12px;
  height: 12px;
  background: rgba(100, 150, 255, 0.85);
  border: 2px solid rgba(24, 24, 24, 0.95);
  border-radius: 3px;
  cursor: nwse-resize;
  z-index: 10;
}

.img-resize-handle:hover {
  background: #6496ff;
}
</style>
