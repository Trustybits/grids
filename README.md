# Grids

Grids is a link-in-bio, digital garden, portfolio, and microsite builder built around drag-and-drop tiles.

This repository is a TypeScript monorepo. The public app, shared contracts, and production-oriented Firebase runtime all live here.

## Repository

- `apps/web` - Vue 3 + Vite web app. Most frontend contributions start here.
- `apps/firebase-functions` - Firebase Cloud Functions for backend workflows.
- `packages/contracts` - shared TypeScript interfaces and domain types used across runtime boundaries.
- `packages/pro` - production-oriented Firebase runtime code. Contributors can use it with emulators; production deploys use it with real Firebase config.
- `docs` - contributor, architecture, and maintainer documentation.
- `scripts` - local development and maintainer scripts.

## Quick Start For Contributors

Internal developers should use the [dev setup notes](docs/maintainers/dev-setup.md) instead.

Prerequisites:

- Node.js 22+
- npm 10+

Install dependencies:

```bash
npm install
```

Start the web app with the stubbed local backend:

```bash
npm run dev
```

Additionally setup details can be found in `docs/getting-started/`, as well as in the [Contributor setup guide](./docs/contributing/contributor-setup.md).


For Firebase Emulator Suite development, follow the [Firebase emulators guide](docs/getting-started/firebase-emulators.md).

## Documentation

- [Documentation index](docs/README.md)
- [Local development](docs/getting-started/local-development.md)
- [Firebase emulators](docs/getting-started/firebase-emulators.md)
- [Architecture overview](docs/architecture/overview.md)
- [npm scripts](docs/architecture/npm-scripts.md)
- [Production runtime boundary](docs/architecture/production-runtime-boundary.md)
- [Public and private repos](docs/architecture/public-private-repos.md)
- [Contributing guide](CONTRIBUTING.md)
- [Tile contribution guide](apps/web/CONTRIBUTING_TILES.md)

## Common Commands

```bash
npm run build
npm run lint
npm run test
npm run type-check
npm run suite:full
```

Package-level scripts are available through npm workspaces, for example:

```bash
npm --workspace apps/web run test:run
npm --workspace @grids/firebase-functions run test
npm --workspace @grids/contracts run build
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. It links to the local setup, architecture, testing, and workflow docs that contributors are expected to follow.
