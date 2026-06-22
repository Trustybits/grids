<template>
  <div ref="bannerStack" class="app-status-banners">
    <StubbedModeBanner v-if="isStubbedMode" />
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

const props = defineProps<{
  isStubbedMode: boolean;
  showViewportWarning: boolean;
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
  () => [props.isStubbedMode, props.showViewportWarning],
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
</style>
