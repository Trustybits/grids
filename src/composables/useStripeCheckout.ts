/**
 * useStripeCheckout — Vue composable for initiating Stripe payment flows
 *
 * Wraps StripeService with reactive loading/error state and handles the
 * redirect after a successful checkout session URL is obtained.
 *
 * Usage:
 *   const { checkoutPro, checkoutSupporter, openCustomerPortal, loading, error } = useStripeCheckout()
 *
 *   // Pro subscription
 *   await checkoutPro('month')
 *
 *   // PWYW supporter (amount in dollars)
 *   await checkoutSupporter(5)          // $5
 *   await checkoutSupporter(0)          // free — grants badge without payment
 */

import { ref, readonly } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '@/firebase'
import {
  createSupporterCheckoutSession,
  createProCheckoutSession,
  createCustomerPortalSession,
} from '@/services/StripeService'
import { usePostHog } from '@/composables/usePostHog'

// ── Constants ──────────────────────────────────────────────────────────────

/** Stripe minimum charge in cents — amounts below this skip Stripe */
const STRIPE_MIN_CENTS = 50

// ── Module-level state (shared across all composable instances) ────────────

const _loading = ref(false)
const _error = ref<string | null>(null)

// ── Composable ────────────────────────────────────────────────────────────

export function useStripeCheckout() {
  const { capture } = usePostHog()

  function setLoading(val: boolean) {
    _loading.value = val
    if (val) _error.value = null
  }

  /**
   * Redirects to Stripe Checkout for a Pro subscription.
   * @param interval - 'month' or 'year'
   */
  async function checkoutPro(interval: 'month' | 'year'): Promise<void> {
    setLoading(true)
    try {
      capture('checkout_started', { type: 'pro', interval })
      const url = await createProCheckoutSession(interval)
      capture('checkout_redirecting', { type: 'pro', interval })
      window.location.assign(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      _error.value = message
      capture('checkout_error', { type: 'pro', interval, error: message })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handles PWYW supporter flow.
   * - amount = 0 (or below Stripe minimum): grants badge for free via Firestore
   * - amount > 0: redirects to Stripe Checkout
   *
   * @param amountDollars - Dollar amount chosen by user (e.g. 5 = $5.00)
   */
  async function checkoutSupporter(amountDollars: number): Promise<void> {
    setLoading(true)
    try {
      const amountCents = Math.round(amountDollars * 100)

      // Free path — no Stripe involved
      if (amountCents < STRIPE_MIN_CENTS) {
        await grantFreeSupporterBadge()
        capture('supporter_badge_granted', { amount: 0, via: 'free' })
        return
      }

      // Paid path — Stripe Checkout
      capture('checkout_started', { type: 'supporter', amount_cents: amountCents })
      const url = await createSupporterCheckoutSession(amountCents)
      capture('checkout_redirecting', { type: 'supporter' })
      window.location.assign(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      _error.value = message
      capture('checkout_error', { type: 'supporter', error: message })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Opens the Stripe Customer Portal so the user can manage their
   * subscription, update payment methods, or cancel.
   */
  async function openCustomerPortal(): Promise<void> {
    setLoading(true)
    try {
      capture('customer_portal_opened')
      const url = await createCustomerPortalSession()
      window.location.assign(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not open billing portal.'
      _error.value = message
    } finally {
      setLoading(false)
    }
  }

  /** Clear any error state */
  function clearError() {
    _error.value = null
  }

  return {
    loading: readonly(_loading),
    error: readonly(_error),
    checkoutPro,
    checkoutSupporter,
    openCustomerPortal,
    clearError,
  }
}

// ── Free badge grant ───────────────────────────────────────────────────────

/**
 * Grants the supporter badge without payment.
 * Writes directly to the user's Firestore doc — allowed by the Firestore rules
 * since hasSupporterBadge is not a protected field (unlike storageUsed).
 */
async function grantFreeSupporterBadge(): Promise<void> {
  const user = getAuth().currentUser
  if (!user) throw new Error('Must be signed in')

  const userRef = doc(db, 'users', user.uid)
  await updateDoc(userRef, { hasSupporterBadge: true })
}
