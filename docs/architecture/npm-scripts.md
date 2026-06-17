# npm Scripts

This page inventories the npm scripts defined in the root and workspace `package.json` files.

Classification:

- `General use` means contributors can reasonably run the script in a normal local checkout, assuming the listed tools are installed.
- `Internal-dev only` means the script requires maintainer access, production/deploy context, private infrastructure, or directly mutates operational data.
- `Lifecycle` means npm runs the script automatically as part of dependency installation.

## Root

Package: root `package.json`

| Script | Classification | What it does |
| --- | --- | --- |
| `build:contracts` | General use | Builds `@grids/contracts`. |
| `build:pro` | General use | Builds `@grids/pro`. In deploy environments, its Firebase config guard may require production config. |
| `build:web-deps` | General use | Builds the web app's workspace dependencies: `@grids/contracts` and `@grids/pro`. |
| `build:web` | General use | Runs the `apps/web` production build. |
| `build:firebase-functions` | General use | Builds `@grids/firebase-functions`. |
| `build` | General use | Builds the web app and Firebase Functions. |
| `dev` | General use | Builds web dependencies, then starts the web app dev server. Defaults to the stubbed backend unless Firebase mode is configured. |
| `dev:emulator` | General use | Builds web dependencies, then starts the web app in emulator mode. |
| `emulators` | General use | Builds Firebase Functions, then starts local Firebase Auth, Firestore, Functions, and Storage emulators. |
| `emulators:setup` | General use | Creates demo-only, gitignored Firebase emulator config for local development. |
| `emulators:export` | General use | Exports current Firebase Emulator Suite data to `./emulator-data`. |
| `emulators:import` | General use | Builds Firebase Functions, starts emulators with `./emulator-data`, and exports on exit. |
| `infra:setup` | Internal-dev only | Installs maintainer-only infra-sync tooling into local `.infra-sync/` from a private devops repository. |
| `infra:refresh` | Internal-dev only | Re-runs the infra-sync bootstrap without deleting local sync state. |
| `infra:full-refresh` | Internal-dev only | Reinstalls infra-sync after deleting `.infra-sync/`, including local state and baselines. |
| `infra:new` | Internal-dev only | Initializes infra-sync state and baselines through the local `.infra-sync/` tool. |
| `infra:status` | Internal-dev only | Checks infra-sync drift through the local `.infra-sync/` tool. |
| `infra:pull` | Internal-dev only | Pulls private/deploy file changes through the infra-sync workflow. |
| `infra:sync` | Internal-dev only | Synchronizes local private/deploy file changes through the infra-sync workflow. |
| `lint:web-deps` | General use | Lints `@grids/contracts` and `@grids/pro`. |
| `lint` | General use | Lints contracts, pro runtime, web app, and Firebase Functions. |
| `test` | General use | Runs tests for `@grids/pro`, `apps/web`, and Firebase Functions. |
| `type-check:web-deps` | General use | Type-checks `@grids/contracts` and `@grids/pro`. |
| `type-check` | General use | Builds web dependencies, then type-checks the web app and Firebase Functions. |
| `suite:full` | General use | Runs lint, tests, and type-checking. |
| `postinstall` | Lifecycle | Runs `patch-package` after dependency installation. |

## apps/web

Package: `apps/web/package.json` (`grids`)

| Script | Classification | What it does |
| --- | --- | --- |
| `dev` | General use | Starts Vite for the web app. |
| `dev:emulator` | General use | Starts Vite with `--mode emulator` so the app uses emulator-oriented env config. |
| `build:deps` | General use | Runs the root `build:web-deps` script. |
| `build` | General use | Builds dependencies, then runs type-checking and the Vite production build in parallel. |
| `preview` | General use | Starts Vite preview for the built web app. |
| `build-only` | General use | Runs the Vite production build without dependency build or type-check orchestration. |
| `type-check:only` | General use | Runs `vue-tsc` for the web app only. |
| `type-check` | General use | Builds web dependencies, then runs web app type-checking. |
| `lint` | General use | Runs ESLint with zero warnings allowed. |
| `lint:fix` | General use | Runs ESLint auto-fix. |
| `test` | General use | Runs Vitest in watch mode. |
| `test:run` | General use | Runs Vitest once. |
| `test:ui` | General use | Starts the Vitest UI. |
| `test:coverage` | General use | Runs Vitest with coverage. |
| `suite:full` | General use | Runs lint, one-shot tests, and build for the web app. |

## apps/firebase-functions

Package: `apps/firebase-functions/package.json` (`@grids/firebase-functions`)

| Script | Classification | What it does |
| --- | --- | --- |
| `lint` | General use | Runs ESLint with zero warnings allowed. |
| `lint:fix` | General use | Runs ESLint auto-fix. |
| `type-check` | General use | Runs TypeScript without emitting files. |
| `test` | General use | Runs Vitest once. |
| `test:coverage` | General use | Runs Vitest with coverage. |
| `test:watch` | General use | Runs Vitest in watch mode. |
| `build` | General use | Compiles Firebase Functions TypeScript to `lib/`. |
| `build:watch` | General use | Runs the Firebase Functions TypeScript compiler in watch mode. |
| `serve` | General use | Builds functions, then starts the local Firebase Functions emulator. |
| `shell` | General use | Builds functions, then starts `firebase functions:shell`. |
| `start` | General use | Alias for `shell`. |
| `deploy` | Internal-dev only | Deploys Firebase Functions. Requires authorized Firebase project access. |
| `logs` | Internal-dev only | Reads Firebase Functions logs. Requires authorized Firebase project access. |
| `badge:grant` | Internal-dev only | Builds functions, then runs the badge grant script from compiled output. Mutates operational data. |

## packages/contracts

Package: `packages/contracts/package.json` (`@grids/contracts`)

| Script | Classification | What it does |
| --- | --- | --- |
| `build` | General use | Compiles shared contracts with TypeScript. |
| `type-check` | General use | Type-checks shared contracts without emitting files. |
| `lint` | General use | Runs ESLint with zero warnings allowed. |

## packages/pro

Package: `packages/pro/package.json` (`@grids/pro`)

| Script | Classification | What it does |
| --- | --- | --- |
| `lint` | General use | Runs ESLint with zero warnings allowed. |
| `lint:fix` | General use | Runs ESLint auto-fix. |
| `test` | General use | Runs Vitest once. |
| `type-check` | General use | Type-checks the production runtime package without emitting files. |
| `build` | General use | Runs the Firebase config guard, compiles TypeScript, and copies optional Firebase config into `dist/` when present. In deploy environments, `REQUIRE_FIREBASE_CONFIG` makes this fail without valid production config. |
