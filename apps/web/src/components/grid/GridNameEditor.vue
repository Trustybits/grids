<template>
  <!-- Owner: editable title -->
  <div v-if="gridStore.isOwner" class="layout-title">
    <h2
      class="editable-text"
      :contenteditable="gridStore.canEdit"
      spellcheck="false"
      @blur="saveName"
      @keydown.enter.prevent="blurOnEnter"
    >
      {{ editableName }}
    </h2>
    <GridStats />
  </div>

  <!-- Unauthenticated viewer: CTA buttons -->
  <div v-else-if="!isAuthenticated" class="cta-buttons" ref="ctaRef">
    <Button class="cta-btn" variant="secondary" to="/login" size="sm">
      <template #icon-left>
        <img src="/grids_logo.png" alt="" />
      </template>
      Claim your Grid
    </Button>
    <Button class="cta-btn" variant="ghost" to="/login" size="sm">
      Login
    </Button>
    <Button class="cta-btn" variant="ghost" icon-only to="/showcase" size="sm" title="Showcase">
      <template #icon-left>
        <ExploreIcon />
      </template>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useGridStore } from "@/stores/grid";
import ExploreIcon from "@/components/icons/ExploreIcon.vue";
import GridStats from "@/components/grid/GridStats.vue";
import Button from "@/components/ui-elements/Button.vue";

defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
});

const gridStore = useGridStore();
const editableName = ref(gridStore.currentGrid?.name || "");
const ctaRef = ref<HTMLElement | null>(null);

watch(
  () => gridStore.currentGrid?.name,
  (newVal) => {
    editableName.value = newVal || "";
  },
);

const saveName = (event: FocusEvent) => {
  if (!gridStore.canEdit) {
    return;
  }
  const newName = (event.target as HTMLElement).innerText.trim();
  if (gridStore.currentGrid && newName !== gridStore.currentGrid.name) {
    gridStore.renameCurrentGrid(newName);
    editableName.value = newName;
  }
};

const blurOnEnter = (event: KeyboardEvent) => {
  if (!gridStore.canEdit) {
    return;
  }
  (event.target as HTMLElement).blur();
};

// Responsive overflow: hide buttons right-to-left when they don't fit
const checkOverflow = () => {
  const el = ctaRef.value;
  if (!el) return;

  const buttons = Array.from(el.querySelectorAll<HTMLElement>(".cta-btn"));
  // First, show all buttons to measure
  buttons.forEach((btn) => (btn.style.display = ""));

  // Hide from right to left (Explore first, then Login, then Claim last)
  const reversed = [...buttons].reverse();
  for (const btn of reversed) {
    if (el.scrollWidth <= el.clientWidth) break;
    btn.style.display = "none";
  }
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(checkOverflow);
  resizeObserver = new ResizeObserver(checkOverflow);
  if (ctaRef.value) {
    resizeObserver.observe(ctaRef.value.parentElement || ctaRef.value);
  }
  window.addEventListener("resize", checkOverflow);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", checkOverflow);
});
</script>

<style scoped>
.layout-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--bg-contrast-color-low, var(--color-content-low));
  /* color: var(--color-content-low); */
}

.editable-text {
  cursor: text;
  font-size: 1.5rem;
  font-weight: bold;
  line-height: 1;
  margin: 0;
  outline: none;
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
}

.editable-text:focus {
  /* color: var(--color-text-primary); */
  color: var(--bg-contrast-color, var(--color-text-primary));
  background-color: var(--color-content-low);
}

.editable-text:hover {
  color: inherit;
  /* color: var(--color-base-100); */
}

/* ── CTA buttons for unauthenticated viewers ── */

.cta-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 1;
  min-width: 0;
}

@media (max-width: 600px) {
  .cta-buttons {
    width: 100%;
    justify-content: center;
  }
}

</style>
