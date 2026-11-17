<!--
  MobileSettingsCard.vue

  The solid card Grid settings opens in on the floating phone toolbars — the
  same card the tool popovers use (Figma "Popover · Font & size" 146:22581):
  a title with Done, and an optional back arrow for a page inside it (the
  background colour or image). It floats above the home bar; the parent
  supplies the body.
-->
<template>
  <section
    class="msc pp-scope"
    role="dialog"
    :aria-label="title"
    tabindex="-1"
  >
    <header class="msc__header">
      <button
        v-if="back"
        type="button"
        class="msc__back"
        aria-label="Back to grid settings"
        @click="$emit('back')"
      >
        <ChevronLeftIcon :size="20" />
      </button>
      <h2 class="msc__title">{{ title }}</h2>
      <span class="msc__spacer"></span>
      <button type="button" class="msc__done" @click="$emit('done')">
        Done
      </button>
    </header>
    <div :key="title" class="msc__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import ChevronLeftIcon from "@/components/icons/ChevronLeftIcon.vue";

defineProps<{
  title: string;
  /** Show a back arrow (a page inside the card). */
  back?: boolean;
}>();

defineEmits<{ back: []; done: [] }>();
</script>

<style scoped>
.msc {
  /* Taps act at once: no double-tap zoom wait on our controls. */
  touch-action: manipulation;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-height: min(60vh, 520px);
  padding: 12px 14px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-stroke);
  border-radius: 18px;
  background: var(--color-toolbar-background);
  box-shadow: var(--shadow-xl);
  color: var(--color-text-primary);
  transform-origin: 50% 100%;
}

.msc:focus {
  outline: none;
}

.msc__header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.msc__spacer {
  flex: 1 1 auto;
}

.msc__title {
  margin: 0;
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  color: var(--color-text-primary);
}

.msc__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: -6px;
  padding: 0;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: var(--color-content-high);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.msc__done {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 16px;
  background: var(--color-tool-on-bg);
  color: var(--color-tool-active);
  font-family: "Inter", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.msc__back:active,
.msc__done:active {
  transform: scale(0.95);
}

.msc__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: msc-body-in 120ms ease-out both;
}

@keyframes msc-body-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .msc__body {
    animation: none;
  }
}
</style>
