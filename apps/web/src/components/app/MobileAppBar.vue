<!--
  MobileAppBar.vue

  Mobile 2.0 top app bar. Two modes:
    - `grid` (default): [hamburger] [editable Grid Name] … [Undo]
    - `home`:           [hamburger] [static "Your Grids"] … [New Grid]

  Replaces the desktop top-bar (title editor / dashboard header) + floating undo
  on mobile. Emits `open-menu` (open the drawer) and `new-grid` (home mode).
-->
<template>
  <header
    class="mobile-app-bar"
    :class="{ 'mobile-app-bar--hidden': isPreviewActive }"
  >
    <div class="mobile-app-bar__left">
      <button
        v-if="mode === 'grid'"
        type="button"
        class="mab-btn"
        aria-label="Back to your grids"
        @click="goToGrids"
      >
        <ChevronLeftIcon :size="24" />
      </button>

      <button
        type="button"
        class="mab-btn"
        aria-label="Open menu"
        @click="emit('open-menu')"
      >
        <MenuIcon :size="24" />
      </button>

      <h1 v-if="mode === 'home'" class="mab-title mab-title--static">
        Your Grids
      </h1>
      <h1
        v-else
        ref="titleRef"
        class="mab-title"
        :class="{ 'mab-title--readonly': !canEdit }"
        :contenteditable="canEdit"
        spellcheck="false"
        data-placeholder="Grid Name"
        @focus="selectAll"
        @blur="saveName"
        @keydown.enter.prevent="blurOnEnter"
      >
        {{ editableName }}
      </h1>
    </div>

    <!-- Viewport (breakpoint) preview switcher — always visible while editing a
         grid on tablet and desktop widths; hidden on phone where there's no room
         and the preview lives in the command bar instead. -->
    <BreakpointSwitcher
      v-if="mode === 'grid' && showViewportSwitcher"
      variant="toolbar-row"
      class="mab-viewport-switcher"
    />

    <AppButton
      v-if="mode === 'home'"
      variant="secondary"
      size="sm"
      @click="emit('new-grid')"
    >
      New Grid
    </AppButton>
    <button
      v-else
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
import { useRouter } from "vue-router";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridController } from "@/controllers/useGridController";
import { useGridPreview } from "@/composables/useGridPreview";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import UndoIcon from "@/components/icons/UndoIcon.vue";
import ChevronLeftIcon from "@/components/icons/ChevronLeftIcon.vue";
import AppButton from "@/components/ui-elements/Button.vue";
import BreakpointSwitcher from "@/components/grid/ViewControls.vue";

withDefaults(defineProps<{ mode?: "grid" | "home" }>(), { mode: "grid" });

const emit = defineEmits<{
  (e: "open-menu"): void;
  (e: "new-grid"): void;
}>();

const sessionStore = useGridSessionStore();
const viewportStore = useGridViewportStore();
const historyStore = useGridHistoryStore();
const controller = useGridController();
const router = useRouter();
const { isPreviewActive } = useGridPreview();

const titleRef = ref<HTMLElement | null>(null);
const editableName = ref(sessionStore.currentGrid?.name || "");

const canEdit = computed(() =>
  sessionStore.canEditAtBreakpoint(
    viewportStore.forcedBreakpoint,
    viewportStore.viewportBreakpoint,
  ),
);

// The viewport switcher only makes sense for the owner, and only where there's
// room to show it: tablet (`md`) and desktop (`lg`) — never on a phone (`sm`).
const showViewportSwitcher = computed(
  () =>
    sessionStore.isOwner && viewportStore.viewportBreakpoint !== "sm",
);

// Back to the grid-selection dashboard.
const goToGrids = () => {
  void router.push("/dashboard");
};

watch(
  () => sessionStore.currentGrid?.name,
  (name) => {
    editableName.value = name || "";
  },
);

// Select the whole title on focus so a tap-to-edit lets the user immediately
// type a replacement (mirrors the desktop rename modal's select-on-open). Also
// guarantees selection is reachable even where a tap would otherwise just drop
// a caret.
const selectAll = () => {
  const el = titleRef.value;
  if (!el || !canEdit.value) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

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
  transition: transform var(--duration-slow) var(--easing-gentle);
}

// Preview slides the bar up out of view rather than unmounting it, so it travels
// in step with the preview toolbar dropping into the space it leaves. The banner
// offset is subtracted too, or the bar stops short and peeks under them.
.mobile-app-bar--hidden {
  transform: translateY(calc(-100% - var(--app-status-banners-height, 0px)));
  pointer-events: none;
}

.mobile-app-bar__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

// Sits between the title group and the trailing action; never squished — the
// grid title (min-width: 0, ellipsis) absorbs any shortfall instead.
.mab-viewport-switcher {
  flex: 0 0 auto;
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
  /* Text selection must stay enabled here — the grid canvas disables it. */
  user-select: text;
  -webkit-user-select: text;

  &:focus {
    background: var(--color-base-8);
    /* While editing, don't clip: let the caret and selection reach the end. */
    overflow-x: auto;
    text-overflow: clip;
  }

  &.mab-title--readonly {
    cursor: default;
  }

  &.mab-title--static {
    cursor: default;
  }

  &:empty::before {
    content: attr(data-placeholder);
    color: var(--color-content-low);
  }
}
</style>
