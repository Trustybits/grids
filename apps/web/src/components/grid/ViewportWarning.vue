<!--
  ViewportWarning.vue

  Warning banner for viewport/display mismatch scenarios.
  Currently handles breakpoint preview warnings, built to support future cases
  like fixed-dimension grids viewed on smaller-than-intended screens.

  Usage:
    <ViewportWarning
      type="breakpoint-preview"
      :dismissible="true"
    />
-->
<template>
  <Banner
    v-if="warning"
    ref="bannerComponent"
    :severity="warning.severity"
    :dismissible="dismissible"
    transition-name="viewport-warning"
    @dismiss="onDismiss"
  >
    <template #icon>
      <!-- Eye icon for view-only mode -->
      <svg
        v-if="warning.severity === 'info'"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <!-- Warning triangle for caution-level messages -->
      <svg
        v-else
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </template>

    {{ warning.message }}
  </Banner>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, nextTick, ref } from "vue";
import { useGridStore } from "@/stores/grid";
import type { Breakpoint } from "@/types/Tile";
import Banner from "@/components/ui-elements/Banner.vue";

const props = withDefaults(
  defineProps<{
    type: "breakpoint-preview" | "viewport-too-small";
    dismissible?: boolean;
  }>(),
  { dismissible: true },
);

const gridStore = useGridStore();
const bannerComponent = ref<InstanceType<typeof Banner> | null>(null);

const breakpointRank = (bp: Breakpoint): number => {
  if (bp === "sm") return 0;
  if (bp === "md") return 1;
  return 2;
};

const breakpointLabel = (bp: Breakpoint): string => {
  if (bp === "sm") return "Mobile";
  if (bp === "md") return "Tablet";
  return "Desktop";
};

interface WarningState {
  message: string;
  severity: "info" | "caution";
}

const warning = computed<WarningState | null>(() => {
  if (props.type === "breakpoint-preview") {
    const forced = gridStore.forcedBreakpoint;
    const viewport = gridStore.viewportBreakpoint;

    if (!forced) return null;
    if (breakpointRank(forced) <= breakpointRank(viewport)) return null;

    return {
      message: `Previewing ${breakpointLabel(forced)} layout — view only (your screen is ${breakpointLabel(viewport)} sized)`,
      severity: "info",
    };
  }

  if (props.type === "viewport-too-small") {
    return null;
  }

  return null;
});

// Reset Banner's dismissed state when the warning condition changes
watch(
  () => warning.value?.message,
  () => {
    bannerComponent.value?.reset();
  },
);

// ── Banner height → CSS custom property ────────────────────────
const updateBannerHeight = () => {
  nextTick(() => {
    const el = bannerComponent.value?.bannerEl;
    if (warning.value && el) {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--viewport-warning-height",
        `${h}px`,
      );
    } else {
      document.documentElement.style.setProperty(
        "--viewport-warning-height",
        "0px",
      );
    }
  });
};

const onDismiss = () => {
  document.documentElement.style.setProperty(
    "--viewport-warning-height",
    "0px",
  );
};

watch(warning, updateBannerHeight, { immediate: true });

onMounted(updateBannerHeight);

onUnmounted(() => {
  document.documentElement.style.setProperty(
    "--viewport-warning-height",
    "0px",
  );
});
</script>

<style lang="scss" scoped>
/* Transition for smooth enter/leave */
.viewport-warning-enter-active,
.viewport-warning-leave-active {
  transition:
    opacity 0.2s var(--easing-ease-out),
    transform 0.2s var(--easing-ease-out);
}

.viewport-warning-enter-from,
.viewport-warning-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
