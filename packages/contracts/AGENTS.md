# @grids/contracts

Shared **contracts** — the interfaces and domain types that cross package boundaries in `grids.so`. This package is the agreed-upon shape between the front end (`apps/web`) and its backend implementations (`@grids/pro`, and the local stubs in `apps/web/src/{dao,auth}/stubbed/`). Both sides depend on `@grids/contracts`; neither depends on the other.

It is (almost entirely) a **declaration package**: no backend SDKs, no business logic, no I/O. The handful of runtime values it ships are plain enums/constants (see "Runtime values" below).

## What lives here

- **`src/auth/`** — the `AuthProvider` interface and the `AuthUser` domain object. `AuthUser` deliberately reduces a provider's user (uid/email/displayName/photoURL) to a minimal shape so consumers never touch a vendor `User` type.
- **`src/dao/`** — the data-access interfaces. One interface per concern (`GridDao`, `UserDao`, `SlugDao`, `ChatDao`, `RoadmapDao`, `UpvoteDao`, `BadgeDao`, `CustomerDao`, `AnalyticsEventDao`, `BusinessStatsDao`, `GridStatsDao`, `CloudFunctionsDao`, `StorageDao`, `UserGameDataDao`), plus `DbUtils` and `factory/DaoFactory.ts` (the `DaoFactory` interface that hands out every DAO). DAO methods are typed entirely in terms of the domain types from `src/types/` — never database/SDK types.
- **`src/types/`** — the domain model: `Grid` (the top-level document), `Tile`, `TileContent` (discriminated union of tile types), `UserProfile`, `GameData`, `Badge`, `Roadmap`, `Analytics`.

## Public entry points

Consumers import from subpaths, each backed by a barrel (`index.ts`) and mapped in `package.json` `exports` to the built `dist/`:

- `@grids/contracts/auth` → `src/auth/index.ts`
- `@grids/contracts/dao` → `src/dao/index.ts`
- `@grids/contracts/types` → `src/types/index.ts`
- `@grids/contracts` (root) → `src/index.ts` (re-exports all three barrels, types and runtime values alike)

## Runtime values (important)

Most exports are type-only, but a few are real runtime values: the `ContentType` enum (`types/TileContent.ts`), the `AnalyticsEventType` enum (`types/Analytics.ts`), and the `BADGE_IDS` const (`types/Badge.ts`). Because of these:

- `src/types/index.ts` and the root `src/index.ts` use `export *` (value-preserving), so these values are reachable from both `@grids/contracts/types` and the bare `@grids/contracts` specifier.
- `src/dao/index.ts` and `src/auth/index.ts` are interface-only and use `export type`.
- If you add a new runtime value, re-export it with `export *` (not `export type`) so it survives through the barrels.

## Build & tooling

- `npm run build` — `tsc` emits `dist/` (declarations + JS + source maps); this is what consumers actually resolve via the `exports` map, so **build before depending on changes** (the root `build:web-deps` / `dev` scripts do this for you).
- `npm run type-check` — `tsc --noEmit`.
- `npm run lint` — ESLint, zero warnings allowed.
- ESM + `NodeNext` resolution: relative imports must carry the `.js` extension (e.g. `from "./Tile.js"`) even though the source is `.ts`.

## When writing code

- Keep this package host-agnostic. No imports of `firebase/*` or any other backend SDK, no environment reads, no runtime side effects — only types and the small set of enums/consts above.
- Adding a contract: define the interface/type in the right `src/{auth,dao,types}/` file, re-export it from that folder's `index.ts`, and (for a new DAO) add its getter to `DaoFactory`. Then `npm run build` so downstream packages see it.
- A change here is a breaking change for every consumer. Update the implementations in `@grids/pro` and the stubs in `apps/web/src/{dao,auth}/stubbed/` in lockstep — `implements` clauses on both sides will fail to type-check until they match.
