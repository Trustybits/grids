# Local Development

This guide gets a public checkout running without production Firebase access.

## Prerequisites

- Node.js 22+
- npm 10+
- Firebase CLI, only for emulator workflows: `npm install -g firebase-tools`
- Java JDK 11+, only for emulator workflows

## Install

```bash
npm install
```

The repository uses npm workspaces for `apps/*` and `packages/*`.

## Run With Stubbed Backend

The fastest local path is the stubbed backend:

```bash
npm run dev
```

The root `dev` script builds workspace dependencies and starts `apps/web`. If production Firebase config is absent, `apps/web` falls back to in-memory stubbed DAOs.

Use this mode for most UI work, tile behavior, routing, stores, composables, and tests that do not require Firebase emulator behavior.

## Run With Firebase Emulators

For work that needs Firebase Auth, Firestore, Functions, or Storage emulator behavior:

```bash
npm run emulators:setup
npm run emulators
```

Then start the app in another terminal:

```bash
npm run dev:emulator
```

See [Firebase emulators](firebase-emulators.md) for details.

## Useful Commands

```bash
npm run build
npm run lint
npm run test
npm run type-check
npm run suite:full
```

Workspace-specific examples:

```bash
npm --workspace apps/web run test:run
npm --workspace @grids/firebase-functions run test
npm --workspace @grids/contracts run build
```

## Local Files

Some local Firebase and runtime files are gitignored because they are generated, environment-specific, or private. Ordinary contributors should not need production Firebase credentials or private infrastructure access.
