# Account Email Change and Recovery

Maintainer-only notes on how users change their account email, and the procedure for helping a user
who has **lost access to their old inbox**. The whole feature sits behind the `account-email-change`
feature flag (`FEATURE_FLAGS.ACCOUNT_EMAIL_CHANGE`).

## How a normal change works

Users open **Email** in the account menu (desktop user menu or the Early Access drawer) and enter a
new address. The app calls Firebase Auth's `verifyBeforeUpdateEmail`:

1. Firebase emails a verification link to the **new** address. Nothing changes until it is opened.
2. When it is opened, Firebase applies the change and emails the **old** address a notice with a
   revert link ("Email address change" template).
3. The verification page continues to `/account/change-email?done=1`, which reloads the user, syncs
   `users/{uid}.email`, and shows a toast. If the session was revoked by the change, the user is
   signed out and sent to `/login?emailChanged=1`.

Firebase only allows this shortly after a sign-in. If the session is older, the app asks the user to
confirm it's them first: a Google popup for Google accounts, or a sign-in link sent to the *current*
address for email-link accounts (it lands on `/account/change-email` and then sends the verification).

## When the user has lost the old inbox

An email-link user who can't receive mail at their old address can't re-authenticate, and the Firebase
console has no field for editing a user's email. They use the lost-access path instead:

1. **The user files a request.** From the change-email dialog ("Lost access to …?") or from
   `/login` → "Can't access your email?" (`/account/recover`, works signed out). The request is
   stored in `emailRecoveryRequests` and posted to the user-activity Discord channel. The endpoint
   returns the same response whether or not an account exists.
2. **You verify identity out of band.** A recovery code is a one-time sign-in to the account, so do
   not issue one on a Discord message alone. Good signals: the Discord account they've used with us
   before, their handle and grid names/content, roughly when they signed up. If the request shows
   "No account found", the email they typed doesn't match an account.
3. **You issue a code** with the admin script, then send it privately (e.g. Discord DM):

   ```bash
   cd apps/firebase-functions
   npm run recovery:issue -- requests                                 # list pending requests
   npm run recovery:issue -- issue <uid|email> --request <requestId>  # prints the code once
   npm run recovery:issue -- reject <requestId>                       # decline a request
   npm run recovery:issue -- revoke <uid|email>                       # kill unused codes
   ```

   Requires `GOOGLE_APPLICATION_CREDENTIALS` (service account key). Codes are single-use, expire after
   24h (`--hours` to change, max 168), and are stored only as a SHA-256 hash.
4. **The user enters the code** under "I have a code". It signs them in (which satisfies the recent
   sign-in requirement), then they enter the new address and confirm it from the new inbox as usual.
   The code never changes the email by itself.

## Production setup checklist

- Firebase console → Authentication → Templates: review **Email address change** (sent to the old
  address, with the revert link) and **Verify email before change**; set the sender name.
- Authentication → Settings → Authorized domains must include the app domain (already true for
  email-link sign-in), since `continueUrl` points back to the app.
- Grant the Cloud Functions runtime service account **Service Account Token Creator**
  (`iam.serviceAccounts.signBlob`) so `redeemEmailRecoveryCode` can call `createCustomToken`.
- Production Firestore rules (private repo): no client read or write on `emailRecoveryRequests` or
  `emailRecoveryCodes`. Only the Admin SDK touches them.
- Not synced automatically: the Stripe customer email. Users can change it in the billing portal.

## Code map

| Piece | Location |
| --- | --- |
| Auth contract (`requestEmailChange`, re-auth, `signInWithRecoveryToken`, `AuthProviderError`) | `packages/contracts/src/auth/AuthProvider.ts` |
| Firebase implementation | `packages/pro/src/auth/firebase/FirebaseAuthProvider.ts` |
| Change-email dialog and recovery panel | `apps/web/src/components/modal/ChangeEmailModal.vue`, `apps/web/src/components/account/EmailRecoveryPanel.vue` |
| Landing pages | `apps/web/src/pages/ChangeEmailPage.vue` (`/account/change-email`), `apps/web/src/pages/AccountRecoveryPage.vue` (`/account/recover`) |
| Callables | `apps/firebase-functions/src/accounts/onCall_requestEmailRecovery.ts`, `onCall_redeemEmailRecoveryCode.ts` |
| Code helpers (reusable by a future admin portal) | `apps/firebase-functions/src/accounts/utils_emailRecovery.ts` |
| Discord ping | `apps/firebase-functions/src/notifications/onTrigger_emailRecoveryRequestCreated.ts` |
| Admin script | `apps/firebase-functions/src/scripts/issueEmailRecoveryCode.ts` |

Local testing: in stubbed mode the fixed code `STUB-0000-CODE` always redeems. Against the emulators,
run the script with `GCLOUD_PROJECT=demo-grids-local FIRESTORE_EMULATOR_HOST=127.0.0.1:3076
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9076`, and read the verification links from
`http://127.0.0.1:9076/emulator/v1/projects/demo-grids-local/oobCodes`.
