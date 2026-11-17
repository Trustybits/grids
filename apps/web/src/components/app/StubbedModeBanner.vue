<template>
  <Banner severity="caution" :dismissible="false">
    <template #icon>
      <WarningTriangleIcon :size="18" />
    </template>

    <span class="stub-banner__full">
      Stubbed mode is active. Authentication and data use local in-memory
      implementations and may reset when the page reloads.
    </span>
    <!-- On a phone the full sentence wraps to three lines and crowds out the
         grid; one line says enough. -->
    <span class="stub-banner__short">Stubbed mode: local data, resets on reload.</span>
  </Banner>
</template>

<script setup lang="ts">
import WarningTriangleIcon from "@/components/icons/WarningTriangleIcon.vue";
import Banner from "@/components/ui-elements/Banner.vue";
</script>

<style scoped>
.stub-banner__short {
  display: none;
}

@media (max-width: 640px) {
  .stub-banner__full {
    display: none;
  }

  .stub-banner__short {
    display: inline;
  }
}
</style>
