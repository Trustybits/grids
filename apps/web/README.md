# Grids Web App

This workspace contains the public Vue 3 + Vite web app for Grids.

Most frontend contributions land here. The app can run without production Firebase config by falling back to stubbed local DAO/auth implementations.

## Common Commands

From the repository root:

```bash
npm run dev
npm run dev:emulators
npm --workspace apps/web run test:run
npm --workspace apps/web run lint
npm --workspace apps/web run type-check
```

Use [Firebase emulators](../../docs/getting-started/firebase-emulators.md) when a change needs local Firebase Auth, Firestore, Functions, or Storage behavior.

## Key Docs

- [Local development](../../docs/getting-started/local-development.md)
- [Firebase emulators](../../docs/getting-started/firebase-emulators.md)
- [Architecture overview](../../docs/architecture/overview.md)
- [Data and service layer](../../docs/architecture/data-and-service-layer.md)
- [npm scripts](../../docs/architecture/npm-scripts.md)
- [Tiles](../../docs/architecture/tiles.md)
- [Tile contribution guide](CONTRIBUTING_TILES.md)
