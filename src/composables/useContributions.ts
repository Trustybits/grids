/**
 * useContributions — current user's PWYW payment history aggregate
 *
 * Subscribes to `customers/{uid}/payments` (written by the firestore-stripe-
 * payments extension) and exposes the cumulative amount the signed-in user
 * has contributed via the Supporter checkout flow.
 *
 * This is intentionally separate from useBadges and useTier:
 *
 *   - useBadges → public, all users, derived from `userBadges/{uid}`
 *                 (the badge has been formally granted server-side)
 *   - useTier   → tier/feature gating (community/pro)
 *   - useContributions → current user only; raw Stripe data; private
 *                        (extension-written, only owner can read)
 *
 * Usage:
 *
 *   initContributions()  // call once in App.vue
 *   const { totalPaidCents } = useContributions()
 */

import { computed, ref, readonly } from 'vue'
import { getAuthProvider } from '@/auth/AuthProviderSingleton'
import { getServiceFactory } from '@/services/ServiceFactorySingleton'

// ── Module-level reactive state ────────────────────────────────────────────

const _totalPaidCents = ref(0)
const _loading = ref(true)

let _unsubAuth: (() => void) | null = null
let _unsubPayments: (() => void) | null = null

// ── Bootstrap ─────────────────────────────────────────────────────────────

/**
 * Bootstrap the contributions listener. Call once in App.vue.
 * Listens to auth state changes and subscribes to the current user's payments.
 */
export function initContributions(): void {
  _unsubAuth?.()
  _unsubAuth = getAuthProvider().onAuthStateChanged((user) => {
    _unsubPayments?.()
    _unsubPayments = null

    if (!user) {
      _totalPaidCents.value = 0
      _loading.value = false
      return
    }

    _loading.value = true
    _unsubPayments = getServiceFactory()
      .getStripeService()
      .subscribeToPayments(user.uid, (payments) => {
        _totalPaidCents.value = payments.reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0,
        )
        _loading.value = false
      })
  })
}

// ── Composable ────────────────────────────────────────────────────────────

export function useContributions() {
  const totalPaidCents = computed(() => _totalPaidCents.value)
  const isLoading = computed(() => _loading.value)
  const hasContributed = computed(() => _totalPaidCents.value > 0)

  return {
    totalPaidCents: readonly(totalPaidCents),
    isLoading: readonly(isLoading),
    hasContributed,
  }
}
