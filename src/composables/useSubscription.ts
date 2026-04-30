/**
 * useSubscription — tier-based feature gating composable
 *
 * Reads subscription state from two data sources:
 *  1. customers/{uid}/payments      → PWYW one-time payment history (Supporter tier)
 *     Written automatically by the firestore-stripe-payments extension webhook.
 *     We sum all succeeded payments to derive supporter status and feature thresholds.
 *  2. customers/{uid}/subscriptions → Stripe subscription status (Pro tier)
 *     Written automatically by the firestore-stripe-payments extension.
 *
 * ── Tier model ──────────────────────────────────────────────────────────────
 *
 *  FREE        No account. Read-only access to published grids.
 *
 *  COMMUNITY   Signed-in users. Builder, templates, widgets, slug.
 *              Gamification milestones unlock cosmetic features.
 *
 *  PRO         Active Stripe subscription. Features with real hosting costs:
 *              custom domains, advanced analytics, AI, priority support, etc.
 *
 * ── Supporter thresholds ────────────────────────────────────────────────────
 *
 *  totalPaidCents >= BADGE_MIN_CENTS    ($1)  → Supporter badge + early access
 *  totalPaidCents >= BRANDING_MIN_CENTS ($10) → Remove Grids branding
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   const { can, tier, hasSupporterBadge, totalPaidCents } = useSubscription()
 *
 *   // Gate a feature in a component
 *   <button v-if="can('custom_domain')">Set Custom Domain</button>
 *
 *   // Show an upgrade prompt
 *   <UpgradePrompt v-else :reason="lockReason('custom_domain')" />
 *
 * ── Migration note ──────────────────────────────────────────────────────────
 *
 *  Option A (current): frontend aggregates from customers/{uid}/payments.
 *  Option B (future):  a Firestore trigger Cloud Function writes totalPaidCents
 *  to users/{uid}, and this composable reads it from a single doc snapshot.
 *  The public API of this composable (hasSupporterBadge, totalPaidCents, can())
 *  will stay identical — only initSubscription() needs to change.
 */

import { computed, ref, readonly } from 'vue'
import { getAuthProvider } from '@/auth/AuthProviderSingleton'
import { getServiceFactory } from '@/services/ServiceFactorySingleton'

// ── Supporter thresholds ───────────────────────────────────────────────────

/** Minimum cumulative payment (cents) for the Supporter badge ($1.00) */
const BADGE_MIN_CENTS = 100

/** Minimum cumulative payment (cents) to remove Grids branding ($10.00) */
const BRANDING_MIN_CENTS = 1000

// ── Tier definition ────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'community' | 'pro'

export interface SubscriptionState {
  tier: SubscriptionTier
  /** True when totalPaidCents >= BADGE_MIN_CENTS ($1) */
  hasSupporterBadge: boolean
  /** Cumulative sum of all succeeded PWYW payments in cents */
  totalPaidCents: number
  /** Stripe subscription status — only present when tier === 'pro' */
  stripeStatus?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  /** Stripe Price ID of the active plan */
  stripePriceId?: string
  /** Billing interval of the active plan */
  stripeInterval?: 'month' | 'year'
  /** ISO date string when the current period ends */
  currentPeriodEnd?: string
}

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
  // PWYW supporter perks (threshold-gated)
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
  remove_branding: 'community',   // community + totalPaidCents >= BRANDING_MIN_CENTS
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

/** Stripe statuses that grant Pro access */
const ACTIVE_STRIPE_STATUSES = new Set(['active', 'trialing'])

// ── Module-level reactive state ────────────────────────────────────────────
// Shared across all composable instances — only one set of listeners runs.

const _subscription = ref<SubscriptionState>({
  tier: 'free',
  hasSupporterBadge: false,
  totalPaidCents: 0,
})
const _loading = ref(true)

let _unsubPayments: (() => void) | null = null
let _unsubStripe: (() => void) | null = null

// ── Bootstrap ─────────────────────────────────────────────────────────────

/**
 * Bootstrap the subscription listeners. Call once in App.vue.
 *
 * Listens to auth state changes and reactively mirrors both the
 * customers/{uid}/payments collection (for supporter status) and
 * customers/{uid}/subscriptions (for Stripe Pro status).
 */
export function initSubscription(): void {
  getAuthProvider().onAuthStateChanged((user) => {
    _unsubPayments?.()
    _unsubStripe?.()
    _unsubPayments = null
    _unsubStripe = null

    if (!user) {
      _subscription.value = { tier: 'free', hasSupporterBadge: false, totalPaidCents: 0 }
      _loading.value = false
      return
    }

    let latestTotalPaidCents = 0
    let latestStripeStatus: SubscriptionState['stripeStatus'] | undefined
    let latestPriceId: string | undefined
    let latestInterval: 'month' | 'year' | undefined
    let latestPeriodEnd: string | undefined

    function reconcile() {
      const isActivePro =
        latestStripeStatus !== undefined &&
        ACTIVE_STRIPE_STATUSES.has(latestStripeStatus)

      _subscription.value = {
        tier: isActivePro ? 'pro' : 'community',
        hasSupporterBadge: latestTotalPaidCents >= BADGE_MIN_CENTS,
        totalPaidCents: latestTotalPaidCents,
        stripeStatus: latestStripeStatus,
        stripePriceId: latestPriceId,
        stripeInterval: latestInterval,
        currentPeriodEnd: latestPeriodEnd,
      }
      _loading.value = false
    }

    // ── 1. Listen to PWYW payment history ─────────────────────────────────
    _unsubPayments = getServiceFactory()
      .getStripeService()
      .subscribeToPayments(user.uid, (payments) => {
        latestTotalPaidCents = payments.reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0,
        )
        reconcile()
      })

    // ── 2. Listen to Stripe subscription (Pro tier) ────────────────────────
    _unsubStripe = getServiceFactory()
      .getStripeService()
      .subscribeToActiveSubscriptions(user.uid, (subscriptions) => {
        if (subscriptions.length === 0) {
          latestStripeStatus = undefined
          latestPriceId = undefined
          latestInterval = undefined
          latestPeriodEnd = undefined
        } else {
          const sub = subscriptions[0]
          latestStripeStatus = sub.status as SubscriptionState['stripeStatus']

          const priceRef = sub.price as { id?: string } | undefined
          latestPriceId = priceRef?.id ?? undefined

          const items = sub.items as Array<{ price?: { recurring?: { interval?: string } } }> | undefined
          latestInterval = items?.[0]?.price?.recurring?.interval as 'month' | 'year' | undefined

          const periodEnd = sub.current_period_end as { toDate?: () => Date } | undefined
          latestPeriodEnd = periodEnd?.toDate?.()?.toISOString() ?? undefined
        }
        reconcile()
      })
  })
}

// ── Composable ────────────────────────────────────────────────────────────

export function useSubscription() {
  const tier = computed(() => _subscription.value.tier)
  const hasSupporterBadge = computed(() => _subscription.value.hasSupporterBadge)
  const totalPaidCents = computed(() => _subscription.value.totalPaidCents)
  const stripeStatus = computed(() => _subscription.value.stripeStatus)
  const currentPeriodEnd = computed(() => _subscription.value.currentPeriodEnd)
  const stripeInterval = computed(() => _subscription.value.stripeInterval)
  const isLoading = computed(() => _loading.value)

  const isProOrAbove = computed(() => TIER_RANK[tier.value] >= TIER_RANK['pro'])
  const isCommunityOrAbove = computed(() => TIER_RANK[tier.value] >= TIER_RANK['community'])

  /** True when the Pro subscription is in a grace period after a failed payment */
  const isPastDue = computed(() => stripeStatus.value === 'past_due')

  /**
   * Returns true if the current user has access to the given feature.
   * This is the primary gating method — use this in components and services.
   */
  function can(feature: GatedFeature): boolean {
    const required = TIER_REQUIREMENTS[feature]
    const meetsRank = TIER_RANK[tier.value] >= TIER_RANK[required]
    if (!meetsRank) return false

    // Branding removal requires a specific cumulative payment threshold
    if (feature === 'remove_branding') {
      return _subscription.value.totalPaidCents >= BRANDING_MIN_CENTS
    }

    return true
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
    hasSupporterBadge: readonly(hasSupporterBadge),
    totalPaidCents: readonly(totalPaidCents),
    stripeStatus: readonly(stripeStatus),
    stripeInterval: readonly(stripeInterval),
    currentPeriodEnd: readonly(currentPeriodEnd),
    isLoading: readonly(isLoading),
    isProOrAbove,
    isCommunityOrAbove,
    isPastDue,
    can,
    lockReason,
    TIER_REQUIREMENTS,
  }
}
