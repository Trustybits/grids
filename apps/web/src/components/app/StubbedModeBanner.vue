<template>
  <Banner severity="caution" :dismissible="false">
    <template #icon>
      <WarningTriangleIcon :size="18" />
    </template>

    Stubbed mode is active. Authentication and data use local in-memory
    implementations and may reset when the page reloads.
  </Banner>
</template>

<script setup lang="ts">
import WarningTriangleIcon from "@/components/icons/WarningTriangleIcon.vue";
import Banner from "@/components/ui-elements/Banner.vue";
</script>
