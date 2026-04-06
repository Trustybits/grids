<template>
  <div class="share-button">
    <button
      type="button"
      class="share-button__btn"
      @click="handleShare"
    >
      <div class="share-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12C9 13.3807 7.88071 14.5 6.5 14.5C5.11929 14.5 4 13.3807 4 12C4 10.6193 5.11929 9.5 6.5 9.5C7.88071 9.5 9 10.6193 9 12Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M14 6.5L9 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M14 17.5L9 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M19 18.5C19 19.8807 17.8807 21 16.5 21C15.1193 21 14 19.8807 14 18.5C14 17.1193 15.1193 16 16.5 16C17.8807 16 19 17.1193 19 18.5Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M19 5.5C19 6.88071 17.8807 8 16.5 8C15.1193 8 14 6.88071 14 5.5C14 4.11929 15.1193 3 16.5 3C17.8807 3 19 4.11929 19 5.5Z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from "@/stores/toast";

const toastStore = useToastStore();

const handleShare = async () => {
  const currentUrl = window.location.href;
  try {
    await navigator.clipboard.writeText(currentUrl);
    toastStore.addToast('Link to Grid copied to the clipboard', 'success');
  } catch (err) {
    toastStore.addToast('Failed to copy link', 'error');
  }
};
</script>

<style lang="scss" scoped>
.share-button {
  position: relative;
}

.share-button__btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--easing-smooth);
  padding: 0;
  border: none;
  line-height: 0;

  &:hover {
    background: var(--color-base-34);

    .share-icon {
      color: var(--color-figma-purple);
    }
  }
}

.share-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--color-content-default);
  transition: color var(--duration-fast) var(--easing-smooth);

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}
</style>
