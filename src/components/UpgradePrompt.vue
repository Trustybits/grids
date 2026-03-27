<template>
  <div class="upgrade-prompt" :class="`prompt-${reason}`">
    <div class="prompt-icon">{{ icon }}</div>
    <div class="prompt-body">
      <p class="prompt-title">{{ title }}</p>
      <p class="prompt-description">{{ description }}</p>
    </div>
    <div class="prompt-action">
      <router-link v-if="reason === 'sign_in'" to="/login" class="btn btn-sm btn-primary">
        Sign in
      </router-link>
      <router-link
        v-else
        :to="reason === 'pro' ? '/pricing#pro' : '/pricing#supporter'"
        class="btn btn-sm"
        :class="reason === 'pro' ? 'btn-primary' : 'btn-supporter'"
      >
        {{ ctaLabel }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GatedFeature } from '@/composables/useSubscription'

const props = defineProps<{
  /** The feature that's locked — used to generate contextual copy */
  feature?: GatedFeature
  /** The reason it's locked — drives the CTA */
  reason: 'sign_in' | 'supporter' | 'pro'
  /** Override the default title */
  title?: string
  /** Override the default description */
  description?: string
}>()

const icon = computed(() => {
  if (props.reason === 'sign_in') return '🔒'
  if (props.reason === 'supporter') return '🔥'
  return '★'
})

const title = computed(() => {
  if (props.title) return props.title
  if (props.reason === 'sign_in') return 'Sign in to use this feature'
  if (props.reason === 'supporter') return 'Supporter feature'
  return 'Pro feature'
})

const description = computed(() => {
  if (props.description) return props.description
  const featureCopy: Partial<Record<GatedFeature, string>> = {
    remove_branding: 'Remove the Grids badge from your published pages by becoming a Supporter.',
    custom_domain: 'Use your own domain (yourname.com) instead of grids.app/yourslug.',
    advanced_analytics: 'See detailed visitor analytics, referrers, and engagement data.',
    analytics_export: 'Export your analytics data as CSV for further analysis.',
    ai_suggestions: 'Get AI-powered content and layout suggestions as you build.',
    password_protection: 'Protect your grids with a password for private sharing.',
    priority_support: 'Get faster responses and dedicated support from the Grids team.',
  }
  if (props.feature && featureCopy[props.feature]) return featureCopy[props.feature]!
  if (props.reason === 'sign_in') return 'Create a free account to get started.'
  if (props.reason === 'supporter') return 'Support Grids with any amount — even free — to unlock this.'
  return 'Upgrade to Pro to unlock this feature.'
})

const ctaLabel = computed(() => {
  if (props.reason === 'supporter') return 'Become a Supporter'
  return 'Upgrade to Pro'
})
</script>

<style scoped lang="scss">
.upgrade-prompt {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--bs-border-color, #dee2e6);
  background: var(--bs-secondary-bg, #f8f9fa);
  font-size: 0.875rem;

  &.prompt-pro {
    border-color: rgba(99, 102, 241, 0.3);
    background: rgba(99, 102, 241, 0.05);
  }

  &.prompt-supporter {
    border-color: rgba(249, 115, 22, 0.3);
    background: rgba(249, 115, 22, 0.05);
  }
}

.prompt-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.prompt-body {
  flex: 1;
  min-width: 0;
}

.prompt-title {
  font-weight: 600;
  margin: 0 0 0.15rem;
}

.prompt-description {
  margin: 0;
  opacity: 0.7;
  line-height: 1.4;
}

.prompt-action {
  flex-shrink: 0;
}

.btn-supporter {
  background: #f97316;
  border-color: #f97316;
  color: white;

  &:hover {
    background: #ea6c0a;
    border-color: #ea6c0a;
    color: white;
  }
}
</style>
