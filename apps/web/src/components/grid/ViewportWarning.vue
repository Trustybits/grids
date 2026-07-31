<!--
  ViewportWarning.vue

  Warning banner for viewport/display mismatch scenarios.
  Currently handles breakpoint preview warnings, built to support future cases
  like fixed-dimension grids viewed on smaller-than-intended screens.

  Stays silent while a deliberate preview is active — see the note in `warning`.

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
      <EyeIcon v-if="warning.severity === 'info'" :size="18" />
      <WarningTriangleIcon v-else :size="18" />
    </template>

    {{ warning.message }}
  </Banner>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, nextTick, ref } from "vue";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridPreviewStore } from "@/stores/grid/gridPreview";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import type { Breakpoint } from "@grids/contracts/types";
import Banner from "@/components/ui-elements/Banner.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import WarningTriangleIcon from "@/components/icons/WarningTriangleIcon.vue";

const props = withDefaults(
  defineProps<{
    type: "breakpoint-preview" | "viewport-too-small";
    dismissible?: boolean;
  }>(),
  { dismissible: true },
);

const viewportStore = useGridViewportStore();
// Read straight from the stores rather than through `useGridPreview`, to keep
// this banner — which mounts at the app root, before any grid — clear of the
// controller and the services behind it. Passing the grid id in is the preview
// store's own API: it scopes every read so a stale preview can't answer for a
// grid that has since been replaced.
const previewStore = useGridPreviewStore();
const sessionStore = useGridSessionStore();
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
    const forced = viewportStore.forcedBreakpoint;
    const viewport = viewportStore.viewportBreakpoint;

    if (!forced) return null;
    if (breakpointRank(forced) <= breakpointRank(viewport)) return null;
    // Silent in a deliberate preview. The banner exists to explain editing
    // going away as a *side effect* of forcing a wider breakpoint from the
    // desktop switcher, which has nothing else to say so. In preview, read-only
    // is the point, the toolbar already names the device, and a banner is
    // precisely the chrome a preview is meant to be showing the grid without.
    if (previewStore.isActive(sessionStore.currentGrid?.id)) return null;

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
