/**
 * useSubscription — tier-based feature gating composable
 *
 * Reads subscription state from two Firestore sources:
 *  1. users/{uid}              → hasSupporterBadge (PWYW one-time payment)
 *  2. customers/{uid}/subscriptions → Stripe subscription status (Pro tier)
 *     Written automatically by the firestore-stripe-payments Firebase Extension
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
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   const { can, tier, lockReason } = useSubscription()
 *
 *   // Gate a feature in a component
 *   <button v-if="can('custom_domain')">Set Custom Domain</button>
 *
 *   // Show an upgrade prompt
 *   <UpgradePrompt v-else :reason="lockReason('custom_domain')" />
 */

import { computed, ref, readonly } from 'vue'
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'

// ── Tier definition ────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'community' | 'pro'

export interface SubscriptionState {
  tier: SubscriptionTier
  /** True if the user made a PWYW payment OR claimed the free badge */
  hasSupporterBadge: boolean
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
  create_grid: 'community',
  publish_grid: 'community',
  use_templates: 'community',
  use_widgets: 'community',
  basic_analytics: 'community',
  claim_slug: 'community',
  custom_background: 'community',
  extra_grids: 'community',
  advanced_themes: 'community',
  remove_branding: 'community',   // community + hasSupporterBadge
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

/** Features that also require hasSupporterBadge (PWYW) */
const REQUIRES_SUPPORTER: Set<GatedFeature> = new Set(['remove_branding'])

/** Stripe statuses that grant Pro access */
const ACTIVE_STRIPE_STATUSES = new Set(['active', 'trialing'])

// ── Module-level reactive state ────────────────────────────────────────────
// Shared across all composable instances — only one Firestore listener runs.

const _subscription = ref<SubscriptionState>({
  tier: 'free',
  hasSupporterBadge: false,
})
const _loading = ref(true)

let _unsubUser: (() => void) | null = null
let _unsubStripe: (() => void) | null = null

// ── Bootstrap ─────────────────────────────────────────────────────────────

/**
 * Bootstrap the subscription listener. Call once in App.vue (inside onMounted
 * or at the top of <script setup>).
 *
 * Listens to Firebase Auth state changes and reactively mirrors both the
 * users/{uid} doc (for hasSupporterBadge) and the customers/{uid}/subscriptions
 * collection (for Stripe Pro status).
 */
export function initSubscription(): void {
  const auth = getAuth()

  onAuthStateChanged(auth, (user) => {
    // Tear down previous listeners
    _unsubUser?.()
    _unsubStripe?.()
    _unsubUser = null
    _unsubStripe = null

    if (!user) {
      _subscription.value = { tier: 'free', hasSupporterBadge: false }
      _loading.value = false
      return
    }

    // ── 1. Listen to user doc for hasSupporterBadge ──────────────────────
    let latestBadge = false
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
        hasSupporterBadge: latestBadge,
        stripeStatus: latestStripeStatus,
        stripePriceId: latestPriceId,
        stripeInterval: latestInterval,
        currentPeriodEnd: latestPeriodEnd,
      }
      _loading.value = false
    }

    _unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        latestBadge = snap.data()?.hasSupporterBadge ?? false
      }
      reconcile()
    })

    // ── 2. Listen to Stripe subscription (from Firebase Extension) ────────
    // The Extension writes active subscriptions to customers/{uid}/subscriptions.
    // We query for the most recent active/trialing subscription.
    const subsQuery = query(
      collection(db, 'customers', user.uid, 'subscriptions'),
      where('status', 'in', ['active', 'trialing', 'past_due']),
      limit(1)
    )

    _unsubStripe = onSnapshot(subsQuery, (snap) => {
      if (snap.empty) {
        latestStripeStatus = undefined
        latestPriceId = undefined
        latestInterval = undefined
        latestPeriodEnd = undefined
      } else {
        const sub = snap.docs[0].data()
        latestStripeStatus = sub.status as SubscriptionState['stripeStatus']

        // Price reference — Extension stores as a Firestore DocumentReference
        const priceRef = sub.price
        latestPriceId = priceRef?.id ?? undefined

        // Extract interval from price metadata if available
        latestInterval = sub.items?.[0]?.price?.recurring?.interval ?? undefined

        // current_period_end is a Firestore Timestamp
        const periodEnd = sub.current_period_end
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
    if (REQUIRES_SUPPORTER.has(feature) && !hasSupporterBadge.value) return false
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
    if (REQUIRES_SUPPORTER.has(feature)) return 'supporter'
    if (required === 'pro') return 'pro'
    return null
  }

  return {
    tier: readonly(tier),
    hasSupporterBadge: readonly(hasSupporterBadge),
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
