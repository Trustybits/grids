# Migrating from `vue3-grid-layout` to Griddle

Analysis of replacing the current grid layout engine (`vue3-grid-layout`) with the custom
Griddle library (cloned locally at `../griddle`, workspace `griddle-workspace`).

**What "one-to-one" means here (clarified):** keep the same *feature scope* — the grid does exactly
what it does today, with none of Griddle's extra capabilities (loop, sticky/pin/absolute
positioning, group-drag, draw-to-create) turned on yet. It does **not** mean replicating
`vue3-grid-layout`'s drag/collision *behavior*. On the contrary — **we deliberately adopt Griddle's
own collision + repack semantics** (Rules 1–6 swap/push, compaction/gravity). Griddle's drag feel
replacing `vue3-grid-layout`'s push-and-restore is a wanted change, not a regression.

- **Question 1 — Can Griddle replace `vue3-grid-layout` one-to-one?** Yes. It is **not a drop-in
  component swap** — Griddle inverts the data-flow model, so it needs an adapter layer plus rework
  of `Grid.vue` / `Tile.vue` — but the fixed-cell sizing model already matches how we use
  `vue3-grid-layout`, and adopting Griddle's collision behavior removes the one item that was
  previously a parity risk.
- **Question 2 — Best way to get Griddle into the repo?** Publish `@griddle/core` and
  `@griddle/vue` to npm. Griddle is a genuinely separate, reusable library living in its own git
  repo, so npm is the right boundary (details and steps below).

---

## 1. How we use `vue3-grid-layout` today

### Consumers
- `apps/web/src/components/grid/Grid.vue` — renders `<GridLayout>` and imports `GridItem`.
- `apps/web/src/components/grid/Tile.vue` — wraps tile content in a `<GridItem>`.
- `apps/web/src/components/marketing/LandingPageGridEmbed.vue` — same components inside a
  CSS-`transform: scale()` scroll-jack.
- Supporting infra: `useResponsiveGridLayout.ts`, `GridLayoutUtils.ts`, `types/GridLayout.ts`
  (`GridLayoutItem = {i,x,y,w,h}`), the `controllers/` layer (`GridController`,
  `internal/GridLayoutController`, `internal/GridViewportController`), `stores/grid/gridViewport.ts`.
- Tests mock `vue3-grid-layout`: `Grid.test.ts`, `Tile.test.ts`,
  `LandingPageGridEmbed.canvas.test.ts`.

### The exact API surface we depend on
`<GridLayout>` props: `layout`, `col-num`, `row-height`, `is-draggable`, `is-resizable`,
`vertical-compact`, `prevent-collision="false"`, `restore-on-drag`, `use-css-transforms`,
`margin`. Events: `@layout-ready`, `@layout-updated`.

`<GridItem>` props: `i`, `x`, `y`, `w`, `h`, `minW/minH/maxW/maxH`, `isDraggable`, `isResizable`,
`dragIgnoreFrom`. Events: `@move`, `@moved`, `@resize`, `@resized`.

### How we actually use it (important for the mapping)
Although `vue3-grid-layout` is nominally a *fluid* grid (column width = container width ÷ `col-num`),
**we force it into a fixed-pixel square-cell model.** `useResponsiveGridLayout` sets the container
width to `gridWidth = colNum·rowHeight + (colNum+1)·margin` with `rowHeight = 75`, `margin = 48`.
That makes every column exactly `75px` wide with `48px` gaps — i.e. **75×75 cells, 48px gap.**
Mobile fit is handled by our own `transform: scale()` on the wrapper, not by the library.

Responsiveness is *also* ours: we change `col-num` per breakpoint (`lg`/`md`/`sm`) and re-project
tile positions via `projectGridLayout` + per-breakpoint `Grid.overrides`. `vue3-grid-layout` only
ever sees a single fixed column count at a time.

**Data-flow model:** `vue3-grid-layout` is *controlled by a mutable `layout` array that it mutates
in place* during drag/resize. `Grid.vue` deep-watches `displayLayout` to publish live positions and
commits on `@moved`/`@resized`. Compaction toggling runs our own `compactGridLayout`.

---

## 2. How Griddle is structured

Monorepo `griddle-workspace` (npm workspaces), packages:

| Package | Role | Build / distribution |
| --- | --- | --- |
| `@griddle/core` | Headless engine (`Grid`, geometry, repack, compaction, virtualize, drag controllers). Zero deps. | `tsc` → `dist/` (JS + `.d.ts`). Ships `dist` + `src`. |
| `@griddle/vue` | Vue 3 bindings: `<GriddleGrid>`, `useGriddle()`. | **Distributed as raw source** — `main`/`module`/`types` all point at `./src/index.ts`; "build" is a no-op echo. Consumer's SFC/TS compiler compiles the `.vue`/`.ts`. |
| `@griddle/react`, `@griddle/svelte` | Not relevant to us. | — |

### Griddle's Vue API
```ts
const api = useGriddle({ config: GridConfig, tiles: Tile[] });
// <GriddleGrid :api="api" :selection="..." @dragEnd @resizeEnd ...>
//   <template #tile="{ tile, selected }"> ... </template>
```
- `GridConfig`: `cols`, `rows`, `unitWidth`, `unitHeight`, `gap?`, `gravity?`, `resizeHandles?`,
  `snapDuringDrag?`, `tileRadius?`, `dragIgnoreFrom?`, plus opt-in `loop`, `enablePositioning`,
  `infiniteX/Y`.
- `Tile`: `{ id, col, row, w, h, data?, draggable?, resizable?, minW/minH/maxW/maxH, ... }`.
- `GriddleGrid.vue` owns all pointer handling internally (drag, group-drag, resize handles,
  selection, draw-to-create, FLIP animations, drop indicator, virtualization) and emits
  grid-level events `dragStart/dragEnd/resizeStart/resizeEnd/selectionChange/drawCreate`.
- `useGriddle` mirrors the engine's tiles/config into `shallowRef`s and bumps a `version` ref on
  every change (via the engine's `changes` emitter).

---

## 3. One-to-one feasibility assessment

### What maps cleanly ✅
| Today (`vue3-grid-layout`) | Griddle equivalent |
| --- | --- |
| Fixed 75×75 cells, 48px gap (via forced container width) | `unitWidth: 75, unitHeight: 75, gap: 48` — a **native, first-class** model in Griddle |
| `col-num` (per breakpoint) | `config.cols` (drive via `api.updateConfig({ cols })`) |
| `is-draggable` / `is-resizable` | `tile.draggable` / `tile.resizable` (+ config `resizeHandles`) |
| `GridItem` `minW/minH/maxW/maxH` | same fields on `Tile` |
| `dragIgnoreFrom="a, button, input, .tile-caption"` | `config.dragIgnoreFrom` (or per-grid default) |
| `@move/@moved/@resize/@resized` | `@dragStart/@dragEnd/@resizeStart/@resizeEnd` |
| Placeholder / drop indicator | Built-in `griddle-drop-indicator` |
| Snap-back / reflow animation | Built-in FLIP animation |
| `vertical-compact` toggle | `config.gravity` (`'top'` ≈ vertical compact) + our existing `compactGridLayout` still usable |
| Mobile `transform: scale()` wrapper | Unaffected — Griddle renders at natural pixel size, so an outer scale still works (same as the marketing embed relies on today) |

The **sizing model is a better fit than today's**: we currently fight `vue3-grid-layout`'s fluid
columns to get fixed cells; Griddle is fixed-cell by design.

### What requires real work / carries risk ⚠️

1. **Inverted data-flow (biggest structural change).** `vue3-grid-layout` is controlled by our
   mutable `layout` array; Griddle *owns* state in its `Grid` engine and emits changes. Migration
   means an adapter that (a) loads our `{i,x,y,w,h}` tiles → Griddle `{id,col,row,w,h}`, and
   (b) commits Griddle's `@dragEnd`/`@resizeEnd` back through `GridController` →
   store/DAO/overrides. The `id↔i` and `col/row↔x/y` renaming is trivial; the control-flow
   inversion in `Grid.vue`/`Tile.vue` and the controllers is the substantive part.

2. **Collision / repack semantics change — and that's the intent.** We currently run
   `prevent-collision="false"` + `restore-on-drag` (`vue3-grid-layout` pushes tiles out of the way
   and restores them). We are **intentionally replacing this with Griddle's Rules 1–6 repack**
   (swap/push) — the new drag behavior is a feature, not something to reconcile against the old
   library. No parity validation against `vue3-grid-layout` is needed; instead validate that
   Griddle's semantics feel right on real grids. Keep `gravity: 'none'` as the default (matching our
   non-compacted default) and wire the gravity/compaction toggle to Griddle's `gravity` config.
   **Caveat:** because the repack result differs from what `vue3-grid-layout` would have produced,
   existing persisted grids may settle into slightly different positions the first time they're
   dragged under Griddle — acceptable given this is an intended behavior change, but worth a
   sanity-check on a few real grids.

3. **`Tile.vue` restructure.** The `<GridItem>` wrapper and its `onMove/onMoved/onResize/onResized`
   handlers get removed; Tile content moves into Griddle's `#tile` slot, and move/resize commits
   move up to the grid-level events in `Grid.vue`. Tile's injected geometry
   (`gridTileW/H/X/Y`) must now come from `tile` slot props instead of the `layout` prop.

4. **Responsive breakpoint reflow stays ours.** Griddle has no breakpoint concept (by design — we
   said no capability expansion). `useResponsiveGridLayout` + `GridLayoutUtils` + `Grid.overrides`
   continue to compute the per-breakpoint layout and feed Griddle a single fixed `cols` +
   projected tiles via `updateConfig`/`loadJSON`. This is fine, but the "layout-ready" handshake
   (`waitForLayoutReady`, `reportRenderedLayout`, `layout-ready`/`layout-updated`) needs to be
   re-wired to Griddle's `version` ref / a `nextTick` signal instead of the library's events.

5. **Tests.** `Grid.test.ts`, `Tile.test.ts`, `LandingPageGridEmbed.canvas.test.ts` all
   `vi.mock("vue3-grid-layout", ...)` and assert against the layout-array model. They need
   rewriting against `@griddle/vue` (or a Griddle mock).

6. **Unused Griddle surface is opt-in, not a blocker.** Loop mode, sticky/pin/absolute positioning,
   group-drag, and draw-to-create are all config-gated and default off. They won't interfere with a
   like-for-like swap; leave `loop`, `enablePositioning` unset. (Draw-to-create fires on background
   pointer-down — confirm we don't want it, or that our overlay/handlers suppress it.)

### Verdict
Griddle preserves the current **feature scope** (nothing new turned on) while upgrading the grid to
its own collision/repack engine, and is a cleaner conceptual fit for our fixed-cell usage. It is
**not** a mechanical find-and-replace: budget for (a) a tile-model + control adapter, (b)
`Grid.vue`/`Tile.vue` rework, (c) re-wiring the layout-ready handshake, and (d) test rewrites. With
the collision-parity concern removed (we *want* Griddle's behavior), the remaining work is the
data-flow inversion — mechanical and well-scoped rather than risky.

---

## 4. Getting Griddle into the repo — recommendation: **publish to npm**

### Why npm (and not the alternatives)
- **`file:` workspace dep** (how `@grids/contracts` / `@grids/pro` are wired): those packages live
  *inside* this monorepo. Griddle lives in a **separate sibling repo** (`../griddle`). A
  `file:../../../griddle/...` path would break for every other contributor and CI who don't have
  `../griddle` checked out. `grids` is open-source — this is a non-starter.
- **git dependency** (`github:you/griddle#tag`): Griddle's repo root is a `private: true` workspace
  root, and consumers need individual `packages/*` subpaths. npm git-deps don't cleanly install a
  monorepo subpath, and you'd lose semver. Workable only as a stopgap.
- **Vendoring into `packages/`**: duplicates Griddle's source and forks it from upstream — defeats
  the point of a reusable multi-framework library.
- **npm publish**: clean semver, works for all contributors/CI, standard. Griddle is designed as a
  standalone library with React/Vue/Svelte adapters — npm is its natural distribution boundary.
  **This is the recommended path** and matches the user's leaning.

### Publishing all four packages — detailed step-by-step

Goal: publish **`@griddle/core`, `@griddle/react`, `@griddle/vue`, `@griddle/svelte`** to npm. The
root `griddle-workspace` is `private: true`, so it never publishes itself — only the four
`packages/*` go up. Do everything below from the Griddle repo root (`../griddle`).

#### Current state of each package (what's ready vs. what needs fixing)

| Package | `main`/`types` | Build today | Ships (`files`) | Blocking issues to fix before publish |
| --- | --- | --- | --- | --- |
| `@griddle/core` | `dist/` | `tsc` ✅ | `dist`, `src` | metadata only (repo/license/access); stray `src/*.head`, `src/*.fix` junk |
| `@griddle/react` | `dist/` | `tsc` ✅ | `dist`, `src` | `@griddle/core: "*"`; stray `src/GriddleGrid.tsx.fix` |
| `@griddle/vue` | `src/index.ts` | no-op echo | `src` | `@griddle/core: "*"`; ships raw `.vue`/`.ts` (no `dist`, no `.d.ts`) |
| `@griddle/svelte` | `src/index.ts` | no-op echo | `src` | `@griddle/core: "*"`; ships raw `.svelte`/`.ts`; stray `src/*.clean`, `src/*.fix` |

Two adapters (**react**) already compile to `dist` via `tsc`; the other two (**vue**, **svelte**)
are **source-distributed** — they publish raw SFC/TS and rely on the *consumer's* bundler (Vite +
`vue-tsc` / `svelte-check`) to compile them. That is legitimate and common for framework adapters,
but has two consequences you must accept or fix: consumers **must** use an SFC-aware bundler, and no
`.d.ts` ship (types resolve against the source instead). For `apps/web` (Vite) the source path works
today; publishing a compiled `dist` for vue/svelte is the more robust option if you want the packages
consumable outside Vite (see step 6).

---

#### Step 0 — npm account, org/scope, and login
1. `npm whoami` — confirm you're logged in; otherwise `npm login`.
2. Decide the scope. The packages are named `@griddle/*`, so you need the **`griddle` npm org** and
   membership in it. Check with `npm org ls griddle` (errors if it doesn't exist / you're not a
   member). Options:
   - **Create the `griddle` org** on npmjs.com (Add Organization → free for public packages), then
     keep the `@griddle/*` names as-is. *Recommended* — matches the code.
   - **Use a scope you already own** (e.g. `@trustybits/griddle-core`, …). Requires renaming every
     package and every internal `@griddle/*` import/dep. More churn.
   - **Unscoped** (`griddle-core`, …) — no org needed, but the names must be globally free on npm
     and you lose the scope grouping. Also requires renaming.
3. If you'll publish from CI later, create an **automation access token** (npm → Access Tokens →
   Granular/Automation) so 2FA doesn't block non-interactive `npm publish`.

#### Step 1 — clean stray non-source files out of `src/`
Because these packages publish via a `files` allowlist that includes `src`, any junk in `src` ships
to npm. Remove the scratch/backup variants before publishing:
```bash
cd ../griddle
git rm packages/core/src/positioning.ts.head packages/core/src/types.ts.fix \
       packages/react/src/GriddleGrid.tsx.fix \
       packages/svelte/src/GriddleGrid.svelte.clean packages/svelte/src/GriddleGrid.svelte.fix
# (double-check with: git ls-files 'packages/**/src/*' | grep -E '\.(fix|head|clean)$')
```

#### Step 2 — pin the internal `@griddle/core` dependency (all three adapters)
Every adapter lists `"@griddle/core": "*"` in `peerDependencies` **and** `devDependencies`. Unlike
pnpm/yarn's `workspace:` protocol, **npm does not rewrite `"*"` on publish** — it ships literally,
telling installers "any version," which is unpinned and fragile. In each of
`packages/{react,vue,svelte}/package.json`, change **both** occurrences to a real range:
```jsonc
"peerDependencies": { "@griddle/core": "^0.1.0", /* react|vue|svelte ... */ },
"devDependencies":  { "@griddle/core": "^0.1.0", /* ... */ }
```
Keep the framework peer (`react`/`vue`/`svelte`) as-is. Because all packages version together at
`0.1.0`, `^0.1.0` is correct now and after each bump.

#### Step 3 — add publish metadata to every package
Add to **all four** `package.json` files:
```jsonc
{
  "publishConfig": { "access": "public" },   // required: scoped packages default to private
  "license": "MIT",                          // match ../griddle/LICENSE
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<you>/griddle.git",
    "directory": "packages/<core|react|vue|svelte>"
  },
  "homepage": "https://github.com/<you>/griddle#readme",
  "keywords": ["grid", "layout", "drag", "resize", "vue", "react", "svelte"]
}
```
Also add a `prepublishOnly` safety build so you can never publish a stale `dist`:
- core/react: `"prepublishOnly": "npm run build"`
- vue/svelte: leave the existing echo build, or wire a real one (step 6).

#### Step 4 — dry-run each package to inspect the exact tarball
This is the single most valuable check — it shows precisely which files go to npm, catching junk or
a missing `dist`:
```bash
npm publish --workspace @griddle/core   --dry-run
npm publish --workspace @griddle/react  --dry-run
npm publish --workspace @griddle/vue    --dry-run
npm publish --workspace @griddle/svelte --dry-run
```
Verify: core/react tarballs contain `dist/*.js` + `dist/*.d.ts`; vue/svelte contain their
`src/*.vue|*.svelte|*.ts`; none contain `.fix`/`.head`/`.clean` files.

#### Step 5 — build, then publish **core first**, then the adapters
Order matters: the adapters declare `@griddle/core` as a dep, so core must exist on npm first (or
the very first adapter install by a consumer would 404).
```bash
cd ../griddle
npm run build   # builds core dist (tsc) + react dist (tsc); vue/svelte are source

# 1) core must go first
npm publish --workspace @griddle/core   --access public

# 2) then the three adapters (any order)
npm publish --workspace @griddle/react  --access public
npm publish --workspace @griddle/vue    --access public
npm publish --workspace @griddle/svelte --access public
```
Once metadata is in place you can shorten this to `npm publish --workspaces --access public`, but on
the **first** publish do core explicitly first so its version is live before the adapters resolve it.
Verify with `npm view @griddle/core version` (repeat per package).

> **2FA note:** if your account enforces 2FA-on-publish, each `npm publish` prompts for an OTP
> (`--otp=123456`), or use the automation token from step 0.

#### Step 6 — (recommended, optional) give vue & svelte a real `dist` build
Only if you want them consumable outside a Vite/SFC toolchain, or want shipped `.d.ts`:
- **Vue:** add `vite` (library mode) + `vue-tsc --emitDeclarationOnly` to emit `dist/griddle-vue.js`
  + `dist/index.d.ts`; point `main`/`module`/`types`/`exports` at `dist`; set `files: ["dist","src"]`;
  replace the echo `build`.
- **Svelte:** use `@sveltejs/package` (`svelte-package`) to emit a `dist` with compiled components +
  types; update `main`/`svelte`/`exports` to `dist`.
- Keep `@griddle/core` as a **peer** dependency in both so consumers dedupe a single core instance.

For the immediate `apps/web` migration this step is **not required** — the source-distributed vue
adapter compiles fine under Vite. It's purely about making the packages first-class for other
consumers.

#### Step 7 — consume in `grids`
In `apps/web/package.json`, drop `"vue3-grid-layout": "^1.0.0"` and add `"@griddle/vue": "^0.1.0"`
(which pulls `@griddle/core`). `npm install`, then do the code migration in §5.

#### Versioning going forward
All four move together at one version for now. Bump before each release (`npm version 0.1.1
--workspaces` or per package), keep the adapters' `@griddle/core` range in step with it, publish
core first. Consider `changesets` later if the packages start versioning independently.

### Interim option while iterating (skip the public release)
To validate the migration *before* the first public npm release, `npm pack` each package into a
tarball and install those into `apps/web` (`npm i ../griddle/packages/griddle-core-0.1.0.tgz` etc.,
core first). Same install shape as npm, nothing published. Swap to real npm versions once validated.
Don't commit tarballs or `file:../griddle` paths into this open-source repo.

---

## 5. Suggested migration order (once Griddle is installed)
1. Add a `contractsTile ↔ griddleTile` adapter (`{i,x,y,w,h}` ↔ `{id,col,row,w,h}`) and a
   `GridConfig` builder (`cols`, `unitWidth/Height: rowHeight`, `gap: margin`, `gravity` from
   `verticalCompact`).
2. Rewrite `Grid.vue` to render `<GriddleGrid :api>` with Tile content in the `#tile` slot; wire
   `@dragEnd`/`@resizeEnd` → `gridView.commitMove/commitResize`; drive `cols` from
   `responsiveColumnCount` via `updateConfig`.
3. Strip `<GridItem>` from `Tile.vue`; source tile geometry from slot props; remove
   `onMove/onMoved/onResize/onResized`.
4. Re-wire the layout-ready handshake to Griddle's `version` ref.
5. Update `LandingPageGridEmbed.vue` (should be minimal — outer scale is unchanged).
6. Rewrite the three mocked tests against `@griddle/vue`.
7. **Manually validate Griddle's drag/resize/compaction behavior** on real grids across
   `lg`/`md`/`sm` (validate it feels right — not that it matches `vue3-grid-layout`).
8. Remove the `vue3-grid-layout`-specific CSS in `Grid.vue`/`custom.scss`/`Tile.vue` and the
   dependency.
