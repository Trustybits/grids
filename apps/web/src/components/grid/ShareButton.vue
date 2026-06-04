<template>
  <Button variant="ghost" icon-only @click="handleShare">
    <template #icon-left>
      <ShareIcon />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui-elements/Button.vue';
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
