<!--
  MobileAppBar.vue

  Mobile 2.0 top app bar: [GridMenu hamburger] [editable Grid Name] … [Undo].
  Replaces the desktop top-bar (title editor) + floating undo on mobile. Emits
  `open-menu` so the shell can open the MobileMenuDrawer.
-->
<template>
  <header class="mobile-app-bar">
    <div class="mobile-app-bar__left">
      <button
        type="button"
        class="mab-btn"
        aria-label="Open menu"
        @click="emit('open-menu')"
      >
        <MenuIcon :size="24" />
      </button>

      <h1
        ref="titleRef"
        class="mab-title"
        :class="{ 'mab-title--readonly': !canEdit }"
        :contenteditable="canEdit"
        spellcheck="false"
        data-placeholder="Grid Name"
        @blur="saveName"
        @keydown.enter.prevent="blurOnEnter"
      >
        {{ editableName }}
      </h1>
    </div>

    <button
      type="button"
      class="mab-btn"
      aria-label="Undo"
      :disabled="!historyStore.canUndo"
      @click="controller.undo()"
    >
      <UndoIcon :size="24" />
    </button>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridController } from "@/controllers/useGridController";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import UndoIcon from "@/components/icons/UndoIcon.vue";

const emit = defineEmits<{ (e: "open-menu"): void }>();

const sessionStore = useGridSessionStore();
const viewportStore = useGridViewportStore();
const historyStore = useGridHistoryStore();
const controller = useGridController();

const titleRef = ref<HTMLElement | null>(null);
const editableName = ref(sessionStore.currentGrid?.name || "");

const canEdit = computed(() =>
  sessionStore.canEditAtBreakpoint(
    viewportStore.forcedBreakpoint,
    viewportStore.viewportBreakpoint,
  ),
);

watch(
  () => sessionStore.currentGrid?.name,
  (name) => {
    editableName.value = name || "";
  },
);

const saveName = (event: FocusEvent) => {
  if (!canEdit.value) return;
  const newName = (event.target as HTMLElement).innerText.trim();
  if (sessionStore.currentGrid && newName !== sessionStore.currentGrid.name) {
    controller.renameCurrentGrid(newName);
    editableName.value = newName;
  }
};

const blurOnEnter = (event: KeyboardEvent) => {
  if (!canEdit.value) return;
  (event.target as HTMLElement).blur();
};
</script>

<style lang="scss" scoped>
.mobile-app-bar {
  position: fixed;
  top: var(--app-status-banners-height, 0px);
  left: 0;
  right: 0;
  z-index: var(--z-topbar);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-toolbar-background);
  border-bottom: var(--border-width) solid var(--color-stroke);
  border-bottom-left-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
  backdrop-filter: blur(20px);
}

.mobile-app-bar__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.mab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
  line-height: 0;
  transition:
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);

  &:hover:not(:disabled) {
    background: var(--color-base-8);
    color: var(--color-text-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.mab-title {
  min-width: 0;
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  outline: none;
  border-radius: var(--radius-sm);
  cursor: text;

  &:focus {
    background: var(--color-base-8);
  }

  &.mab-title--readonly {
    cursor: default;
  }

  &:empty::before {
    content: attr(data-placeholder);
    color: var(--color-content-low);
  }
}
</style>
