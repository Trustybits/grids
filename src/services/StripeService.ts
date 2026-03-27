/**
 * StripeService — payment checkout via the firestore-stripe-payments Extension
 *
 * How it works:
 *  1. We write a checkout session config doc to customers/{uid}/checkout_sessions
 *  2. The Firebase Extension picks it up, creates a Stripe Checkout Session,
 *     and writes the `url` field back to the same document
 *  3. We listen with onSnapshot, grab the URL, and redirect
 *
 * Prerequisites:
 *  - Install the "Run Payments with Stripe" Firebase Extension
 *  - Set VITE_STRIPE_PRO_MONTHLY_PRICE_ID and VITE_STRIPE_PRO_ANNUAL_PRICE_ID
 *    to the Stripe Price IDs for your Pro plans
 *  - See STRIPE_SETUP.md for full setup instructions
 */

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '@/firebase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CheckoutSessionConfig {
  /** Stripe Price ID — for fixed-price subscriptions */
  price?: string
  /** For custom-amount one-time payments (PWYW) */
  line_items?: Array<{
    price_data: {
      currency: string
      product_data: { name: string; description?: string }
      unit_amount: number // in cents
    }
    quantity: number
  }>
  mode: 'payment' | 'subscription'
  success_url: string
  cancel_url: string
  /** Passed through to the Stripe Session and appears on receipts */
  metadata?: Record<string, string>
  /** Allow promotion codes on the Stripe-hosted checkout page */
  allow_promotion_codes?: boolean
  /** Collect billing address */
  billing_address_collection?: 'auto' | 'required'
}

export interface StripeCheckoutError {
  message: string
  code?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function requireUser() {
  const user = getAuth().currentUser
  if (!user) throw new Error('Must be signed in to initiate checkout')
  return user
}

function origin(): string {
  return window.location.origin
}

/**
 * Writes a checkout session doc and waits for the Extension to populate
 * the redirect URL. Resolves with the Stripe Checkout URL or rejects
 * with a StripeCheckoutError.
 *
 * Timeout: 15 seconds — if the Extension doesn't respond, we surface a
 * clear error rather than hanging forever.
 */
async function createCheckoutSession(config: CheckoutSessionConfig): Promise<string> {
  const user = requireUser()
  const sessionsRef = collection(db, 'customers', user.uid, 'checkout_sessions')
  const sessionDoc = await addDoc(sessionsRef, {
    ...config,
    created: serverTimestamp(),
  })

  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe()
      reject(new Error('Checkout session timed out. Please try again.'))
    }, 15_000)

    const unsubscribe = onSnapshot(sessionDoc, (snap) => {
      const data = snap.data()
      if (!data) return

      if (data.error) {
        clearTimeout(timeoutId)
        unsubscribe()
        reject(new Error(data.error?.message ?? 'Stripe checkout failed'))
        return
      }

      if (data.url) {
        clearTimeout(timeoutId)
        unsubscribe()
        resolve(data.url as string)
      }
    })
  })
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Creates a PWYW (pay-what-you-want) one-time payment checkout session.
 *
 * @param amountCents - Amount in cents (e.g. 500 = $5.00). Must be >= 50
 *   (Stripe minimum charge). For $0 payments, call grantFreeSupporterBadge()
 *   instead — this function will throw for amounts below 50 cents.
 */
export async function createSupporterCheckoutSession(
  amountCents: number
): Promise<string> {
  if (amountCents < 50) {
    throw new Error('Minimum Stripe charge is $0.50. For free badges, use grantFreeSupporterBadge().')
  }

  return createCheckoutSession({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Grids Supporter',
            description: 'Support Grids and unlock the Supporter badge + remove branding',
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin()}/dashboard?payment=supporter_success`,
    cancel_url: `${origin()}/pricing`,
    metadata: { type: 'supporter' },
  })
}

/**
 * Creates a Pro subscription checkout session.
 *
 * @param interval - 'month' or 'year'. The corresponding Price ID is read
 *   from VITE_STRIPE_PRO_MONTHLY_PRICE_ID or VITE_STRIPE_PRO_ANNUAL_PRICE_ID.
 */
export async function createProCheckoutSession(
  interval: 'month' | 'year'
): Promise<string> {
  const priceId =
    interval === 'month'
      ? import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID
      : import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID

  if (!priceId) {
    throw new Error(
      `Stripe price ID not configured. Set VITE_STRIPE_PRO_${interval.toUpperCase()}LY_PRICE_ID in your .env`
    )
  }

  return createCheckoutSession({
    mode: 'subscription',
    price: priceId,
    success_url: `${origin()}/dashboard?payment=pro_success`,
    cancel_url: `${origin()}/pricing`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: { type: 'pro', interval },
  })
}

/**
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription, update payment methods, or cancel.
 *
 * Requires the Customer Portal to be enabled in your Stripe Dashboard
 * (Billing → Customer Portal).
 */
export async function createCustomerPortalSession(): Promise<string> {
  const user = requireUser()

  // The Extension exposes a callable function for portal sessions
  const { getFunctions, httpsCallable } = await import('firebase/functions')
  const fns = getFunctions()
  const createPortal = httpsCallable<
    { returnUrl: string },
    { url: string }
  >(fns, 'ext-firestore-stripe-payments-createPortalLink')

  const { data } = await createPortal({
    returnUrl: `${origin()}/dashboard`,
  })

  return data.url
}

/**
 * Reference to the user's active Pro subscription document, if any.
 * Used by useSubscription to listen in real time.
 */
export function getSubscriptionsRef(uid: string) {
  return collection(db, 'customers', uid, 'subscriptions')
}

/**
 * Reference to the user's one-time payments, used to detect supporter status.
 */
export function getPaymentsRef(uid: string) {
  return collection(db, 'customers', uid, 'payments')
}
