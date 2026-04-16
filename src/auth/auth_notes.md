# AuthProvider Interface Notes

Reference for the auth refactor: what the `AuthProvider` interface needs to expose,
why each method is required, and where the existing functionality currently lives.

## Current state

Only `getCurrentUserId()` exists (`src/auth/AuthProvider.ts`). Everything else
calls Firebase directly via `auth` / `getAuth()` / `onAuthStateChanged` /
`signInWith...` / `signOut` scattered across components, composables, the router,
and services.

## Required methods

### 1. `getCurrentUserId(): string | null`
Already exists. Read-only access to the signed-in UID without exposing the
Firebase `User` object.

**Call sites still to migrate:**
- `src/stores/layout.ts:390, 419, 459, 558, 600, 620, 1393`
- `src/components/DashboardPage.vue:139, 158, 171, 191, 337, 359`
- `src/components/GridMenu.vue:144`
- `src/components/SlugSettingsPanel.vue:92, 110`
- `src/components/UseTemplateButton.vue:41`
- `src/components/AuthPage.vue:134`
- `src/components/tilecontent/ChatContent.vue:301`
- `src/composables/useFileUpload.ts` (4 sites: 60, 121, 188, 239)
- `src/services/StripeService.ts:60`
- `src/composables/useStripeCheckout.ts:143`

### 2. `getCurrentUser(): AuthUser | null`
Returns a small domain type `{ uid, email, displayName, photoURL }`. Several
call sites need more than the UID — email for the user menu and for writing
`users/{uid}.email` on login, display name / photo for UI. Keeps Firebase's
`User` type out of consumer code.

**Call sites:**
- `src/components/UserMenu.vue:29` (`user.email`)
- `src/App.vue:59-60` (writes `currentUser.email` on login)
- `src/components/tilecontent/RoadmapFeedContent.vue:411, 431`

### 3. `onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void`
Subscribe to auth state changes; returns the unsubscribe function. The app
reacts to login/logout across many components — this is the most-duplicated
Firebase call in the codebase.

**Call sites:**
- `src/App.vue:54`
- `src/router/index.ts:75`
- `src/composables/useAuthGuard.ts:11`
- `src/composables/useSubscription.ts:140`
- `src/components/NavBar.vue:53`
- `src/components/UserMenu.vue:71`
- `src/components/LeftNavBar.vue:74`
- `src/components/BottomLeftButtons.vue:41`
- `src/components/tilecontent/RoadmapFeedContent.vue:747`

### 4. `waitForAuthReady(): Promise<AuthUser | null>`
Resolves once the initial auth state has been hydrated. The router guard
needs to await the first auth resolution before deciding to redirect
(Firebase populates `currentUser` asynchronously on reload).

Today this is hand-rolled in `src/router/index.ts:65-82` with a module-level
`isAuthChecked` / `authCheckPromise`. Centralizing it avoids every caller
reinventing the "is auth hydrated yet" dance.
`src/components/tilecontent/RoadmapFeedContent.vue:743-747` has a comment
documenting the same pitfall.

### 5. `signInWithGoogle(): Promise<AuthUser>`
Wraps `GoogleAuthProvider` + `signInWithPopup` so `AuthPage` doesn't import
`firebase/auth` directly.

**Existing:** `src/components/AuthPage.vue:219-236` (`handleGoogleAuth`).

### 6. `sendEmailSignInLink(email: string, redirectUrl: string): Promise<void>`
Kicks off the passwordless magic-link flow (`sendSignInLinkToEmail` +
`actionCodeSettings`).

**Existing:** `src/components/AuthPage.vue:238-265` (`handleEmailContinue`).

### 7. `isEmailSignInLink(url: string): boolean`
### 8. `completeEmailSignIn(email: string, url: string): Promise<AuthUser>`
Complete the magic-link handshake when Firebase redirects back to `/login`.
Two methods because the component first checks whether the current URL is a
sign-in link, then completes it.

**Existing:** `src/components/AuthPage.vue:187-217`
(`maybeCompleteEmailLinkSignIn`, using `isSignInWithEmailLink` +
`signInWithEmailLink`).

### 9. `signOut(): Promise<void>`
Logout from user menu / nav bar.

**Call sites:**
- `src/components/UserMenu.vue:103`
- `src/components/NavBar.vue:59`

---

## Things to flag but NOT put on the interface

### `users/{uid}` write on login
`src/App.vue:58-65` — writes the user's email + `lastLogin` timestamp to the
`users` collection whenever auth state flips to a logged-in user. This is
user-profile persistence, belongs on the User DAO / service that's coming
next, not on `AuthProvider`.

### Slug-check / new-user redirect logic
- `src/router/index.ts:114-130` — checks whether an authenticated user has
  claimed a slug and redirects to `/dashboard` if not.
- `src/components/AuthPage.vue:125-171` (`getPostAuthRedirect`) — determines
  where to send the user after sign-in (slug modal, new-user grid, dashboard).

Profile / UX concerns, not auth. Leave them where they are and let them call
the new User service once it exists.

### `getIdToken` / access tokens
No current callers in the codebase. Skip until a real need appears.
