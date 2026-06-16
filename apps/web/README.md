# Grids Web App

This workspace contains the public Vue 3 + Vite web app for Grids.

Most frontend contributions land here. The app can run without production Firebase config by falling back to stubbed local DAO/auth implementations.

## Common Commands

From the repository root:

```bash
npm run dev
npm run dev:emulator
npm --workspace apps/web run test:run
npm --workspace apps/web run lint
npm --workspace apps/web run type-check
```

## Key Docs

- [Local development](../../docs/getting-started/local-development.md)
- [Architecture overview](../../docs/architecture/overview.md)
- [Data and service layer](../../docs/architecture/data-and-service-layer.md)
- [Tiles](../../docs/architecture/tiles.md)
- [Tile contribution guide](CONTRIBUTING_TILES.md)
