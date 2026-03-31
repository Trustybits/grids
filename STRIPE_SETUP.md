# Stripe Setup Guide

This guide walks you through setting up Stripe payments for Grids: the PWYW Supporter tier and the Pro subscription (monthly + annual).

## Prerequisites

- A [Stripe account](https://stripe.com) (free to create)
- Firebase CLI installed and authenticated
- The Firebase Extension installed (step 2 below)

---

## Step 1 — Create your Stripe account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete business verification (required before going live)
3. Note your **Publishable key** and **Secret key** from **Developers → API keys**

---

## Step 2 — Install the Firebase Extension

The `firestore-stripe-payments` extension handles webhooks, syncs subscription state to Firestore, and creates Stripe Customer Portal sessions automatically.

```bash
firebase ext:install stripe/firestore-stripe-payments
```

When prompted, provide:
- **Stripe API key**: your **secret** key (starts with `sk_live_` or `sk_test_`)
- **Customers collection**: `customers`
- **Sync new users to Stripe**: Yes
- **Automatically delete Stripe customer data**: depends on your privacy policy

After installation, the extension creates a webhook endpoint in your Stripe dashboard. **Copy the webhook signing secret** from Stripe → Developers → Webhooks and save it — you'll need it to test locally.

---

## Step 3 — Create the Pro product in Stripe

1. Go to **Stripe Dashboard → Products → Add product**
2. Name: `Grids Pro`
3. Description: `Custom domains, advanced analytics, AI suggestions, and more.`
4. Add a **Monthly** price:
   - Model: Recurring
   - Price: `$8.00 / month`
   - Save the **Price ID** (looks like `price_abc123`) → add to `.env` as `VITE_STRIPE_PRO_MONTHLY_PRICE_ID`
5. Add an **Annual** price on the same product:
   - Model: Recurring
   - Price: `$72.00 / year`
   - Save the **Price ID** → add to `.env` as `VITE_STRIPE_PRO_ANNUAL_PRICE_ID`

---

## Step 4 — Configure the Stripe Customer Portal

The Customer Portal lets Pro users manage their subscription, update payment methods, and cancel.

1. Go to **Stripe Dashboard → Settings → Billing → Customer Portal**
2. Enable the portal
3. Under **Business information**, add your support email and privacy/terms URLs
4. Enable **Cancel subscriptions** and **Update subscriptions** (so users can switch monthly ↔ annual)
5. Save the settings

---

## Step 5 — Set environment variables

Add to your `.env` (local) and to **Vercel → Project Settings → Environment Variables** (production):

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PRO_MONTHLY_PRICE_ID=price_...
VITE_STRIPE_PRO_ANNUAL_PRICE_ID=price_...
```

> **Note**: Only `VITE_STRIPE_PUBLISHABLE_KEY` is used client-side. The secret key is only used by the Firebase Extension (set during `ext:install`). Never put your Stripe secret key in `.env` files or anywhere client-side.

---

## Step 6 — Test with Stripe test mode

Before going live, test with Stripe's built-in test cards:

| Scenario | Card number |
|---|---|
| Successful payment | `4242 4242 4242 4242` |
| Payment requires auth | `4000 0025 0000 3155` |
| Card declined | `4000 0000 0000 9995` |
| Subscription past due | `4000 0000 0000 0341` |

Use any future expiry date and any 3-digit CVC.

To test locally with the Firebase emulators:
```bash
firebase emulators:start --only firestore,auth,functions
```

---

## Step 7 — Grant supporter badge on payment (webhook)

When a user completes a PWYW supporter payment, you need to set `hasSupporterBadge: true` on their Firestore user doc. Add this Cloud Function to `functions/src/index.ts`:

```typescript
// Triggered by the Stripe Extension when a one-time payment succeeds
export const onSupporterPayment = functions.firestore
  .document('customers/{uid}/payments/{paymentId}')
  .onCreate(async (snap, context) => {
    const payment = snap.data();
    if (payment.status !== 'succeeded') return;
    if (payment.metadata?.type !== 'supporter') return;

    const uid = context.params.uid;
    await admin.firestore().doc(`users/${uid}`).update({
      hasSupporterBadge: true,
    });
    logger.info(`Granted supporter badge to ${uid}`);
  });
```

---

## How the checkout flow works

```
User clicks "Upgrade to Pro"
  ↓
useStripeCheckout.checkoutPro('month')
  ↓
StripeService.createProCheckoutSession('month')
  ↓
Write doc to customers/{uid}/checkout_sessions
  ↓
Firebase Extension creates Stripe Checkout Session
  ↓
Extension writes url field back to the doc
  ↓
We listen with onSnapshot, grab the URL
  ↓
window.location.assign(url) → Stripe-hosted checkout page
  ↓
User pays → Stripe fires webhook → Extension writes to
  customers/{uid}/subscriptions (status: 'active')
  ↓
useSubscription onSnapshot fires → tier updates to 'pro'
  ↓
All can('pro_feature') checks return true automatically
```

---

## Going live checklist

- [ ] Stripe account fully verified
- [ ] Customer Portal configured with correct URLs
- [ ] Webhook endpoint active and receiving events in Stripe Dashboard
- [ ] Both Price IDs set in Vercel environment variables
- [ ] Tested full checkout flow in test mode
- [ ] `hasSupporterBadge` Cloud Function deployed
- [ ] Switched Stripe keys from `sk_test_` / `pk_test_` to `sk_live_` / `pk_live_`
