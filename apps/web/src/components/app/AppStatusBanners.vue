<template>
  <div ref="bannerStack" class="app-status-banners">
    <StubbedModeBanner v-if="isStubbedMode" />
    <Banner
      v-if="showResponsiveLayoutPreview"
      severity="caution"
      :dismissible="false"
      data-testid="responsive-layout-preview-banner"
    >
      <template #icon>
        <EyeIcon :size="18" />
      </template>
      Previewing the Griddle responsive layout — this grid is read-only.
      <button
        type="button"
        class="preview-stop-button"
        data-testid="stop-responsive-layout-preview"
        @click="emit('stop-responsive-layout-preview')"
      >
        Stop preview
      </button>
    </Banner>
    <ViewportWarning
      v-if="showViewportWarning"
      type="breakpoint-preview"
      :dismissible="false"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import StubbedModeBanner from "@/components/app/StubbedModeBanner.vue";
import ViewportWarning from "@/components/grid/ViewportWarning.vue";
import Banner from "@/components/ui-elements/Banner.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";

const props = withDefaults(
  defineProps<{
    isStubbedMode: boolean;
    showViewportWarning: boolean;
    showResponsiveLayoutPreview?: boolean;
  }>(),
  { showResponsiveLayoutPreview: false },
);

const emit = defineEmits<{
  "stop-responsive-layout-preview": [];
}>();

const bannerStack = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

const updateBannerStackHeight = () => {
  nextTick(() => {
    const height = bannerStack.value?.getBoundingClientRect().height ?? 0;
    document.documentElement.style.setProperty(
      "--app-status-banners-height",
      `${height}px`,
    );
  });
};

watch(
  () => [
    props.isStubbedMode,
    props.showViewportWarning,
    props.showResponsiveLayoutPreview,
  ],
  updateBannerStackHeight,
);

onMounted(() => {
  updateBannerStackHeight();

  if (bannerStack.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(updateBannerStackHeight);
    resizeObserver.observe(bannerStack.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  document.documentElement.style.setProperty(
    "--app-status-banners-height",
    "0px",
  );
});
</script>

<style lang="scss" scoped>
.app-status-banners {
  position: sticky;
  top: 0;
  z-index: calc(var(--z-topbar) + 3);
  width: 100%;
}

.app-status-banners :deep(.banner) {
  position: static;
}

.preview-stop-button {
  margin-left: var(--spacing-xs);
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-semibold);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
