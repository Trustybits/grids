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

## Quick Start For CONTRIBUTORS

_Dev team, see the [dev setup notes](/docs/maintainers/dev-setup.md) to get started_

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

For Firebase Emulator Suite development, set up local demo config first:

```bash
npm run emulators:setup
```

This only needs to be done once per clone.

Then run the emulators prior to running the dev server:

```bash
npm run emulators
```

Then, in another terminal:

```bash
npm run dev:emulator
```

## Documentation

- [Documentation index](docs/README.md)
- [Local development](docs/getting-started/local-development.md)
- [Firebase emulators](docs/getting-started/firebase-emulators.md)
- [Architecture overview](docs/architecture/overview.md)
- [Production runtime boundary](docs/architecture/production-runtime-boundary.md)
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
