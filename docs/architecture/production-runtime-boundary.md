# Production Runtime Boundary

Grids has a deliberate boundary between contributor-safe app code and production-environment runtime wiring.

`packages/pro` is part of this public repository. It is not a separate private package. It contains the Firebase-backed runtime implementations used by production and by contributors who run the app against local Firebase emulators.

The goal is that ordinary contributors can run and test the app without production Firebase credentials, while production deploys can still use the same runtime package with real Firebase config.

## Public Repository Code

Public contributors can work in:

- `apps/web`
- `apps/firebase-functions`
- `packages/contracts`
- `packages/pro`
- public docs and tests

The public app should depend on interfaces and app services, not direct Firebase calls from Vue components.

## Production Runtime Package

`packages/pro` is the runtime boundary for Firebase-backed browser behavior. The package exports `ProRuntime`, which can provide:

- DAO factory
- DB utilities
- Auth provider

At app startup, `apps/web/src/main.ts` checks whether Firebase runtime is requested with `VITE_USE_FIREBASE=true`. If so, `apps/web/src/pro/loadProRuntime.ts` loads `@grids/pro`.

If a valid Firebase config is bundled, the app registers Firebase-backed implementations. If config is missing or invalid, the app falls back to stubbed local implementations.

## Stubbed Backend

When the production runtime is unavailable because Firebase config is absent or invalid, `apps/web` initializes:

- `StubbedDaoFactory`
- `StubbedDbUtils`
- `StubbedAuthProvider`

This lets the app run end-to-end for local UI development and tests without production Firebase access.

## Emulator Backend

Contributors can use `@grids/pro` through the Firebase Emulator Suite:

```bash
npm run emulators:setup
npm run emulators
npm run dev:emulators
```

The setup script creates demo-only local Firebase config and permissive local rules for emulator use. These files are not production rules and should not be deployed.

## Contributor Rules

- Do not require production Firebase config for public contributions.
- Do not import Firebase directly from Vue components.
- Put shared contracts in `packages/contracts`.
- Keep private credentials and deploy-specific data out of public docs and source.
- When changing the public data model, document compatibility and migration concerns.

## Maintainer Rules

- Keep maintainer-only workflows in `docs/maintainers/`.
- Use maintainer-only messages for private infrastructure tooling instead of exposing stack traces to ordinary contributors.
- Treat maintainer-only infrastructure and deployment details as operational documentation, not contributor prerequisites.
