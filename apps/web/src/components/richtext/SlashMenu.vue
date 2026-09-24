<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="rt-slash-menu scrollable-thin"
      role="listbox"
      aria-label="Insert block"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    >
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        role="option"
        class="rt-slash-menu-item"
        :class="{ active: index === selectedIndex }"
        :aria-selected="index === selectedIndex"
        :data-index="index"
        @mousedown.stop.prevent
        @click.stop.prevent="$emit('select', index)"
      >
        <span class="rt-slash-menu-label">{{ item.label }}</span>
        <span class="rt-slash-menu-hint">{{ item.hint }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { SlashCommand } from "@/utils/richText/slashCommands";
import type { FloatingPosition } from "@/composables/useSlashMenu";

const props = defineProps<{
  visible: boolean;
  items: readonly Pick<SlashCommand, "id" | "label" | "hint">[];
  selectedIndex: number;
  position: FloatingPosition;
}>();

defineEmits<{ select: [index: number] }>();

const menuRef = ref<HTMLElement | null>(null);

// Keep the highlighted item in view while arrowing through a long list.
watch(
  () => props.selectedIndex,
  (index) => {
    void nextTick(() => {
      menuRef.value
        ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
    });
  },
);
</script>

<style scoped>
.rt-slash-menu {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 300px;
  max-height: 240px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  background: var(--color-tile-background);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.rt-slash-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  padding: 8px;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
}

.rt-slash-menu-item:hover,
.rt-slash-menu-item.active {
  background: var(--color-base-55);
}

.rt-slash-menu-hint {
  font-size: 11px;
  opacity: 0.7;
}
</style>
