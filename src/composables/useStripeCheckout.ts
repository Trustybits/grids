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
 *   await checkoutSupporter(1)          // minimum supporter amount
 */

import { ref, readonly } from 'vue'
import { getAuthProvider } from '@/auth/AuthProviderSingleton'
import { getServiceFactory } from '@/services/ServiceFactorySingleton'
import {
  createSupporterCheckoutSession,
  createProCheckoutSession,
  createCustomerPortalSession,
} from '@/services/StripeService'
import { usePostHog } from '@/composables/usePostHog'

// ── Constants ──────────────────────────────────────────────────────────────

/** Minimum supporter amount in cents ($1.00) */
const SUPPORTER_MIN_CENTS = 100

// ── Module-level state (shared across all composable instances) ────────────

const _loading = ref(false)
const _error = ref<string | null>(null)

export function useStripeCheckout() {
  const { capture } = usePostHog()

  function setLoading(val: boolean) {
    _loading.value = val
    if (val) _error.value = null
  }

  async function checkoutPro(interval: 'month' | 'year'): Promise<void> {
    setLoading(true)
    try {
      capture('checkout_started', { type: 'pro', interval })
      const url = await getServiceFactory().getStripeService().createProCheckoutSession(interval)
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
   * - amount < $1.00: rejected (badge requires payment)
   * - amount >= $1.00: redirects to Stripe Checkout
   *
   * @param amountDollars - Dollar amount chosen by user (e.g. 5 = $5.00)
   */
  async function checkoutSupporter(amountDollars: number): Promise<void> {
    setLoading(true)
    try {
      const amountCents = Math.round(amountDollars * 100)

      if (amountCents < SUPPORTER_MIN_CENTS) {
        const message = 'Supporter badge requires at least $1.'
        _error.value = message
        capture('checkout_error', { type: 'supporter', error: message })
        return
      }

      capture('checkout_started', { type: 'supporter', amount_cents: amountCents })
      const url = await getServiceFactory().getStripeService().createSupporterCheckoutSession(amountCents)
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

  async function openCustomerPortal(): Promise<void> {
    setLoading(true)
    try {
      capture('customer_portal_opened')
      const url = await getServiceFactory().getStripeService().createCustomerPortalSession()
      window.location.assign(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not open billing portal.'
      _error.value = message
    } finally {
      setLoading(false)
    }
  }

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

