# Contributing to Grids

Thanks for your interest in contributing! Grids is a link-in-bio, digital garden, portfolio, and microsite builder. We welcome contributions from the community.

## Before You Start

- Join our [Discord](https://discord.gg/your-invite) to discuss ideas before building large features
- Check [open issues](https://github.com/trustybits/grids/issues) to avoid duplicate work
- Read through this guide fully — it will save you time

## Project Overview

Grids is built with:
- **Frontend**: Vue 3 + TypeScript + Vite, Pinia (state), Vue Router 4
- **Styling**: Bootstrap 5 + custom Sass tokens
- **Rich text**: TipTap
- **Maps**: Mapbox GL
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions v2)
- **Analytics**: PostHog

The architecture has a clean separation:
- `src/types/` — all TypeScript interfaces (start here when adding new features)
- `src/services/` — Firestore / Firebase service layer
- `src/stores/` — Pinia stores (reactive state)
- `src/composables/` — reusable Vue 3 composition functions
- `src/components/` — Vue SFCs
- `src/utils/` — pure utility functions (pure functions = easy to test)
- `functions/src/` — Firebase Cloud Functions

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- Firebase CLI: `npm install -g firebase-tools`

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/trustybits/grids.git
cd grids

# 2. Install dependencies
npm install
cd functions && npm install && cd ..

# 3. Copy environment variables
cp .env.example .env
# Fill in your Firebase project values in .env

# 4. Start Firebase emulators (Firestore, Auth, Functions, Storage)
firebase emulators:start

# 5. In a separate terminal, start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`. It automatically connects to the local Firebase emulators — you don't need a real Firebase project to develop.

### Running Tests

```bash
# Watch mode (re-runs on file save)
npm run test

# Single run (same as CI)
npm run test:run

# With coverage report
npm run test:coverage
```

### Linting

```bash
npm run lint        # check for issues
npm run lint:fix    # auto-fix what can be fixed
```

### Type Checking

```bash
npm run type-check
```

## Making Changes

### Branch Naming

Use the format: `type/short-description`

- `feat/youtube-widget-controls`
- `fix/map-tile-drag-regression`
- `chore/update-tiptap`
- `docs/add-composable-jsdoc`

### Code Style

**TypeScript**: We use strict TypeScript. No `any` unless absolutely unavoidable (and even then, add a comment explaining why). New code should be fully typed.

**Vue components**: Use `<script setup>` syntax. Define props and emits with `defineProps` / `defineEmits`. Keep components focused — if a component exceeds ~300 lines, consider splitting it.

**Composables**: Use the `use` prefix. Return only what callers need. Composables that touch Firebase should be tested with mocks.

**Stores**: Keep Pinia stores focused on a single domain. Don't put Firebase calls directly in components — use a service or composable.

**Adding a new tile type**: This is one of the most common contributions.
1. Add a new value to `ContentType` in `src/types/TileContent.ts`
2. Add the corresponding interface extending `TileContent`
3. Add it to the `AnyTileContent` union type
4. Add defaults in `createTileContent` in `src/utils/TileUtils.ts`
5. Add validation in `validateTileContent`
6. Add `createTileContentFromEmbedUrl` routing if it has a URL format
7. Register a toolbar in `src/utils/toolbarRegistry.ts`
8. Write tests in `src/utils/__tests__/TileUtils.test.ts`

**Feature flags**: New features should be gated behind a PostHog feature flag. Add the flag key to `FEATURE_FLAGS` in `src/composables/useFeatureFlags.ts` before using it.

### Writing Tests

We use [Vitest](https://vitest.dev/) with Vue Test Utils. Tests live in `__tests__/` directories next to the code they test.

- **Pure utils** (`src/utils/`): Test all exported functions. No mocking needed.
- **Services** (`src/services/`): Mock Firebase using `vi.mock()`. See `src/test/setup.ts` for the global mock layer.
- **Composables**: Use `setActivePinia(createPinia())` in `beforeEach`. See existing tests for patterns.
- **Components**: Focus on behaviour, not implementation. Test what the user sees and interacts with.

Every PR that adds a feature should include tests. Bug fix PRs should include a regression test.

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) spec:

```
feat: add Spotify music tile
fix: prevent map tile drag on mobile
chore: update firebase to v11
docs: add composable JSDoc for useSubscription
test: add TileUtils validation edge cases
```

## Pull Request Process

1. Make sure `npm run test:run`, `npm run lint`, and `npm run type-check` all pass locally
2. Keep PRs focused — one feature or fix per PR
3. Update or add tests for your changes
4. Fill out the PR template completely
5. Link any related issues with `Closes #123`

A maintainer will review within a few days. We may ask for changes — this is normal and helps us maintain quality.

## What We Won't Merge

- Features without tests
- Breaking changes to the public tile data model without a migration path
- Direct Firebase writes from components (use services or composables)
- Hardcoded user IDs, API keys, or personal data
- Changes to `firestore.rules` without security analysis

## Questions?

Open a [GitHub Discussion](https://github.com/trustybits/grids/discussions) or ask in the `#dev` channel on Discord.
