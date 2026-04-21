import { ref, readonly } from 'vue'
import { getAuthProvider } from '@/auth/AuthProviderSingleton'
import { getServiceFactory } from '@/services/ServiceFactorySingleton'
import { usePostHog } from '@/composables/usePostHog'

const STRIPE_MIN_CENTS = 50

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

  async function checkoutSupporter(amountDollars: number): Promise<void> {
    setLoading(true)
    try {
      const amountCents = Math.round(amountDollars * 100)

      if (amountCents < STRIPE_MIN_CENTS) {
        await grantFreeSupporterBadge()
        capture('supporter_badge_granted', { amount: 0, via: 'free' })
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

async function grantFreeSupporterBadge(): Promise<void> {
  const userId = getAuthProvider().getCurrentUserId()
  if (!userId) throw new Error('Must be signed in')

  await getServiceFactory().getUserService().grantSupporterBadge(userId)
}
