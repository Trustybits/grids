<template>
  <component
    :is="href ? 'a' : 'span'"
    class="brand-logo"
    :class="{ 'is-link': !!href, 'has-error': failed }"
    :style="{ width: size + 'px', height: size + 'px' }"
    :href="href || undefined"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
    :title="logo.label"
    :aria-label="logo.label"
    @click="onClick"
  >
    <img
      v-if="src && !failed"
      class="brand-logo__img"
      :src="src"
      :alt="logo.label"
      :width="size"
      :height="size"
      loading="lazy"
      draggable="false"
      @error="failed = true"
    />
    <span v-else class="brand-logo__fallback" aria-hidden="true">{{ initial }}</span>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BrandLogoRef } from "@grids/contracts/types";
import { resolveBrandLogoSrc, resolveBrandLogoLink } from "@/utils/brandLogo";

const props = withDefaults(
  defineProps<{
    logo: BrandLogoRef;
    size?: number;
    // When false, never render the click-through link (e.g. while editing).
    linkable?: boolean;
  }>(),
  { size: 32, linkable: true },
);

const failed = ref(false);

const src = computed(() => resolveBrandLogoSrc(props.logo, props.size));
const href = computed(() =>
  props.linkable ? resolveBrandLogoLink(props.logo) : null,
);
const initial = computed(() => props.logo.label?.trim().charAt(0).toUpperCase() || "?");

// Reset the broken-image state when the underlying source changes.
watch(src, () => {
  failed.value = false;
});

const onClick = (event: MouseEvent) => {
  // Don't navigate when there's no link (display-only / editing).
  if (!href.value) event.preventDefault();
};
</script>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  text-decoration: none;
  overflow: hidden;
}

.brand-logo.is-link {
  cursor: pointer;
  transition: transform var(--duration-fast, 0.15s) var(--easing-smooth, ease);
}

.brand-logo.is-link:hover {
  transform: translateY(-2px);
}

.brand-logo__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.brand-logo__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.6em;
  background-color: var(--color-base-55, rgba(127, 127, 127, 0.15));
  border-radius: inherit;
}
</style>
