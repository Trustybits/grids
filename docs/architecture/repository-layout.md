# Repository Layout

This page describes the main folders in the Grids repository and what each area owns.

It focuses on source-controlled project structure. You may also see generated or local-only folders such as `node_modules/`, `dist/`, `lib/`, `.infra-sync/`, or emulator data; those are dependency, build, or maintainer-local outputs and are not the canonical source layout.

## Top Level

```text
.
|-- .github/
|-- .vscode/
|-- apps/
|-- docs/
|-- notes/
|-- packages/
|-- patches/
`-- scripts/
```

- `.github/` - GitHub metadata, issue templates, pull request templates, and CI workflows.
- `.vscode/` - Workspace editor settings for VS Code.
- `apps/` - Runnable application workspaces.
- `docs/` - Durable project documentation for contributors, architecture, and maintainers.
- `notes/` - Scratch notes, historical notes, and non-canonical working docs.
- `packages/` - Shared packages consumed by apps.
- `patches/` - `patch-package` patches applied after dependency installation.
- `scripts/` - Root-level development and maintainer scripts.

## .github

```text
.github/
|-- ISSUE_TEMPLATE/
`-- workflows/
```

- `.github/ISSUE_TEMPLATE/` - GitHub issue forms for bug reports, feature requests, and issue chooser config.
- `.github/workflows/` - GitHub Actions workflows, including CI and release/version automation.

## apps

```text
apps/
|-- discord-bot/
|-- firebase-functions/
`-- web/
```

- `apps/discord-bot/` - Always-on Discord gateway bot that mirrors a forum channel into GitHub issues (inbound half of the Discord ↔ GitHub sync).
- `apps/firebase-functions/` - Firebase Cloud Functions workspace.
- `apps/web/` - Vue 3 + Vite web app workspace.

## apps/firebase-functions

```text
apps/firebase-functions/
`-- src/
    |-- __tests__/
    |-- accounts/
    |-- analytics/
    |-- badges/
    |-- integrations/
    |-- notifications/
    |-- scraping/
    |-- scripts/
    |-- shared/
    `-- storage/
```

- `src/` - TypeScript source for Firebase Functions.
- `src/__tests__/` - Cross-cutting function tests.
- `src/accounts/` - Account and slug-related callable/trigger logic.
- `src/accounts/__tests__/` - Tests for account functions and helpers.
- `src/analytics/` - Analytics events, grid stats, and tracking endpoints.
- `src/analytics/__tests__/` - Analytics tests.
- `src/badges/` - Badge constants and badge grant behavior.
- `src/badges/__tests__/` - Badge tests.
- `src/integrations/` - External integrations such as Notion callables and helpers.
- `src/integrations/__tests__/` - Integration tests.
- `src/notifications/` - Notification triggers and Discord/dev-team notification helpers.
- `src/notifications/__tests__/` - Notification tests.
- `src/scraping/` - Metadata fetching/scraping callables for links, YouTube, and music.
- `src/scraping/__tests__/` - Scraping tests.
- `src/scripts/` - Function-side scripts intended to run from compiled output.
- `src/scripts/__tests__/` - Script tests.
- `src/shared/` - Shared callable/project config utilities used by multiple function areas.
- `src/shared/__tests__/` - Shared utility tests.
- `src/storage/` - Storage triggers, thumbnail generation, OG image generation, and storage usage helpers.
- `src/storage/__tests__/` - Storage tests.

Generated folders you may see:

- `lib/` - TypeScript build output for Firebase Functions.
- `node_modules/` - Workspace dependencies.

## apps/discord-bot

```text
apps/discord-bot/
|-- src/
|   `-- __tests__/
`-- Dockerfile
```

- `src/` - TypeScript source for the gateway bot (`config.ts`, `sync.ts` routing/loop-guard logic, `github.ts` REST client, `index.ts` discord.js entry + Cloud Run health server).
- `src/__tests__/` - Tests for the pure config and sync logic.
- `Dockerfile` - Container build used to deploy the bot to Cloud Run.

Generated folders you may see:

- `lib/` - TypeScript build output for the bot.
- `node_modules/` - Workspace dependencies.

## apps/web

```text
apps/web/
|-- api/
|-- public/
`-- src/
    |-- assets/
    |-- auth/
    |-- components/
    |-- composables/
    |-- constants/
    |-- controllers/
    |-- dao/
    |-- data/
    |-- extensions/
    |-- grid-context/
    |-- notes/
    |-- pages/
    |-- pro/
    |-- registries/
    |-- router/
    |-- services/
    |-- stores/
    |-- styles/
    |-- test/
    |-- themes/
    |-- types/
    |-- undo/
    `-- utils/
```

- `api/` - Vercel API handlers for web-app serverless endpoints.
- `api/__tests__/` - API handler tests.
- `public/` - Static public assets copied as-is by Vite.
- `public/assets/` - Public asset folders.
- `public/assets/music/` - Music tile public images.
- `public/content/` - Public Markdown content such as legal pages.
- `public/illustrations/` - Public illustration assets.
- `src/` - Web app source.
- `src/assets/` - App-imported CSS and images.
- `src/assets/images/` - Image assets imported by the app.
- `src/auth/` - Auth provider singleton and auth boundary code.
- `src/auth/stubbed/` - Stubbed auth implementation for local/non-Firebase runtime.
- `src/components/` - Vue components grouped by product area.
- `src/components/app/` - App shell components such as app bar and user menu.
- `src/components/dashboard/` - Dashboard grid card and dashboard-specific components.
- `src/components/grid/` - Grid canvas, tile shell, grid toolbar, settings, and controls.
- `src/components/icons/` - Shared icon components.
- `src/components/icons/appbar/` - App bar icons.
- `src/components/icons/badges/` - Badge icons.
- `src/components/icons/media/` - Media player icons.
- `src/components/icons/tile-actionbar/` - Tile action bar icons.
- `src/components/icons/toolbar/` - Tile toolbar icons.
- `src/components/marketing/` - Marketing and landing page components.
- `src/components/modal/` - Modal primitives and modal variants.
- `src/components/tile/` - Shared tile shell/chrome components.
- `src/components/tilecontent/` - Tile content renderers.
- `src/components/tilecontent/__tests__/` - Tile content component tests.
- `src/components/tiptap/` - Tiptap node view components.
- `src/components/ui-collections/` - Reusable grouped UI patterns such as menus.
- `src/components/ui-controls/` - Reusable controls such as buttons, toggles, accordions, and color pickers.
- `src/components/ui-elements/` - Lower-level UI elements such as dividers, banners, and tooltips.
- `src/composables/` - Vue composables for reusable app behavior.
- `src/composables/__tests__/` - Composable tests.
- `src/constants/` - App constants.
- `src/controllers/` - Grid write/orchestration layer. `GridController` is a thin facade that delegates to focused internal controllers; cross-store mutations and side effects live here.
- `src/controllers/internal/` - Focused controllers (session, layout, persistence, history, uploads, tiles, viewport, UI, settings, collection) that own one slice of grid command logic each.
- `src/controllers/__tests__/` - Controller tests.
- `src/dao/` - DAO factory singletons and DAO boundary wiring.
- `src/dao/stubbed/` - In-memory DAO implementations for local/stubbed runtime.
- `src/dao/stubbed/factory/` - Stubbed DAO factory implementation.
- `src/data/` - Static seed/demo data used by the app.
- `src/extensions/` - Custom extension code.
- `src/extensions/tiptap/` - Custom Tiptap extensions.
- `src/grid-context/` - The `GridViewContext` seam: a flat interface that grid-canvas and tile-content components inject, plus the live and demo factories that back it (reads wrap stores, writes delegate to the controller). Keeps rendered grid contents swappable between live and demo modes.
- `src/grid-context/__tests__/` - Grid context tests.
- `src/notes/` - App-local notes. Prefer `docs/` for durable documentation.
- `src/pages/` - Route-level page components.
- `src/pro/` - Runtime boundary that loads `@grids/pro` when Firebase mode is enabled.
- `src/registries/` - Runtime registries for tile definitions and tile toolbar behavior.
- `src/registries/tileToolbar/` - Reusable tile toolbar button definitions.
- `src/registries/tiles/` - One tile definition file per tile type.
- `src/router/` - Vue Router setup and guards.
- `src/router/__tests__/` - Router guard tests.
- `src/services/` - App service layer.
- `src/services/__tests__/` - Service tests.
- `src/services/factory/` - Service factory interfaces and implementation.
- `src/services/interfaces/` - Service interfaces.
- `src/services/mocks/` - Mock service implementations.
- `src/stores/` - Pinia stores.
- `src/stores/grid/` - Focused single-slice grid stores (session, viewport, UI, uploads, collection, history). Each owns one slice of grid state with low-level getters/actions; cross-slice orchestration lives in `src/controllers/`.
- `src/stores/grid/__tests__/` - Grid store tests.
- `src/styles/` - SCSS tokens, themes, and app-wide styles.
- `src/test/` - Web test setup utilities.
- `src/themes/` - Theme definitions.
- `src/types/` - App-local TypeScript types. Shared domain types live in `packages/contracts`.
- `src/undo/` - Undo/redo manager and undo-related types.
- `src/undo/__tests__/` - Undo/redo tests.
- `src/utils/` - Pure and app utility functions.
- `src/utils/__tests__/` - Utility tests.

Generated folders you may see:

- `dist/` - Vite build output.
- `node_modules/` - Workspace dependencies.

## docs

```text
docs/
|-- README.md
|-- architecture/
|-- contributing/
|-- getting-started/
`-- maintainers/
```

- `docs/README.md` - Documentation index and routing guide.
- `docs/architecture/` - System architecture, repository structure, and technical boundaries.
- `docs/contributing/` - Public contribution setup, workflow, style, and testing docs.
- `docs/getting-started/` - Local runtime setup guides.
- `docs/maintainers/` - Maintainer-only setup and operational workflows.

### docs/architecture

- `docs/architecture/data-and-service-layer.md` - Explains frontend data flow through components, stores/composables, services, DAO interfaces, and runtime implementations.
- `docs/architecture/npm-scripts.md` - Inventories root and workspace npm scripts, including owner package, purpose, and general/internal classification.
- `docs/architecture/overview.md` - High-level architecture map and links to deeper architecture docs.
- `docs/architecture/production-runtime-boundary.md` - Explains how `packages/pro`, Firebase config, emulators, and stubbed runtime fit together.
- `docs/architecture/public-private-repos.md` - Explains the public repo, private production repo, devops repo, and infra-sync relationship.
- `docs/architecture/repository-layout.md` - This repository layout guide.
- `docs/architecture/tiles.md` - Explains tile architecture and points to the hands-on tile contribution guide.
- `docs/architecture/workspaces.md` - Explains npm workspaces and the purpose of each app/package workspace.

### docs/contributing

- `docs/contributing/code-style.md` - Project conventions for TypeScript, Vue, data access, utilities, and docs.
- `docs/contributing/contributor-setup.md` - Public contributor setup expectations and contributor-specific notes.
- `docs/contributing/development-workflow.md` - Branching, development, and pre-review workflow.
- `docs/contributing/testing.md` - Testing commands and expectations by type of change.

### docs/getting-started

- `docs/getting-started/firebase-emulators.md` - Firebase Emulator Suite prerequisites, setup, usage, emulator data, and troubleshooting.
- `docs/getting-started/local-development.md` - Local contributor development path, especially the stubbed backend flow.

### docs/maintainers

- `docs/maintainers/dev-setup.md` - Internal developer setup, including infra-sync and emulator caveats for maintainers.
- `docs/maintainers/infra-sync.md` - Maintainer-only infra-sync command workflow and state/baseline expectations.
- `docs/maintainers/production-runtime.md` - Maintainer notes for the production Firebase runtime and deploy config guard.

## notes

- `notes/` - Non-canonical notes, implementation history, setup scratchpads, and working documentation. Promote durable guidance from here into `docs/` when it becomes authoritative.

## packages

```text
packages/
|-- contracts/
`-- pro/
```

- `packages/contracts/` - Shared TypeScript contracts consumed across app and runtime boundaries.
- `packages/pro/` - Production-oriented Firebase runtime code used by the web app when Firebase mode and valid config are available.

## packages/contracts

```text
packages/contracts/
`-- src/
    |-- auth/
    |-- dao/
    `-- types/
```

- `src/` - Source for the contracts package.
- `src/auth/` - Auth provider interfaces and auth domain types.
- `src/dao/` - DAO interfaces and database utility contracts.
- `src/dao/factory/` - DAO factory contract.
- `src/types/` - Shared domain types such as grids, tiles, users, badges, analytics, and game data.

Generated folders you may see:

- `dist/` - TypeScript build output consumed by workspace packages.

## packages/pro

```text
packages/pro/
|-- scripts/
|-- src/
|   |-- auth/
|   |-- dao/
|   `-- runtime/
`-- test/
```

- `scripts/` - Build-time helpers such as Firebase config checks/copying.
- `src/` - Source for the production-oriented Firebase runtime package.
- `src/auth/` - Auth runtime implementations.
- `src/auth/firebase/` - Firebase Auth provider implementation.
- `src/dao/` - DAO runtime implementation area.
- `src/dao/firebase/` - Firebase-backed DAO implementations.
- `src/dao/firebase/__tests__/` - Firebase DAO tests.
- `src/dao/firebase/factory/` - Firebase DAO factory implementation.
- `src/runtime/` - Runtime composition root, Firebase service initialization, and config loading.
- `test/` - Package test setup.

Generated folders you may see:

- `dist/` - TypeScript build output.
- `node_modules/` - Workspace dependencies.

## patches

- `patches/` - Patches applied by `patch-package` after `npm install`.

## scripts

- `scripts/` - Root scripts for local Firebase emulator setup and maintainer-only infra-sync bootstrapping/running. See `docs/architecture/npm-scripts.md` for the script inventory.

## Local and Generated Folders

These folders are common in local checkouts but are not canonical source areas:

- `.infra-sync/` - Maintainer-local infra-sync installation and state.
- `node_modules/` - Installed dependencies.
- `dist/` - Build output for Vite or TypeScript packages.
- `lib/` - Firebase Functions build output.
- Emulator data/config files - Local Firebase Emulator Suite state and generated config.
