# grids.so

Open-source link-in-bio / microsite / digital garden / portfolio & personal page builder. Users claim a slug (e.g. `grids.so/matt`) and arrange interactive **tiles** on a **grid** to build a public page. Audience: designers, developers, creators, makers, photographers, videographers, collectors.

Repo: https://github.com/Trustybits/grids (open-source; community contributes code, design assets, and will contribute tiles via a future "Tile Studio").

## Core concepts

- **Layout** (a.k.a. "grid") — the top-level document, owned by a user. See `src/types/Layout.ts`. Contains tiles, background, theme, and per-breakpoint (`lg` / `md` / `sm`) position overrides. Can be marked `duplicatable` so non-owners can clone it as a template.
- **Tile** — a positioned cell on the grid (`src/types/Tile.ts`) holding a `TileContent`. Position is `{x, y, w, h}` plus an `i` id and optional caption/border.
- **TileContent** — discriminated union of tile types (`src/types/TileContent.ts`):
  `text`, `smart_text`, `chat`, `image`, `video`, `link` (with OG metadata), `embed`, `map` (Mapbox), `youtube`, `music` (Spotify / Apple), `roadmap_feed` (Notion-synced), `profile`, plus mini-games `campfire`, `clicker`, `rpg`, and the internal-only `suggestion` type.
- **Slug** — the user's public URL segment. `UserProfile.slug` in `src/types/UserProfile.ts`. Route `/:slug` resolves through `GridPage.vue`. Claiming is gated through the dashboard.
- **Roadmap Feed** — Notion integration: owners connect a Notion DB, map its select/status options to `backlog | in_progress | done`, and the page shows community-upvotable items. Sync is server-side via a Cloud Function.

## Tech stack

- **Frontend:** Vue 3 + Vite + TypeScript, Pinia stores, Vue Router (`src/router/index.ts`). Tiptap for rich text. `vue3-grid-layout` for the grid. `vuedraggable` for reordering. Mapbox GL for map tiles. Bootstrap 5 + SCSS tokens for styling.
- **Backend:** Firebase — Auth, Firestore, Storage, Cloud Functions (`functions/`). Two projects in `.firebaserc`: **`grids-one`** (prod / default) and **`grids-stage`** (stage).
- **Also serverless on Vercel:** OG image generation uses `puppeteer-core` + `@sparticuz/chromium-min` (heavy deps, so it lives on Vercel rather than Firebase Functions). Recent work has been stabilizing this.
- **Other services:** Stripe (subscriptions — `src/services/StripeService.ts`, `useStripeCheckout`, `useSubscription`), PostHog (analytics + feature flags — `usePostHog`, `useFeatureFlags`), Notion OAuth (`NotionCallback.vue`, roadmap feed).
- **Testing:** Vitest. Tests live in `__tests__/` folders next to source.

## Project layout

```
src/
  assets/            Static CSS and images imported by the app
  auth/              AuthProvider interface + Firebase/Stubbed impls + singleton
  components/        Vue components (GridPage, DashboardPage, AuthPage, modals, icons/, tiptap/)
  composables/       useAuthGuard, useEditorAutosave, useFileUpload, useSubscription, useFeatureFlags, ...
  dao/               Data-access layer: interfaces/, firestore/ impls, stubbed/ impls, singletons
  infrastructure/    Cross-cutting setup (Firebase SDK init)
  router/            Routes + auth guards
  services/          Business logic: interfaces/, factory/, mocks/, concrete services (Grid, User, Stripe, Chat, ...)
  stores/            Pinia: grid, theme, toast, pixelRacers
  styles/            SCSS: tokens.scss, themes.scss, custom.scss
  svgs/              SVG icon assets (icons/)
  test/              Vitest setup (setup.ts)
  themes/            Theme definitions
  types/             Grid, Tile, TileContent, UserProfile, GameData, theme, ...
  undo/              UndoRedoManager + UndoTypes
  utils/             GridUtils, TileUtils, GridPlacementUtils, smartTextHelpers, toolbarRegistry, ...
  main.ts            App bootstrap (Pinia, router, PostHog)
functions/           Firebase Cloud Functions (TS)
public/              Static assets + legal markdown (privacy.md, terms.md)
```

## Conventions / gotchas

- Public grid pages (`/grid/:id` and `/:slug`) do not require auth; the router guard also enforces that logged-in users have a claimed slug before navigating anywhere besides `/dashboard` or `/login`.
- `/notion-callback` route must remain ordered before `/:slug` in `router/index.ts` (it would otherwise be captured as a slug).
- Per-breakpoint tile positions are stored in `Layout.overrides` keyed by `'lg' | 'md' | 'sm'`, not on the tile itself — `useTileLayout` handles the merge.
- Rich-text tiles use custom Tiptap extensions in `src/components/tiptap/` (FontSize, DragHandle, ResizableImage, SmartButton).

## When Writing Code
- All database logic and access should be localized in the appropriate dao/ subfolder, and generally DAO access should flow through a service class. All
auth logic and access should be localized in the appropriate auth/ subfolder.
- Firebase initialization occurs in the infrastructure/ folder only. Firebase or firestore usage occurs in the appropriate dao/ and auth/ subfolders
only. This is in accordance with appropriate architecture and dependency flow. Exemptions from this rule include middleware.ts and the firebase
configuration files that live at the root of the repo, and the functions/ folder which constitutes Cloud Functions deployed to firebase.

## Environments

- **Prod:** `grids-one` (Firebase) + Vercel for OG / screenshot functions.
- **Stage:** `grids-stage`.
- `.env` / `env.d.ts` — `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, and other client env vars.

## Typical work

Feature work on tiles and UI, bug fixes, refactors / code quality, product & UX decisions, and marketing.
