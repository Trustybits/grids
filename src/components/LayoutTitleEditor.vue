<template>
  <!-- Owner: editable title -->
  <div v-if="layoutStore.isOwner" class="layout-title">
    <h2
      class="editable-text"
      :contenteditable="layoutStore.canEdit"
      spellcheck="false"
      @blur="saveName"
      @keydown.enter.prevent="blurOnEnter"
    >
      {{ editableName }}
    </h2>
  </div>

  <!-- Unauthenticated viewer: CTA buttons -->
  <div v-else-if="!isAuthenticated" class="cta-buttons" ref="ctaRef">
    <router-link class="cta-btn cta-btn--primary" to="/login">
      Claim my Grid
    </router-link>
    <router-link class="cta-btn cta-btn--ghost" to="/login">
      Login
    </router-link>
    <router-link
      class="cta-btn cta-btn--icon"
      to="/explore"
      title="Explore"
    >
      <ExploreIcon />
    </router-link>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useLayoutStore } from '@/stores/layout';
import ExploreIcon from '@/components/icons/ExploreIcon.vue';

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
});

const layoutStore = useLayoutStore();
const editableName = ref(layoutStore.currentLayout?.name || '');
const ctaRef = ref(null);

watch(
  () => layoutStore.currentLayout?.name,
  (newVal) => {
    editableName.value = newVal || '';
  }
);

const saveName = (event) => {
  if (!layoutStore.canEdit) {
    return;
  }
  const newName = event.target.innerText.trim();
  if (newName !== layoutStore.currentLayout?.name) {
    layoutStore.currentLayout.name = newName;
    layoutStore.saveLayout();
    editableName.value = newName;
  }
};

const blurOnEnter = (event) => {
  if (!layoutStore.canEdit) {
    return;
  }
  event.target.blur();
};

// Responsive overflow: hide buttons right-to-left when they don't fit
const checkOverflow = () => {
  const el = ctaRef.value;
  if (!el) return;

  const buttons = Array.from(el.querySelectorAll('.cta-btn'));
  // First, show all buttons to measure
  buttons.forEach((btn) => (btn.style.display = ''));

  // Hide from right to left (Explore first, then Login, then Claim last)
  const reversed = [...buttons].reverse();
  for (const btn of reversed) {
    if (el.scrollWidth <= el.clientWidth) break;
    btn.style.display = 'none';
  }
};

let resizeObserver = null;

onMounted(() => {
  nextTick(checkOverflow);
  resizeObserver = new ResizeObserver(checkOverflow);
  if (ctaRef.value) {
    resizeObserver.observe(ctaRef.value.parentElement || ctaRef.value);
  }
  window.addEventListener('resize', checkOverflow);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', checkOverflow);
});
</script>

<style scoped>
.layout-title {
  color: var(--color-content-low);
}

.editable-text {
  cursor: text;
  font-size: 1.5rem;
  font-weight: bold;
  outline: none;
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
}

.editable-text:focus {
  color: var(--color-text-primary);
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
  gap: var(--spacing-md);
  overflow: hidden;
  flex-shrink: 1;
  min-width: 0;
}

.cta-btn {
  white-space: nowrap;
  text-decoration: none;
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-base);
  transition:
    transform var(--duration-fast) var(--easing-smooth),
    box-shadow var(--duration-fast) var(--easing-smooth),
    filter var(--duration-fast) var(--easing-smooth),
    background-color var(--duration-normal) var(--easing-smooth);
}

/* Primary bordered button – matches .home-landing__cta */
.cta-btn--primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 10px 16px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-content-background);
  box-shadow: var(--shadow-md);
  background-color: var(--color-text-primary);
}

.cta-btn--primary:hover {
  background-color: var(--color-content-background);
  color: var(--color-content-high);
  box-shadow: var(--shadow-lg);
  filter: brightness(1.02);
}

.cta-btn--primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

/* Ghost text button – matches .home-landing__cta--ghost */
.cta-btn--ghost {
  color: var(--color-content-high);
  background: transparent;
  padding: 10px 8px;
}

.cta-btn--ghost:hover {
  text-decoration: underline;
  color: var(--color-text-primary);
}

/* Icon-only button (Explore) */
.cta-btn--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--color-content-high);
  flex-shrink: 0;
}

.cta-btn--icon:hover {
  /*background-color: var(--color-content-high);*/
  color: var(--color-text-primary);
}
</style>
