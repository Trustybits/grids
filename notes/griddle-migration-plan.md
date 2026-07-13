# Griddle Migration — Actionable Implementation Plan

Switch `apps/web`'s grid engine from `vue3-grid-layout` to `@griddle/vue`.
Companion to [`griddle-migration-analysis.md`](./griddle-migration-analysis.md) — read that first for the
_why_. This document is the _how_: concrete, ordered steps grounded in the current code.

**Prerequisites already done:** `@griddle/vue@^0.1.0` is published to npm (Trustybits org) and installed in
`apps/web/package.json`; `@griddle/core` resolves transitively. `vue3-grid-layout@^1.0.0` is still listed and
must stay until the final cleanup step.

**Guiding principle (from the analysis):** we keep the same _feature scope_ (no loop, positioning, group-drag,
or draw-to-create) but **deliberately adopt Griddle's own collision/repack semantics** — the drag feel changing
is intended, not a regression. Do not try to match `vue3-grid-layout`'s push-and-restore behavior.

---

## Key facts established from the code (read before starting)

### The current data-flow (`vue3-grid-layout`)
- `Grid.vue` renders `<GridLayout :layout="displayLayout">`; the library **mutates `displayLayout` items in
  place** (x/y/w/h) during drag/resize.
- Each tile is a `<GridItem>` inside `Tile.vue` (lines 17–35), emitting `@move/@moved/@resize/@resized`.
- Commit path is **indirect**: `Tile.vue` handlers call `gridView.beginMove()/commitMove()` and
  `beginResize()/commitResize()` (Tile.vue:440–478). Those commit functions **read positions from
  `gridView.displayPositions`**, which `Grid.vue` publishes via a `deep` watcher on `displayLayout`
  (Grid.vue:133–141 → `setDisplayPositions`). So the events are just triggers; the geometry comes from the
  live layout array. This is the seam we re-point at Griddle.
- **Responsive layout is entirely ours** and stays: `useResponsiveGridLayout` computes `responsiveColumnCount`
  and `projectedLayout` per breakpoint (`lg`/`md`/`sm`) from `Grid.tiles` + `Grid.overrides`, via
  `projectGridLayout` / `reconcileGridLayout` (`GridLayoutUtils.ts`). `vue3-grid-layout` only ever sees one
  fixed `col-num` at a time.
- **Fixed-cell trick:** container width is forced to `gridWidth = cols·rowHeight + (cols+1)·margin` with
  `rowHeight = 75`, `margin = 48` → 75×75 cells, 48px gaps. Mobile fit is our own `transform: scale()` on
  `gridInnerStyle` — **not** the library. Griddle models this natively (`unitWidth/unitHeight/gap`).
- **Layout-ready handshake** (`waitForLayoutReady` / `reportRenderedLayout` / `layoutRevision`): not cosmetic.
  It is consumed by `GridController` (line 149) and **`GridHistoryController` (undo/redo waits for the layout
  to settle at a breakpoint before restoring — GridHistoryController.ts:140)**. Griddle has no
  `layout-ready`/`layout-updated` events, so this must be re-wired to Griddle's `version` ref + `nextTick`.
- `verticalCompact` toggle: on false→true, `Grid.vue` (149–171) runs `compactGridLayout` and commits via
  `commitCompactedLayout`. Griddle exposes `config.gravity` (`'top'` ≈ vertical compact); default stays
  `'none'`.

### Griddle's Vue API (from installed `@griddle/vue@0.1.0`)
- `useGriddle({ config: GridConfig, tiles?: Tile[] })` → `api` with reactive `tiles` (shallowRef), `config`,
  `version` (ref, bumps on every engine change), plus methods: `moveTile`, `resizeTile`, `addTile`,
  `removeTile`, `updateConfig(patch)`, `toJSON()`, `loadJSON(snapshot)`, and `grid` (the raw engine).
- `<GriddleGrid :api :selection? :className? :height? :showGrid?>` owns **all** pointer handling internally.
  Slot: `#tile="{ tile, selected }"`. Emits: `dragStart(id)`, `dragEnd(id, committed)`, `resizeStart(id)`,
  `resizeEnd(id, committed)`, `selectionChange`, `drawCreate`, `cameraChange`.
- `GridConfig` fields we use: `cols`, `rows`, `unitWidth`, `unitHeight`, `gap?`, `gravity?` (default `'none'`),
  `resizeHandles?` (default `['se']`), `snapDuringDrag?` (default `true`), `tileRadius?` (default 4, exposed as
  `--griddle-tile-radius`), `dragIgnoreFrom?` (default `'a, button, input, textarea, select, [contenteditable]'`).
  Leave `loop`, `enablePositioning`, `infiniteX/Y` unset.
- Griddle `Tile`: `{ id, col, row, w, h, data?, draggable?, resizable?, minW?, minH?, maxW?, maxH?,
  resizeHandles? }`. Our `{ i, x, y, w, h }` maps to `{ id, col, row, w, h }`.
- **draw-to-create** fires on background pointer-down (`onBackgroundPointerDown` in `GriddleGrid.vue`) and emits
  `drawCreate`. We simply **don't handle `drawCreate`** — but verify a background pointer-down doesn't visibly
  ghost. It only emits; it won't mutate state unless we act on it.

### Files that touch `vue3-grid-layout` today (full blast radius)
- `components/grid/Grid.vue` — `<GridLayout>` host + layout-ready wiring + compaction watch + placeholder CSS.
- `components/grid/Tile.vue` — `<GridItem>` wrapper + move/resize handlers + `provide('gridTileW/H/X/Y')`.
- `components/marketing/LandingPageGridEmbed.vue` — same components under a `transform: scale()` scroll-jack.
- `composables/useResponsiveGridLayout.ts` — the `.vue-grid-grid` selector, `gridLayoutRef.$el` resolution,
  and the `reportRenderedLayout` handshake.
- `utils/GridLayoutUtils.ts` — a comment reference only (keep the util; it's still used for projection).
- `styles/custom.scss` — 5 `vue-grid-*` selectors (placeholder, item, dragging, resize handles).
- `components/tilecontent/MapContent.vue:238` — **comment noting vue3-grid-layout deep-clones layout items via
  JSON.parse/stringify.** Verify MapContent doesn't _rely_ on that clone stripping Mapbox instances; if it
  does, replicate the clone at our adapter boundary.
- Tests: `grid/__tests__/Grid.test.ts`, `grid/__tests__/Tile.test.ts`,
  `marketing/__tests__/LandingPageGridEmbed.canvas.test.ts` — all `vi.mock("vue3-grid-layout", ...)`.

---

## Strategy: an adapter seam, not a rewrite

The controllers (`GridController` + `internal/*`), stores, `GridViewContext`, and `useResponsiveGridLayout`'s
**projection** logic are engine-agnostic and stay. We only replace the rendering + gesture layer
(`Grid.vue` + `Tile.vue`) and re-point three seams:

1. **Load seam:** projected responsive layout (`{i,x,y,w,h}[]`) → Griddle engine (`loadJSON` + `updateConfig`).
2. **Commit seam:** Griddle `@dragEnd`/`@resizeEnd` → read engine tiles → `setDisplayPositions` (full set) →
   `commitMove`/`commitResize`. Publish live positions on `version` bumps for GridMenu/overrides snapshots.
3. **Readiness seam:** `waitForLayoutReady(breakpoint)` resolves off a `nextTick` after a load, instead of
   `reportRenderedLayout` DOM-diffing.

Keep changes reversible per-step; the app should type-check and the non-grid tests should pass after each step.

---

## Step 0 — Branch & baseline (no code change)
1. Confirm branch (`swapping-to-griddle`) and that `npm install` resolved `@griddle/vue` + `@griddle/core`
   (already present in root `node_modules/@griddle/`).
2. Capture a baseline: `npm --prefix apps/web run test:run` and `npm --prefix apps/web run type-check` — record
   what's green now so regressions are attributable.
3. Manually note current drag/resize/compaction/undo behavior on a real grid at `lg`/`md`/`sm` for later
   comparison (we're not matching it, but want to spot _breakage_ vs. _intended change_).

## Step 1 — Adapter module (`utils/GriddleAdapter.ts` or `grid/griddle/`)
Create a pure, unit-testable adapter (no Vue) so the mapping is tested in isolation:
- `toGriddleTiles(projected: GridLayoutItem[], tiles: readonly Tile[], caps): GriddleTile[]`
  — maps `{i,x,y,w,h}` → `{id,col,row,w,h}` and attaches per-tile `draggable`/`resizable`
  (from `isEditable` + tile type; e.g. suggestion tiles) and clamps `minW/minH:1`, `maxW/maxH:10`
  (matching Tile.vue's current `<GridItem>` min/max).
- `fromGriddleTiles(griddleTiles): GridLayoutItem[]` — `{id,col,row,w,h}` → `{i,x,y,w,h}`.
- `buildGridConfig({ cols, rowHeight, margin, verticalCompact }): GridConfig` — `{ cols, rows: Infinity? — no,
  keep finite large or match current unbounded-vertical expectation; unitWidth: rowHeight, unitHeight:
  rowHeight, gap: margin, gravity: verticalCompact ? 'top' : 'none', resizeHandles, snapDuringDrag: true,
  tileRadius: <tile-border-radius>, dragIgnoreFrom: 'a, button, input, textarea, select, [contenteditable],
  .tile-caption' }`.
  - **Decide `rows`:** `vue3-grid-layout` grows vertically without a fixed row count. Check whether Griddle
    requires a finite `rows` for repack (`maxRepackHops` / gravity). Start with a generous finite `rows` (e.g.
    derived from tallest tile bottom + headroom) recomputed on load; only use `Infinity`/`infiniteY` if the
    engine tolerates it for repack. Verify against `@griddle/core` `grid.ts` repack code.
- Unit-test this module first (pure functions, fast).

> **⏸ Paused pending decision.** Step-2 prep surfaced three `GriddleGrid` v0.1.0 integration
> mismatches (draw-to-create can't be disabled; hardcoded inner-scroll + `touch-action: none`;
> click-to-select). See the **Addendum (§6)** in `griddle-migration-analysis.md`. Resolve
> "enhance Griddle vs. app-side workarounds" before writing `Grid.vue` — it decides whether
> `buildGridConfig` grows new fields and whether `custom.scss` carries suppression hacks.

## Step 2 — Rewrite `Grid.vue` around `<GriddleGrid>`
Replace `<GridLayout>` with `<GriddleGrid :api>`. Keep the `scaleWrapperRef` / `gridInnerStyle` scale wrapper
exactly as-is (Griddle renders at natural pixel size, so our `transform: scale()` still works).

- `const api = useGriddle({ config: buildGridConfig(...), tiles: toGriddleTiles(projectedLayout, ...) })`.
- **Load watch:** watch `[projectedLayout, responsiveColNum, isEditable, verticalCompact]`; on change (and NOT
  during an active drag/resize) call `api.loadJSON(...)` / `api.updateConfig({ cols, gravity })` and refresh
  tiles. Guard with an `isInteracting` flag toggled by `dragStart/resizeStart` … `dragEnd/resizeEnd` so a
  reactive reload can't fight a live gesture.
- **Commit watch:** watch `api.version`; on bump, publish `fromGriddleTiles(api.tiles.value)` to
  `gridView.setDisplayPositions(...)` (replaces the old deep-watch on `displayLayout`). This keeps GridMenu /
  breakpoint-override snapshots fed with live positions.
- **Grid-level events** (moved up from Tile.vue):
  - `@dragStart` → `gridView.beginMove()` + set `isInteracting`.
  - `@dragEnd(id, committed)` → if `committed && gridView.canEdit`: publish positions, `gridView.commitMove()`;
    clear `isInteracting`.
  - `@resizeStart` → `gridView.beginResize()` + `isInteracting`.
  - `@resizeEnd(id, committed)` → publish positions, `gridView.commitResize()`; clear `isInteracting`. Also
    call the moved tile's child `onResize()` hook (see Step 3 — this was `childComponent.value.onResize()`).
- **`#tile` slot:** `<template #tile="{ tile, selected }"><GridTile :tile="lookupContractTile(tile.id)"
  :layout="fromGriddleTile(tile)" /></template>`. Look the contract `Tile` up by id from
  `gridView.grid.tiles` (as `renderedTiles` does today).
- **Compaction:** keep the `verticalCompact` false→true watch, but implement it as
  `api.updateConfig({ gravity: 'top' })` then read back + `commitCompactedLayout(fromGriddleTiles(...))`.
  Retire `compactGridLayout`/`reconcileGridLayout` from this path _only after_ confirming Griddle's `'top'`
  gravity produces acceptable results (they remain in `GridLayoutUtils` for projection).
- Remove `<GridLayout>`/`<GridItem>` imports and the `vue3-grid-layout` placeholder `<style>` block. Keep the
  scale-wrapper styles.

## Step 3 — Strip `<GridItem>` out of `Tile.vue`
- Remove the `<GridItem>` wrapper (Tile.vue:17–35, 168) and its `import { GridItem }` + `components: {GridItem}`.
  The tile's root becomes the `.grid-item-container` / `.tile-wrapper` directly (Griddle wraps it in
  `.griddle-tile` and positions it).
- Delete `onMove/onMoved/onResize/onResized` (440–478) and their `return`s (893–906). The move/resize commit
  now lives in `Grid.vue`'s grid-level handlers.
  - **Preserve two behaviors they carried:** (a) the `isMoving`/`isDragging` visual flags — re-source from
    Griddle's `.griddle-dragging`/`.griddle-resizing` classes or a slot-prop/`selected`-style signal, or drop
    if purely cosmetic; (b) `childComponent.value.onResize()` on resize end — call it from `Grid.vue`'s
    `@resizeEnd` (needs a way to reach the child; e.g. an emit up, or move the "content reflow on resize" into a
    watch on the tile's `w/h` inside the content component).
- `provide('gridTileW'|'gridTileH'|'tileX'|'tileY')` (268–285) and the `data-tile-w/h` attrs now source from
  the **slot-prop layout** passed by `Grid.vue`, not a `layout` prop mutated by the library. Signature is
  unchanged (`props.layout.{x,y,w,h}`), so keep `props.layout` — just ensure `Grid.vue` feeds it from
  `fromGriddleTile(slotTile)`.
- The `dragIgnoreFrom` selector moves to `GridConfig.dragIgnoreFrom` (Step 1). Confirm `.tile-caption`,
  toolbar buttons, inputs, and contenteditable Tiptap surfaces are all covered so drags don't hijack them.

## Step 4 — Re-wire the layout-ready handshake
- In `Grid.vue`, replace `reportRenderedLayout`-based readiness with: after a load into Griddle for
  `activeBreakpoint`, `await nextTick()` then resolve waiters for that breakpoint. Simplest: reimplement
  `waitForLayoutReady(breakpoint)` in `useResponsiveGridLayout` (or a small local composable) to resolve on the
  next `version` bump + `nextTick` after the projected layout for that breakpoint has been pushed to Griddle.
- Keep the `registerLayoutReadinessAdapter` contract (Grid.vue:104–108) intact — `GridController` (149) and
  `GridHistoryController` (140) depend on `waitForLayoutReady` resolving. **Undo/redo across breakpoints is the
  acceptance test here** — verify it settles, not just drag.
- Remove `reportRenderedLayout` DOM-diffing and the `.vue-grid-grid` selector coupling in
  `useResponsiveGridLayout` once the new signal works. `measureViewportGridRow`'s `.vue-grid-grid` selector
  (line 98) must be repointed to Griddle's container/tile selector (e.g. `[data-griddle-tile]`'s grid root) —
  it's used for viewport→grid-row mapping.

## Step 5 — `LandingPageGridEmbed.vue`
- Swap `<GridLayout>/<GridItem>` for `<GriddleGrid :api>` (read-only/lightly-interactive demo). It already
  applies its own outer `transform: scale()` per device frame — unchanged, since Griddle renders at natural px.
- Verify the demo's fixed `col-num` per device maps to `updateConfig({ cols })`, and that the scroll-sizer div
  (line 505) still matches Griddle's natural content size. Update the `.vue-grid-*` container notes/selectors
  (lines ~685) to Griddle's.

## Step 6 — CSS cleanup (`custom.scss` + `Grid.vue` + `Tile.vue`)
- Port the 5 `.vue-grid-*` rules in `custom.scss` to Griddle equivalents:
  - `.vue-grid-item` transitions/dragging → `.griddle-tile` / `.griddle-dragging` / `.griddle-resizing`
    (Griddle already applies these classes; it also does FLIP animation internally — reconcile so we don't
    double-animate).
  - `.vue-grid-placeholder` → Griddle's built-in `.griddle-drop-indicator` (styled inline by the component;
    override via that class if the default dashed blue doesn't match the theme).
  - resize-handle styling → Griddle renders handles as `[data-griddle-handle]`; restyle those.
  - `touch-action: pan-y` rule (Grid.vue:342) — verify Griddle's pointer handling already allows vertical
    scroll on touch; keep an equivalent if not.
- Wire `tileRadius` in `GridConfig` to our `--tile-border-radius` token and have tile content read
  `--griddle-tile-radius` where it currently reads the old radius, so corners stay in sync.

## Step 7 — Rewrite the three mocked tests
- `Grid.test.ts` / `Tile.test.ts` / `LandingPageGridEmbed.canvas.test.ts`: drop `vi.mock("vue3-grid-layout")`.
  Either mock `@griddle/vue`'s `GriddleGrid`/`useGriddle` with a light stub that lets you drive
  `dragEnd`/`resizeEnd`, or test against the real component. Assert on the **new commit seam**: dragEnd →
  `commitMove`, resizeEnd → `commitResize`, and that `setDisplayPositions` receives the mapped full set.
- Add coverage for the new adapter (Step 1) and the readiness re-wire (Step 4).

## Step 8 — Manual validation on real grids (behavior is intended to differ)
Validate _feel_, not parity with `vue3-grid-layout`:
1. Drag/resize across `lg`/`md`/`sm`; confirm repack (Griddle Rules 1–6) looks right and per-breakpoint
   overrides persist correctly.
2. Gravity/compaction toggle produces a sensible packed layout and persists.
3. **Undo/redo** across breakpoints (the `waitForLayoutReady` consumer).
4. Mobile `transform: scale()` fit still works (main app + marketing embed).
5. Load a few **existing persisted grids** — the analysis flags they may settle into slightly different
   positions on first drag under Griddle; confirm that's acceptable and nothing is lost.
6. `dragIgnoreFrom`: links, buttons, inputs, captions, and Tiptap editing don't trigger drags.
7. Map tiles (re: MapContent deep-clone comment) render and drag without leaking/duplicating Mapbox instances.

## Step 9 — Remove `vue3-grid-layout`
- Delete `"vue3-grid-layout": "^1.0.0"` from `apps/web/package.json`, `npm install`, commit the lockfile.
- Grep the repo for any lingering `vue-grid`/`vue3-grid-layout` references (comments in `MapContent.vue`,
  `GridLayoutUtils.ts`, `LandingPageGridEmbed.vue`) and clean or update them.
- Run `npm --prefix apps/web run suite:full` (lint + test + build) green.

---

## Open questions to resolve during implementation
1. **`rows` value for `GridConfig`** — finite (recomputed on load) vs. `Infinity`/`infiniteY`. Depends on how
   `@griddle/core` repack/gravity handle an unbounded vertical axis. Inspect `grid.ts` repack before deciding.
2. **`childComponent.onResize()` reach** — cleanest way for `Grid.vue`'s `@resizeEnd` to notify the resized
   tile's content component (emit-up vs. a `watch` on `w/h` inside content). Prefer moving the reflow into the
   content component so the grid layer stays content-agnostic.
3. **Live-position publishing cadence** — publishing on every `version` bump vs. only on gesture end. Old code
   deep-watched continuously; confirm GridMenu/override snapshots need _live_ positions or only committed ones,
   to avoid over-publishing.
4. **Double animation** — Griddle does FLIP internally; ensure our `.griddle-tile` transitions don't fight it.
5. **draw-to-create ghost** — confirm background pointer-down doesn't show a draw ghost in our editable surface
   (we ignore `drawCreate`, but the ghost is drawn by the component). If it appears, suppress via an overlay or
   check whether an unset config disables it.

## Suggested commit breakdown
- C1: adapter module + its unit tests (Step 1).
- C2: `Grid.vue` + `Tile.vue` swap + readiness re-wire (Steps 2–4).
- C3: `LandingPageGridEmbed.vue` + CSS port (Steps 5–6).
- C4: test rewrites (Step 7).
- C5: remove `vue3-grid-layout` + final cleanup (Step 9), after manual validation (Step 8).
