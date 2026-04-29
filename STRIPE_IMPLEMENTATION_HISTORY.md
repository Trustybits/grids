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
- No obvious frontend supporter entitlement display yet
  - hard to visually verify idempotency/upgrade state at UI layer

---

## Current Known Gaps / To-Do

1. **Verify webhook sync end-to-end**
   - Confirm Stripe event deliveries are consistently 2xx
   - Confirm `customers/{uid}/payments` docs are consistently created for successful supporter payments
   - Confirm no `handleWebhookEvents` errors in logs

2. **Add basic frontend supporter state visibility**
   - Show at least one clear supporter indicator in UI
   - Makes payment outcome/idempotency verification practical

3. **Supporter amount tier model update**
   - Revisit `$0` flow and tier unlock logic
   - Implement amount-based entitlement behavior intentionally

4. **Billing state contract (new planned item)**
   - Add a normalization layer/doc for billing state consumed by frontend
   - Reduce cross-collection confusion between `users/{uid}` and `customers/{uid}`

5. **Idempotency verification pass**
   - Re-run repeat payment scenarios once supporter UI state is visible
   - Confirm no duplicate/bad entitlement transitions

6. **Pro checkout enablement/testing**
   - Once enabled, validate monthly/annual checkout + subscription sync paths

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

