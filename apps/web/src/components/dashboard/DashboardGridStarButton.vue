<template>
  <button
    type="button"
    @click.stop.prevent="$emit('toggle-star', gridId)"
    :data-tooltip="isStarred ? 'Remove from favorites' : 'Favorite grid'"
    class="star-lead"
    :class="{ 'is-starred': isStarred }"
  >
    <StarIcon :size="22" :filled="isStarred" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import StarIcon from "@/components/icons/StarIcon.vue";

defineProps({
  gridId: { type: String, required: true },
  isStarred: { type: Boolean, default: false },
});

defineEmits(["toggle-star"]);
</script>

<style scoped>
.star-lead {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-low);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.star-lead.is-starred {
  color: #eab308;
}

.star-lead:not(.is-starred):hover {
  color: #ca8a04;
}

.star-lead.is-starred:hover {
  color: #facc15;
}
</style>
