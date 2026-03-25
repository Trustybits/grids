/**
 * useSubscription — tier-based feature gating composable
 *
 * This is the single source of truth for "can this user do X?".
 * Phase 1: reads subscription state from Firestore users/{uid} doc.
 * Phase 2: will be backed by Stripe via the firestore-stripe-payments
 *          Firebase Extension, which writes to customers/{uid}/subscriptions.
 *
 * ── Tier model ──────────────────────────────────────────────────────────────
 *
 *  FREE        No account required. Read-only access to published grids.
 *
 *  COMMUNITY   Signed-in users. Access to the builder, templates, widgets.
 *              Unlocks via usage milestones (gamification — see PassiveBoostCalculator).
 *              PWYW payment optionally removes the Grids watermark.
 *
 *  PRO         Paid subscription. Features that have a real cost to host:
 *              custom domains, advanced analytics, AI, priority support, etc.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   const { tier, can, isProOrAbove } = useSubscription()
 *
 *   // In a component
 *   <button v-if="can('remove_branding')" @click="toggleBranding">
 *     Remove Grids branding
 *   </button>
 *
 *   // In a service / store
 *   if (!can('custom_domain')) {
 *     throw new Error('Custom domains require a Pro subscription')
 *   }
 */

import { computed, ref, readonly } from 'vue'
import { doc, onSnapshot } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'

// ── Tier definition ────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'community' | 'pro'

export interface SubscriptionState {
  tier: SubscriptionTier
  /** True if the user made a PWYW payment (removes watermark, unlocks cosmetics) */
  hasSupporterBadge: boolean
  /** Stripe subscription status when tier === 'pro' */
  stripeStatus?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  /** ISO date string of when the current period ends */
  currentPeriodEnd?: string
}

// ── Feature permission map ─────────────────────────────────────────────────
// Add every gated capability here. The tier required is the *minimum* needed.
// When Stripe lands, Pro features become available only when stripeStatus
// is 'active' or 'trialing'.

export type GatedFeature =
  // Community tier (free after sign-up)
  | 'create_grid'
  | 'publish_grid'
  | 'use_templates'
  | 'use_widgets'
  | 'basic_analytics'
  | 'claim_slug'
  // Unlocked via gamification milestones (still community tier)
  | 'custom_background'
  | 'extra_grids'
  | 'advanced_themes'
  // PWYW supporter perk
  | 'remove_branding'
  // Pro tier
  | 'custom_domain'
  | 'advanced_analytics'
  | 'analytics_export'
  | 'ai_suggestions'
  | 'password_protection'
  | 'priority_support'

const TIER_REQUIREMENTS: Record<GatedFeature, SubscriptionTier> = {
  // Community
  create_grid: 'community',
  publish_grid: 'community',
  use_templates: 'community',
  use_widgets: 'community',
  basic_analytics: 'community',
  claim_slug: 'community',
  // Gamification unlocks (community tier, but checked via achievements separately)
  custom_background: 'community',
  extra_grids: 'community',
  advanced_themes: 'community',
  // PWYW (community tier + hasSupporterBadge)
  remove_branding: 'community',
  // Pro
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

// ── Features that also require hasSupporterBadge (PWYW) ──────────────────
const REQUIRES_SUPPORTER: Set<GatedFeature> = new Set(['remove_branding'])

// ── State ──────────────────────────────────────────────────────────────────

const _subscription = ref<SubscriptionState>({
  tier: 'free',
  hasSupporterBadge: false,
})
const _loading = ref(true)
let _unsubscribeFirestore: (() => void) | null = null

/**
 * Bootstrap the subscription listener. Call this once in App.vue or main.ts
 * after Firebase Auth is initialized. It listens to auth state and mirrors
 * Firestore subscription data reactively.
 *
 * In Phase 2, this will also listen to customers/{uid}/subscriptions from
 * the Stripe Firebase Extension.
 */
export function initSubscription(): void {
  const auth = getAuth()

  onAuthStateChanged(auth, (user) => {
    // Clean up previous listener
    if (_unsubscribeFirestore) {
      _unsubscribeFirestore()
      _unsubscribeFirestore = null
    }

    if (!user) {
      _subscription.value = { tier: 'free', hasSupporterBadge: false }
      _loading.value = false
      return
    }

    // Listen to the user's Firestore doc for subscription state.
    // Phase 2: also listen to customers/{uid}/subscriptions.
    const userRef = doc(db, 'users', user.uid)
    _unsubscribeFirestore = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) {
        _subscription.value = { tier: 'community', hasSupporterBadge: false }
        _loading.value = false
        return
      }

      const data = snap.data()

      _subscription.value = {
        // Phase 2: derive tier from Stripe subscription status
        // For now: all authenticated users are 'community' tier
        tier: (data.subscriptionTier as SubscriptionTier) ?? 'community',
        hasSupporterBadge: data.hasSupporterBadge ?? false,
        stripeStatus: data.stripeStatus,
        currentPeriodEnd: data.currentPeriodEnd,
      }
      _loading.value = false
    })
  })
}

// ── Composable ────────────────────────────────────────────────────────────

export function useSubscription() {
  const tier = computed(() => _subscription.value.tier)
  const hasSupporterBadge = computed(() => _subscription.value.hasSupporterBadge)
  const isLoading = computed(() => _loading.value)

  const isProOrAbove = computed(() => TIER_RANK[tier.value] >= TIER_RANK['pro'])
  const isCommunityOrAbove = computed(() => TIER_RANK[tier.value] >= TIER_RANK['community'])

  /**
   * Returns true if the current user has access to the given feature.
   * This is the primary method to use in components and services.
   */
  function can(feature: GatedFeature): boolean {
    const required = TIER_REQUIREMENTS[feature]
    const meetsRank = TIER_RANK[tier.value] >= TIER_RANK[required]

    if (!meetsRank) return false

    // PWYW check: supporter-only features also require the badge
    if (REQUIRES_SUPPORTER.has(feature) && !hasSupporterBadge.value) {
      return false
    }

    return true
  }

  /**
   * Returns the reason a feature is locked, for use in upgrade prompts.
   * Returns null if the feature is accessible.
   */
  function lockReason(feature: GatedFeature): 'sign_in' | 'supporter' | 'pro' | null {
    if (can(feature)) return null

    const required = TIER_REQUIREMENTS[feature]

    if (required === 'community' && tier.value === 'free') return 'sign_in'
    if (REQUIRES_SUPPORTER.has(feature)) return 'supporter'
    if (required === 'pro') return 'pro'

    return null
  }

  return {
    tier: readonly(tier),
    hasSupporterBadge: readonly(hasSupporterBadge),
    isLoading: readonly(isLoading),
    isProOrAbove,
    isCommunityOrAbove,
    can,
    lockReason,
    TIER_REQUIREMENTS,
  }
}
