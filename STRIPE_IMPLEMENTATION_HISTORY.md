# Stripe Implementation History (Grids)

This document records what we actually did to get Stripe integration working in this project, including key decisions, errors, and the current state.

It is intentionally a project journal, not a generic setup checklist.

---

## Scope

- Supporter (pay-what-you-want) checkout flow from `HomePage` pricing section
- Stripe checkout session creation via Firebase `firestore-stripe-payments` extension
- Firestore data model and rules updates needed for checkout flow
- Test-mode validation runs and observed edge cases

---

## Architecture Decisions Made

1. **Stripe extension-backed checkout flow**
   - Frontend writes to `customers/{uid}/checkout_sessions`
   - Extension creates Stripe Checkout Session and writes `url` back
   - Frontend subscribes to session doc and redirects browser to Stripe URL

2. **Billing data in separate `customers` collection**
   - Kept app profile data in `users/{uid}`
   - Kept Stripe/extension data in `customers/{uid}` and extension subcollections
   - Firestore rules updated to allow owner read/write on `checkout_sessions` and read-only on extension-managed payment/subscription data

3. **Pricing UX merged into landing page**
   - `/pricing` route now renders `HomePage` pricing section
   - Legacy standalone pricing component was removed

4. **Billing state contract implemented (Option A)**
   - Frontend now derives supporter entitlements from `customers/{uid}/payments`
   - `useSubscription` aggregates succeeded payment amounts into `totalPaidCents`
   - Supporter badge and amount thresholds are now computed from cumulative paid amount (not a manually-set user flag)

5. **User menu billing state section added**
   - User menu now shows `Free Account` + `Upgrade` (free users)
   - User menu now shows `Supporter` or `Pro Plan` chip + `Manage Billing` (paid users)

6. **$0 flow behavior updated**
   - `$0` removed from presets, but still available through Custom input
   - Custom amount defaults to `0`
   - `$0` path continues for free without Stripe redirect

---

## Configuration and Deployment Timeline (Observed)

### 1) Extension install and configuration

- Installed extension instance:
  - `firestore-stripe-payments-ljn2`
- Region:
  - `us-west3`
- Collections:
  - `customers`
  - `products`
  - `configuration`
- Sync mode:
  - `SYNC_USERS_ON_CREATE=Sync`
- Extension env file generated:
  - `extensions/firestore-stripe-payments-ljn2.env`

### 2) Extension deployment

- First extension deploy encountered Cloud Build resource error on `onUserDeleted`
- Immediate redeploy attempts blocked by ongoing operation
- After wait/retry, instance reached `ACTIVE` and deployment/configuration completed

### 3) Firestore rules alignment

- Added/confirmed Stripe extension rules section in `firestore.rules`:
  - owner can read `customers/{uid}`
  - owner can read/write `customers/{uid}/checkout_sessions/{id}`
  - owner read-only for `subscriptions` and `payments`

### 4) Frontend pricing + checkout wiring

- Supporter button was temporarily disabled during early setup
- Re-enabled to call `handleSupporterCheckout` once Stripe testing resumed
- Pro checkout remains intentionally not enabled in the current UX

### 5) Webhook endpoint setup

- Initially, Stripe Developers > Webhooks had no endpoint
- Added endpoint destination for extension webhook handler function
- Webhook signing secret configuration was originally skipped during install; later revisited

---

## Errors/Challenges Encountered and Resolutions

### A) `insufficient privileges` on support checkout

**Symptom**
- Support button produced Firestore permission error

**Cause**
- Firestore rules deployment mismatch / rules not active for current project state

**Resolution**
- Deploy/align Firestore rules for checkout session write path

---

### B) `Cannot read properties of null (reading 'stripeId')`

**Symptom**
- Checkout session docs created under `customers/{uid}/checkout_sessions`, but session doc contained error:
  - `Cannot read properties of null (reading 'stripeId')`

**Cause**
- Extension failed to create/link Stripe customer for uid
- `createCustomer` logs showed:
  - `Expired API Key provided` for extension secret key

**Resolution**
- Rotate/update Stripe API key secret used by extension
- Reconfigure/redeploy extension to use valid key
- Re-test user/customer sync path
- Root cause detail: key value was updated in Firebase UI, but a required save action was initially missed; once saved correctly, checkout customer creation recovered

---

### C) Missing `payments` docs despite success redirect

**Symptom**
- Browser returned to success URL but no `customers/{uid}/payments` doc observed

**Likely cause**
- Webhook endpoint/secret/event delivery not fully configured at that point

**Action taken**
- Added webhook destination and began configuring webhook secret flow

**Resolution / latest status**
- Webhook destination was created in Stripe
- Webhook signing secret was configured on the extension instance
- Baseline event set was enabled (recommended starter events)
- `customers/{uid}/payments` docs are now appearing after successful runs

---

### D) Intermittent checkout timeouts before redirect

**Symptom**
- Clicking Support occasionally timed out and never opened Stripe

**Notes**
- Could be extension cold starts (`CREATE_CHECKOUT_SESSION_MIN_INSTANCES=0`)
- Could be temporary Firebase/Cloud Functions responsiveness issues

**Current mitigation**
- None yet (observational note)

---

## Test Results Logged So Far

### Completed tests

- Successful test card flow (`4242`) reached success URL
- Card decline scenario handled correctly
- 3DS/auth-required scenario tested for both success and failure handling
- Cancel flow returned to `/pricing` correctly
- Multiple successful payments attempted on same account
- Successful runs now produce `payments` documents after webhook configuration

### Behavioral observations

- Checkout sessions can exist in Firestore for incomplete/canceled flows
  - This is expected
- Frontend supporter entitlement display is now present in user menu
  - billing state still needs full end-to-end validation under repeated payment scenarios

---

## Testing Checklist

Billing contract (Option A) and user menu billing section are now implemented; the following tests validate behavior and regression risk.

---

### Section 1 — User Menu Billing Display

- [ ] Log in as a free (never-paid) user — user menu shows "Free Account" label with "Upgrade" button
- [ ] "Upgrade" navigates to `/pricing` and closes the menu
- [ ] Log in as a confirmed supporter — menu shows orange "SUPPORTER" chip with "Manage Billing" button
- [ ] Log in as a Pro subscriber — menu shows purple "PRO PLAN" chip with "Manage Billing" button
- [ ] "Manage Billing" navigates to `/pricing` and closes the menu
- [ ] Billing section state updates immediately after a new payment (no manual refresh required)

---

### Section 2 — $0 Custom Amount Path

- [ ] Preset buttons do not include `$0` (only available through Custom input)
- [ ] Click "Custom" on pricing card — input defaults to `0`
- [ ] Button label reads "Continue for Free" when amount is `0`
- [ ] Clicking "Continue for Free" navigates to `/` with no Stripe redirect and no error message
- [ ] Entering any positive number immediately changes button label back to "Support for $X"
- [ ] User who followed the $0 path is treated as a free/community account (no supporter badge)

---

### Section 3 — Supporter Checkout Flow (Happy Path)

- [ ] Select `$1` preset → click button → redirected to Stripe Checkout
- [ ] Complete payment with test card `4242 4242 4242 4242`
- [ ] Stripe shows successful charge in test dashboard
- [ ] Browser redirected to success URL after payment
- [ ] `customers/{uid}/payments` document appears in Firestore with `status: succeeded` and `amount: 100`
- [ ] Webhook delivery shows `2xx` response in Stripe dashboard event logs
- [ ] After billing state sync, user menu shows "SUPPORTER" chip (no manual refresh required)
- [ ] Select `$5` preset → complete payment → cumulative total increases to `$6`
- [ ] Complete a `$10` total threshold → branding removal unlocks (once feature is wired up)

---

### Section 4 — Checkout Edge Cases

- [ ] Custom amount `$0.25` (below Stripe's `$0.50` floor) → error shown, no redirect
- [ ] Cancel Stripe checkout → redirected back to `/pricing`, no payment recorded, no badge set, no error shown
- [ ] Use declined card `4000 0000 0000 0002` → Stripe shows failure, no payment doc written in Firestore
- [ ] Use 3DS card `4000 0025 0000 3155` → complete auth challenge → payment succeeds and docs appear
- [ ] Use 3DS card → cancel auth challenge → payment fails cleanly, no doc written
- [ ] Multiple payments on same account → each creates a new `payments` doc, cumulative total grows correctly

---

### Section 5 — Idempotency and State Consistency

- [ ] Complete two separate `$1` payments as the same user → both docs present, cumulative total is `$2`
- [ ] Reload app after payment → billing state (badge/tier) survives page reload
- [ ] Log out and log back in → billing state is restored correctly
- [ ] Open app in a second browser tab after payment → state is consistent across tabs

---

### Section 6 — Pro Plan (Future / Not Yet Enabled)

- [ ] Monthly Pro checkout → subscription created in Stripe and `customers/{uid}/subscriptions` doc appears
- [ ] Annual Pro checkout → subscription created with annual interval
- [ ] Active Pro subscriber → user menu shows "PRO PLAN" chip
- [ ] Subscription cancels (via Customer Portal or test) → status transitions to `canceled`, chip reverts to previous tier
- [ ] `past_due` subscription → UI reflects degraded state without full Pro access

---

## Current Known Gaps / To-Do

1. **Verify webhook sync end-to-end**
   - Confirm Stripe event deliveries are consistently 2xx
   - Confirm `customers/{uid}/payments` docs are consistently created for successful supporter payments
   - Confirm no `handleWebhookEvents` errors in logs

2. **Run full billing state validation pass (Option A contract)**
   - Verify cumulative `totalPaidCents` calculation across multiple successful payments
   - Verify `$1+` threshold unlock (supporter badge) and `$10+` threshold unlock (branding removal)
   - Verify `$0` custom flow keeps account in free/community state

3. **Idempotency verification pass**
   - Re-run repeat payment scenarios for the same uid
   - Confirm no duplicate/bad entitlement transitions and no state regressions after reload/sign-out

4. **Pro checkout enablement/testing**
   - Once enabled, validate monthly/annual checkout + subscription sync paths

5. **Future migration option (Option B)**
   - Consider moving aggregation to a Firestore trigger that writes `totalPaidCents` to `users/{uid}`
   - Keep `useSubscription` API stable while swapping data source implementation

---

## Relevant Files

- `src/components/HomePage.vue`
- `src/composables/useStripeCheckout.ts`
- `src/services/StripeService.ts`
- `src/dao/firestore/FirestoreCustomerDao.ts`
- `firestore.rules`
- `firestore-stripe-payments-setup.local.md`
- `extensions/firestore-stripe-payments-ljn2.env`
- `STRIPE_SETUP.md`

