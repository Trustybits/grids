# Production Runtime

This page is for maintainers who work with production Firebase-backed runtime behavior.

`packages/pro` lives in this public repository. It is production-oriented code, not a private package. Ordinary contributors can use it with local Firebase emulators, but they should not need production Firebase config to run the app.

## Runtime Boundary

`packages/pro` exports `ProRuntime`. When `VITE_USE_FIREBASE=true`, `apps/web` loads the runtime through `apps/web/src/pro/loadProRuntime.ts`.

If valid Firebase config is present, `ProRuntime` registers Firebase-backed implementations for:

- DAO factory
- DB utilities
- Auth provider

If config is absent, the runtime reports that it is unavailable and the app falls back to stubs.

## Production Build Guard

`packages/pro/scripts/checkFirebaseConfig.mjs` is a deployment guard. When `REQUIRE_FIREBASE_CONFIG` is set, it fails the build unless Firebase config is present and `VITE_USE_FIREBASE=true`.

Use that guard only in deploy environments where a backend-less app would be a release error.

## Public Documentation Rule

Do not document private credentials or deploy-specific secrets in public docs. Public docs should explain the production-runtime boundary and the contributor-safe workflow, not expose operational secrets.
