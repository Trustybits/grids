<template>
  <IconButton @click="handleShare">
    <ShareIcon :size="20" />
  </IconButton>
</template>

<script setup lang="ts">
import IconButton from '@/components/ui-controls/IconButton.vue';
import ShareIcon from '@/components/icons/ShareIcon.vue';
import { useToastStore } from "@/stores/toast";

const toastStore = useToastStore();

const handleShare = async () => {
  const currentUrl = window.location.href;
  try {
    await navigator.clipboard.writeText(currentUrl);
    toastStore.addToast("Link to Grid copied to the clipboard", "success");
  } catch {
    toastStore.addToast("Failed to copy link", "error");
  }
};
</script>
