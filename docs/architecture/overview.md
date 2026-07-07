# Architecture Overview

Grids is a TypeScript monorepo built around a public app, shared contracts, and a production-oriented Firebase runtime.

At a high level:

```text
apps/web
  -> packages/contracts
  -> packages/pro when Firebase runtime is enabled and config is available
  -> stubbed DAOs when Firebase runtime is disabled or unavailable

apps/firebase-functions
  -> backend Firebase Functions

packages/contracts
  -> shared public interfaces and domain types
```

## Main Ideas

- The Vue app is public and should be usable by contributors without production Firebase access.
- Shared interfaces live in `packages/contracts`.
- Production Firebase implementations live in `packages/pro`.
- The app initializes either the real Firebase-backed runtime or local stubbed implementations at startup.
- UI code should consume services, composables, stores, and contracts instead of importing Firebase directly.

## Request and State Flow

Most frontend behavior follows this shape:

```text
Vue component
  -> composable or Pinia store
  -> service
  -> DAO interface from @grids/contracts
  -> stubbed DAO or Firebase-backed DAO
```

This keeps components focused on rendering and interaction, while data access stays behind testable interfaces.

## Where to Add Things

- New UI: `apps/web/src/components`, `apps/web/src/pages`, or `apps/web/src/components/ui-*`.
- Reusable UI behavior: `apps/web/src/composables`.
- Frontend state: `apps/web/src/stores`.
- Shared app behavior and business rules: `apps/web/src/services`.
- Pure helpers: `apps/web/src/utils`.
- Shared domain types and DAO contracts: `packages/contracts`.
- Firebase-backed implementations: `packages/pro` or `apps/firebase-functions`, depending on whether the code runs in the browser runtime or Cloud Functions.
- Tile definitions: `apps/web/src/registries/tiles` and related tile content/components.

## More Detail

- [Workspaces](workspaces.md)
- [Repository layout](repository-layout.md)
- [npm scripts](npm-scripts.md)
- [Production runtime boundary](production-runtime-boundary.md)
- [Data and service layer](data-and-service-layer.md)
- [Storage, uploads, and deduplication](storage-and-uploads.md)
- [Tiles](tiles.md)
- [Private and Public repos](public-private-repos.md)
