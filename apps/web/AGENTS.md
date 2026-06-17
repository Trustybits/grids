# grids.so

Open-source link-in-bio / microsite / digital garden / portfolio & personal page builder. Users claim a slug (e.g. `grids.so/matt`) and arrange interactive **tiles** on a **grid** to build a public page. Audience: designers, developers, creators, makers, photographers, videographers, collectors.

Repo: https://github.com/Trustybits/grids (open-source; community contributes code, design assets, and will contribute tiles via a future "Tile Studio").

This package (`apps/web`) is the Vue front end. Its backend (data access + auth) is reached only through interfaces in `@grids/contracts`; the concrete production-oriented implementations live in the public `@grids/pro` package and can run against production Firebase config or local emulators.

## Core concepts

- **Grid** — the top-level document, owned by a user. Defined in `@grids/contracts/types` (`Grid`). Contains tiles, background, theme, and per-breakpoint (`lg` / `md` / `sm`) position overrides. Can be marked `duplicatable` so non-owners can clone it as a template.
- **Tile** — a positioned cell on the grid (`Tile` in `@grids/contracts/types`) holding a `TileContent`. Position is `{x, y, w, h}` plus an `i` id and optional caption/border.
- **TileContent** — discriminated union of tile types (`TileContent` in `@grids/contracts/types`):
  `text`, `smart_text`, `chat`, `image`, `video`, `link` (with OG metadata), `embed`, `map` (Mapbox), `youtube`, `music` (Spotify / Apple), `roadmap_feed` (Notion-synced), `profile`, plus mini-games `campfire`, `clicker`, `rpg`, and the internal-only `suggestion` type.
- **Slug** — the user's public URL segment. `UserProfile.slug` in `@grids/contracts/types`. Route `/:slug` resolves through `GridPage.vue`. Claiming is gated through the dashboard.
- **Roadmap Feed** — Notion integration: owners connect a Notion DB, map its select/status options to `backlog | in_progress | done`, and the page shows community-upvotable items.

## Tech stack

- **Frontend:** Vue 3 + Vite + TypeScript, Pinia stores, Vue Router (`src/router/index.ts`). Tiptap for rich text. `vue3-grid-layout` for the grid. `vuedraggable` for reordering. Mapbox GL for map tiles. Bootstrap 5 + SCSS tokens for styling.
- **Data & auth boundary:** `apps/web` never talks to a database or auth SDK directly. It depends on DAO and `AuthProvider` interfaces from `@grids/contracts`, resolved at runtime through a factory/singleton. Production-oriented implementations come from `@grids/pro`, selected at boot in `src/main.ts` via `src/pro/loadProRuntime.ts`. When Firebase config is absent or invalid, the app falls back to the local stubs in `src/dao/stubbed/` and `src/auth/stubbed/`.
- **Shared contracts:** cross-package types and interfaces (`Grid`, `Tile`, `TileContent`, `UserProfile`, the DAO interfaces, `AuthProvider`, etc.) live in `@grids/contracts` so both the app and its backend implementations agree on shapes.
- **Client integrations:** Stripe (subscriptions — `src/services/StripeService.ts`, `useStripeCheckout`, `useSubscription`), PostHog (analytics + feature flags — `usePostHog`, `useFeatureFlags`), Notion OAuth (`NotionCallback.vue`, roadmap feed).
- **Testing:** Vitest. Tests live in `__tests__/` folders next to source.

## Project structure

```
src/
  assets/            Static CSS and images imported by the app
  auth/              AuthProvider singleton + stubbed/ impl (interface lives in @grids/contracts)
  components/        Vue components (app/, dashboard/, grid/, tile/, tilecontent/, modal/,
                     marketing/, icons/, tiptap/, ui-collections/, ui-controls/, ui-elements/)
  composables/       useAuthGuard, useTileLayout, useFileUpload, useSubscription, useFeatureFlags, ...
  data/              Static seed/demo data (DemoGrid.ts)
  dao/               Data-access layer: DAO + DbUtils factory singletons + stubbed/ impls
                     (interfaces live in @grids/contracts; production impls in @grids/pro)
  extensions/        Custom Tiptap extensions (tiptap/: FontSize, DragHandle, ResizableImage, SmartButton)
  pages/             Top-level routed pages (GridPage, DashboardPage, HomePage, ...)
  pro/               Runtime boundary to @grids/pro (loadProRuntime.ts)
  registries/        Tile + toolbar registries (tiles/, tileToolbar/, tileRegistry.ts)
  router/            Routes + auth guards
  services/          Business logic: interfaces/, factory/, mocks/, concrete services (Grid, User, Stripe, Chat, ...)
  stores/            Pinia: grid, theme, toast, pixelRacers
  styles/            SCSS: tokens.scss, themes.scss, custom.scss
  test/              Vitest setup (setup.ts)
  themes/            Theme definitions
  types/             App-local types (Tile child-component contracts, TileDefinition, TileToolbar, Theme, ...)
  undo/              UndoRedoManager + UndoTypes
  utils/             GridUtils, TileUtils, GridPlacementUtils, smartTextHelpers, ...
  main.ts            App bootstrap (Pinia, router, PostHog, runtime selection)
public/              Static assets + legal markdown (privacy.md, terms.md)
```

## Conventions / gotchas

- Public grid pages (`/grid/:id` and `/:slug`) do not require auth; the router guard also enforces that logged-in users have a claimed slug before navigating anywhere besides `/dashboard` or `/login`.
- `/notion-callback` route must remain ordered before `/:slug` in `router/index.ts` (it would otherwise be captured as a slug).
- Per-breakpoint tile positions are stored in `Grid.overrides` keyed by `'lg' | 'md' | 'sm'`, not on the tile itself — `useTileLayout` handles the merge.
- Rich-text tiles use custom Tiptap extensions in `src/extensions/tiptap/` (FontSize, DragHandle, ResizableImage, SmartButton).

## When Writing Code

- Data access flows through a service class (`src/services/`), which obtains a DAO from the DAO factory singleton — never import or instantiate a concrete DAO directly. Auth access goes through the `AuthProvider` singleton (`src/auth/`). DAO and `AuthProvider` interfaces are defined in `@grids/contracts`.
- `apps/web` must stay backend-agnostic: do not import database/auth SDKs (e.g. `firebase/*`) or reach into `@grids/pro` internals. The only crossing point is the runtime boundary in `src/pro/loadProRuntime.ts`, which hands back `@grids/contracts`-typed implementations. Everything else codes against the contracts interfaces and falls back to the local stubs.
