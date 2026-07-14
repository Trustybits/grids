<!--
  MobileGridBar.vue

  Mobile 2.0 bottom command pill for grid owners. Built on MobileCommandBar.

  INTERIM WIRING (Phase 2): each command reuses the existing desktop component
  so nothing is lost while the redesigned surfaces are built:
    - Add a tile  → popover hosting the existing GridToolbar   (→ Tile Carousel, Phase 5)
    - Grid menu   → existing GridSettings menu                 (→ Grid Settings sheet, Phase 6)
    - Preview     → popover hosting the existing BreakpointSwitcher (→ Toolbar:Top, Phase 7)
    - Share       → copy grid link                             (→ Share modal, Phase 9)
-->
<template>
  <div ref="rootRef" class="mobile-grid-bar">
    <transition name="mgb-pop">
      <div v-if="openPanel" class="mobile-grid-bar__popover">
        <GridToolbar v-if="openPanel === 'add'" />
        <BreakpointSwitcher
          v-else-if="openPanel === 'preview'"
          variant="toolbar-row"
        />
      </div>
    </transition>

    <MobileCommandBar aria-label="Grid commands">
      <button
        type="button"
        class="mgb-btn"
        :class="{ 'is-active': openPanel === 'add' }"
        aria-label="Add a tile"
        @click.stop="togglePanel('add')"
      >
        <PlusIcon :size="24" />
      </button>

      <span class="mgb-settings">
        <GridSettings />
      </span>

      <button
        type="button"
        class="mgb-btn"
        :class="{ 'is-active': openPanel === 'preview' }"
        aria-label="Preview"
        @click.stop="togglePanel('preview')"
      >
        <EyeIcon :size="24" />
      </button>

      <template #end>
        <button
          type="button"
          class="mgb-btn"
          aria-label="Share"
          @click.stop="shareLink"
        >
          <ShareIcon :size="24" />
        </button>
      </template>
    </MobileCommandBar>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import MobileCommandBar from "@/components/ui-collections/MobileCommandBar.vue";
import GridToolbar from "@/components/grid/GridToolbar.vue";
import GridSettings from "@/components/grid/GridSettings.vue";
import BreakpointSwitcher from "@/components/grid/ViewControls.vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import ShareIcon from "@/components/icons/ShareIcon.vue";
import { useToastStore } from "@/stores/toast";

type Panel = "add" | "preview";

const toastStore = useToastStore();
const rootRef = ref<HTMLElement | null>(null);
const openPanel = ref<Panel | null>(null);

const togglePanel = (panel: Panel) => {
  openPanel.value = openPanel.value === panel ? null : panel;
};

const shareLink = async () => {
  openPanel.value = null;
  try {
    await navigator.clipboard.writeText(window.location.href);
    toastStore.addToast("Link to Grid copied to the clipboard", "success");
  } catch {
    toastStore.addToast("Failed to copy link", "error");
  }
};

const handlePointerDown = (event: MouseEvent) => {
  if (!openPanel.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    openPanel.value = null;
  }
};

onMounted(() => document.addEventListener("pointerdown", handlePointerDown));
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", handlePointerDown),
);
</script>

<style lang="scss" scoped>
.mobile-grid-bar {
  position: fixed;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-fixed);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.mobile-grid-bar__popover {
  display: flex;
  justify-content: center;
}

.mgb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
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

  &:hover,
  &.is-active {
    background: var(--color-base-8);
    color: var(--color-text-primary);
  }
}

/*
  Reposition the reused GridSettings dropdown (pinned to the bottom-left corner
  in its own styles) so it opens above and centered on the pill. Scoped :deep
  override keeps GridSettings itself untouched until the Phase 6 sheet.
*/
.mgb-settings {
  display: inline-flex;

  :deep(.grid-menu-button) {
    border-radius: var(--radius-full);
    background: transparent;

    &:hover {
      background: var(--color-base-8);
    }
  }

  :deep(.grid-menu-dropdown) {
    bottom: calc(100% + var(--spacing-sm));
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    max-width: calc(100vw - var(--spacing-lg) * 2);
  }
}

.mgb-pop-enter-active,
.mgb-pop-leave-active {
  transition:
    opacity var(--duration-fast) var(--easing-smooth),
    transform var(--duration-fast) var(--easing-smooth);
}

.mgb-pop-enter-from,
.mgb-pop-leave-to {
  opacity: 0;
  transform: translateY(var(--spacing-sm));
}
</style>
