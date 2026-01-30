<template>
  <div class="accordion">
    <button 
      class="accordion__header"
      @click="toggleExpanded"
    >
      <span>{{ title }}</span>
      <svg 
        class="accordion-icon" 
        :class="{ 'accordion-icon--open': isExpanded }"
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none"
      >
        <path 
          d="M6 9L12 15L18 9" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <Transition name="accordion">
      <div v-if="isExpanded" class="accordion__content">
        <slot></slot>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  title: string;
}>();

const isExpanded = ref(false);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};
</script>

<style lang="scss" scoped>
.accordion {
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--spacing-sm);
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast) var(--easing-smooth);
    font-family: var(--font-family-base);
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-align: left;

    &:hover {
      background-color: var(--color-base-34);
    }

    .accordion-icon {
      transition: transform var(--duration-fast) var(--easing-smooth);
      color: var(--color-content-default);
      flex-shrink: 0;

      &--open {
        transform: rotate(180deg);
      }
    }
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-left: var(--spacing-sm);
    padding-top: var(--spacing-xs);
    overflow: hidden;
  }
}

.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.3s ease;
  max-height: 200px;
}

.accordion-enter-from,
.accordion-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
}
</style>
