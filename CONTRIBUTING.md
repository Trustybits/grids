# Contributing to Grids

Thanks for your interest in contributing. Grids is a TypeScript monorepo for a tile-based microsite builder. Most public contributions land in `apps/web`, `apps/firebase-functions`, or `packages/contracts`.

This guide is the contribution entry point. Deeper explanations live in `docs/`.

## Start Here

1. Read the [local development guide](docs/getting-started/local-development.md).
2. Skim the [architecture overview](docs/architecture/overview.md).
3. If your change touches data models or backend wiring, read the [production runtime boundary](docs/architecture/production-runtime-boundary.md).
4. If you are adding or changing a tile type, read the [tile contribution guide](apps/web/CONTRIBUTING_TILES.md).

## Local Setup

Prerequisites:

- Node.js 22+
- npm 10+
- Firebase CLI and Java JDK only when using Firebase emulators

Install dependencies:

```bash
npm install
```

Run the web app with the stubbed local backend:

```bash
npm run dev
```

Run the app against local Firebase emulators:

```bash
npm run emulators:setup
npm run emulators
```

In a second terminal:

```bash
npm run dev:emulator
```

See [Firebase emulators](docs/getting-started/firebase-emulators.md) for details.

## Project Shape

- `apps/web` - public Vue app and most UI work.
- `apps/firebase-functions` - Firebase Cloud Functions.
- `packages/contracts` - public shared interfaces and domain types.
- `packages/pro` - production-oriented Firebase runtime code. Contributors can use it with local emulators and do not need production Firebase config.

The web app should depend on contracts and services, not direct Firebase calls from Vue components. Production Firebase implementations live in `@grids/pro`; local development can use them through emulators or fall back to stubbed implementations.

## Making Changes

Use focused branches and pull requests. A good branch name is short and descriptive:

```text
feat/document-tile-preview
fix/map-toolbar-focus
docs/local-emulator-setup
test/grid-service-regression
```

Keep changes scoped to one feature, fix, or docs topic. Large features should start with an issue or discussion so maintainers can confirm direction before major implementation work.

## Code Expectations

- Use TypeScript types deliberately. Avoid `any` unless there is a clear reason.
- Use Vue `<script setup>` for new components.
- Keep Firebase access in DAO/runtime layers, not directly in components.
- Use services or composables for app behavior that would otherwise leak into UI components.
- Keep public data model changes backwards-compatible or include a migration path.
- Gate unfinished product behavior behind feature flags where appropriate.

See [code style](docs/contributing/code-style.md) for more detail.

## Tests and Verification

Before opening a PR, run the checks that match your change:

```bash
npm run lint
npm run test
npm run type-check
```

For a full local suite:

```bash
npm run suite:full
```

Bug fixes should include a regression test when practical. Features should include tests for the new behavior. See [testing](docs/contributing/testing.md).

## Pull Requests

Before requesting review:

1. Keep the PR focused.
2. Update or add tests.
3. Update docs when behavior, setup, or architecture changes.
4. Run relevant local checks.
5. Fill out the PR template.
6. Link related issues with `Closes #123` when applicable.

## What We Usually Will Not Merge

- Features without tests.
- Direct Firebase writes from Vue components.
- Hardcoded user IDs, API keys, secrets, or personal data.
- Public tile data model changes without compatibility or migration analysis.
- Firebase rules or storage rules changes without security reasoning.
- Maintainer-only infra changes presented as normal contributor requirements.

## Questions

Open a GitHub issue or discussion for public questions. Maintainer-only deployment, production config, and infra-sync details belong in maintainer channels and should not be required for ordinary contributors.
