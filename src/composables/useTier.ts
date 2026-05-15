/**
 * useTier — feature-gating composable
 *
 * Resolves the current user's subscription tier and exposes a `can(feature)`
 * helper for gating features in components and services.
 *
 * ── Tier model ──────────────────────────────────────────────────────────────
 *
 *  FREE        Not signed in. Read-only access to published grids.
 *  COMMUNITY   Signed-in users. Builder, templates, widgets, slug.
 *  PRO         Active Stripe subscription. Reserved for future paid features
 *              (custom domains, advanced analytics, etc.) — currently unused.
 *
 * Pro is wired in the type system but the listener is not enabled yet because
 * we haven't shipped subscriptions. When Pro launches, re-introduce a Stripe
 * subscription listener inside `initTier()` and have it set the tier — see
 * `BadgeService` / `useBadges` for the same listener pattern.
 *
 * Badges (Supporter, Early Adopter, etc.) are intentionally NOT modeled here.
 * They live in their own `userBadges/{uid}` collection — see `useBadges`.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   const { can, tier } = useTier()
 *   <button v-if="can('custom_domain')">Set Custom Domain</button>
 *   <UpgradePrompt v-else :reason="lockReason('custom_domain')" />
 */

import { computed, ref, readonly } from 'vue'
import { getAuthProvider } from '@/auth/AuthProviderSingleton'

// ── Tier definition ────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'community' | 'pro'

// ── Feature permission map ─────────────────────────────────────────────────

export type GatedFeature =
  // Community (free after sign-up)
  | 'create_grid'
  | 'publish_grid'
  | 'use_templates'
  | 'use_widgets'
  | 'basic_analytics'
  | 'claim_slug'
  // Unlocked via gamification milestones (community tier)
  | 'custom_background'
  | 'extra_grids'
  | 'advanced_themes'
  // Reserved for the Supporter badge once it's wired into gating.
  // Today the Supporter badge is purely cosmetic; gating on it goes through
  // useBadges() rather than useTier().
  | 'remove_branding'
  // Pro tier
  | 'custom_domain'
  | 'advanced_analytics'
  | 'analytics_export'
  | 'ai_suggestions'
  | 'password_protection'
  | 'priority_support'

const TIER_REQUIREMENTS: Record<GatedFeature, SubscriptionTier> = {
  create_grid: 'community',
  publish_grid: 'community',
  use_templates: 'community',
  use_widgets: 'community',
  basic_analytics: 'community',
  claim_slug: 'community',
  custom_background: 'community',
  extra_grids: 'community',
  advanced_themes: 'community',
  remove_branding: 'community',
  custom_domain: 'pro',
  advanced_analytics: 'pro',
  analytics_export: 'pro',
  ai_suggestions: 'pro',
  password_protection: 'pro',
  priority_support: 'pro',
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  community: 1,
  pro: 2,
}

// ── Module-level reactive state ────────────────────────────────────────────
// Shared across all composable instances — only one set of listeners runs.

const _tier = ref<SubscriptionTier>('free')
const _loading = ref(true)

let _unsubAuth: (() => void) | null = null

// ── Bootstrap ─────────────────────────────────────────────────────────────

/**
 * Bootstrap the tier listener. Call once in App.vue.
 *
 * Currently the only input is auth state (signed-in => community). When we
 * introduce Pro subscriptions, add a `customers/{uid}/subscriptions` listener
 * here and set tier='pro' on active status.
 */
export function initTier(): void {
  _unsubAuth?.()
  _unsubAuth = getAuthProvider().onAuthStateChanged((user) => {
    _tier.value = user ? 'community' : 'free'
    _loading.value = false
  })
}

// ── Composable ────────────────────────────────────────────────────────────

export function useTier() {
  const tier = computed(() => _tier.value)
  const isLoading = computed(() => _loading.value)
  const isProOrAbove = computed(() => TIER_RANK[tier.value] >= TIER_RANK['pro'])
  const isCommunityOrAbove = computed(() => TIER_RANK[tier.value] >= TIER_RANK['community'])

  /**
   * Returns true if the current user has access to the given feature.
   * This is the primary gating method — use this in components and services.
   */
  function can(feature: GatedFeature): boolean {
    const required = TIER_REQUIREMENTS[feature]
    return TIER_RANK[tier.value] >= TIER_RANK[required]
  }

  /**
   * Returns why a feature is locked, for use in upgrade prompts.
   * Returns null if the user already has access.
   */
  function lockReason(feature: GatedFeature): 'sign_in' | 'supporter' | 'pro' | null {
    if (can(feature)) return null
    const required = TIER_REQUIREMENTS[feature]
    if (required === 'community' && tier.value === 'free') return 'sign_in'
    if (feature === 'remove_branding') return 'supporter'
    if (required === 'pro') return 'pro'
    return null
  }

  return {
    tier: readonly(tier),
    isLoading: readonly(isLoading),
    isProOrAbove,
    isCommunityOrAbove,
    can,
    lockReason,
    TIER_REQUIREMENTS,
  }
}
