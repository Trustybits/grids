<template>
  <canvas ref="canvasRef" class="griddle-animation" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { startMatricksBackground, type MatricksBackgroundOptions } from '@/components/matricks-background';

const props = withDefaults(
  defineProps<{
    options?: MatricksBackgroundOptions;
  }>(),
  {
    options: () => ({}),
  }
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let stop: (() => void) | null = null;
let themeObserver: MutationObserver | null = null;

const getDefaultColors = () => {
  const root = document.documentElement;
  const body = document.body;
  const isDark = root.classList.contains('theme-dark') || body.classList.contains('theme-dark');

  return {
    // Matches src/styles/themes.scss
    primaryColor: isDark ? '255, 254, 245' : '51, 49, 44',
    emphasizedColor: isDark ? '255, 254, 245' : '51, 49, 44',
    rippleLowColor: isDark ? '255, 254, 245' : '51, 49, 44',
    rippleHighColor: isDark ? '255, 255, 255' : '255, 255, 255',
    // Darken the edges slightly to keep focus on the hero content.
    vignetteColor: '0, 0, 0',
    // Fade against the page background color (so trails don't wash the page).
    fadeFillColor: isDark ? '16, 16, 14' : '255, 254, 245',
  };
};

const start = () => {
  stop?.();
  stop = null;

  const canvas = canvasRef.value;
  if (!canvas) return;

  const themeDefaults = getDefaultColors();

  stop = startMatricksBackground(canvas, {
    // Defaults tuned to be subtle behind homepage content.
    fontSize: 14,
    animationSpeed: 0.75,
    patternSpeed: 0.85,
    characterSpacing: 1.2,
    flashFrequency: 0,
    maxFlashIntensity: 0.25,
    vignetteEnabled: true,
    vignetteIntensity: 0.35,
    vignetteSpread: 0.8,
    animationPattern: 'grids',
    characters: '◼︎◻︎▫︎▪︎■□',
    emphasizedMessages: [],
    fadeFillAlpha: 0.18,
    gridsBackgroundOpacityScale: 0.14,
    gridsTileOpacityBase: 0.34,
    gridsTileOpacityPulse: 0.05,
    gridsTileMoveChance: 0.12,
    ...themeDefaults,
    ...props.options,
  });
};

onMounted(() => {
  start();
  window.addEventListener('resize', start);

  // Restart when theme toggles (theme store toggles classes on body/root).
  themeObserver = new MutationObserver(() => start());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', start);
  themeObserver?.disconnect();
  themeObserver = null;
  stop?.();
  stop = null;
});
</script>

<style scoped>
.griddle-animation {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}
</style>
