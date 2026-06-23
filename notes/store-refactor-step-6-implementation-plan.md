# Store Refactor Step 6 Implementation Plan

## Purpose

Implement only Step 6, **Decouple Live and Demo Rendering**, from
`notes/store-refactor-plan.md`.

This is a plan only. Do not begin source implementation as part of this step.

Steps 1–5 are assumed complete:

- Focused stores own state; `GridController` owns cross-store workflows.
- The legacy `useGridStore()` facade still forwards to stores/controller.
- Live mutations route through controller commands with `scheduleSave()` /
  `flushSaves()` and session-scoped persistence.
- Upload completion is session/tile/upload-aware.

Step 6 introduces a rendering boundary so the marketing demo no longer borrows
and restores global session state. It must not expand into Step 7 consumer
migration or facade removal.

## Problem Statement

The marketing demo (`components/marketing/LandingPageGridEmbed.vue`) renders the
real `<Grid>` canvas by **mutating global state**:

- `onMounted` snapshots `currentGrid`, `isOwner`, `forcedBreakpoint`, then calls
  `loadDemoGrid()` and `setForcedBreakpoint()` on the shared store.
- `onBeforeUnmount` manually restores the saved `currentGrid`, `isOwner`,
  `forcedBreakpoint`, and clears `isDemoGrid`.

The whole canvas subtree (`Grid.vue`, `Tile.vue`, `tilecontent/*`,
`TileCaption.vue`, `TileToolbar.vue`, `TileActions.vue`) reads grid data,
breakpoint, `isOwner`, and `canEdit` from the global `useGridStore()`. The demo
therefore can only render by overwriting the global session, and isolation
depends on a fragile save/restore dance.

## Goal

Introduce a `GridViewContext` that the grid canvas consumes instead of reading
the global store directly:

- **Live context** reads canonical session/viewport state and dispatches
  controller commands (initially via the existing facade — see Reconciliation).
- **Demo context** owns local, read-only grid + breakpoint state, reports
  `isOwner = false` / `canEdit = false`, makes mutation commands no-ops, and
  performs no persistence, analytics, theme, or history work.

Success: mounting or unmounting the marketing demo cannot modify an active
editing session.

Failure: demo rendering still depends on replacing global store state.

## Reconciliation With Step 7

Step 7 lists "canvas and breakpoint controls" and "tile-content components" as
consumer-migration groups. To keep the two steps non-overlapping:

- **Step 6** introduces the `GridViewContext` seam and repoints the **canvas
  render subtree** (`Grid.vue`, `Tile.vue`, `tilecontent/*`, `TileCaption.vue`,
  `TileToolbar.vue`, `TileActions.vue`) at `useGridViewContext()`. The **live**
  context implementation still delegates to the `useGridStore()` facade, so live
  behavior is byte-for-byte unchanged — only one indirection is added.
- **Step 7** repoints the live context's internals off the facade onto the
  focused stores + typed controller commands, migrates the remaining non-canvas
  consumers, and deletes the facade. Canvas components do not change again.

This means Step 6 is the only step that edits the canvas subtree's data source;
Step 7 changes what the live context resolves underneath it.

## Target Files

New:

- `apps/web/src/grid-view/GridViewContext.ts` — interface + injection key.
- `apps/web/src/grid-view/useGridViewContext.ts` — `provide`/`inject` helpers.
- `apps/web/src/grid-view/createLiveGridViewContext.ts` — facade-backed live
  context.
- `apps/web/src/grid-view/createDemoGridViewContext.ts` — local read-only demo
  context.
- `apps/web/src/grid-view/__tests__/*` — context unit tests.

Edited (canvas subtree, data source only):

- `apps/web/src/components/grid/Grid.vue`
- `apps/web/src/components/grid/Tile.vue`
- `apps/web/src/components/tile/TileCaption.vue`
- `apps/web/src/components/tile/TileToolbar.vue`
- `apps/web/src/components/tile/TileActions.vue`
- `apps/web/src/components/tilecontent/*.vue`

Edited (demo isolation):

- `apps/web/src/components/marketing/LandingPageGridEmbed.vue`
- `apps/web/src/components/marketing/__tests__/LandingPageGridEmbed.test.ts`

Place new files per `docs/architecture/repository-layout.md`; if a `grid-view/`
folder is not desired, co-locate the context under `composables/` and the two
implementations under `controllers/`, but keep them in one cohesive module.

## GridViewContext Contract

Define a single interface that exposes exactly the state and commands the canvas
subtree consumes today. Derive the member list from the current `gridStore.*`
reads in the canvas files (audit first — see Slice 1).

```ts
interface GridViewContext {
  mode: "live" | "demo";

  // Read state (refs / computed; readonly to consumers)
  grid: ComputedRef<Grid | null>;
  isOwner: ComputedRef<boolean>;
  canEdit: ComputedRef<boolean>;
  isLoading: ComputedRef<boolean>;
  verticalCompact: ComputedRef<boolean>;
  activeBreakpoint: ComputedRef<Breakpoint>;
  viewportBreakpoint: ComputedRef<Breakpoint>;
  forcedBreakpoint: ComputedRef<Breakpoint | null>;
  displayPositions: ComputedRef<GridLayoutItem[]>;
  showMetaData: ComputedRef<boolean>;
  showMetaDataVerbose: ComputedRef<boolean>;
  uploadingTiles: ComputedRef<Record<string, number>>;
  resolvedUrls: ComputedRef<Record<string, string>>;
  resolvedDocumentItemUrls: ComputedRef<Record<string, Record<string, string>>>;
  activeTileId: ComputedRef<string | null>;
  activePanelId: ComputedRef<string | null>;
  pendingFocusTileId: Ref<string | null>;

  // Layout + breakpoint plumbing used by the canvas
  registerLayoutReadinessAdapter(adapter: GridLayoutReadinessAdapter): () => void;
  setActiveBreakpoint(bp: Breakpoint): void;
  setViewportBreakpoint(bp: Breakpoint): void;
  setForcedBreakpoint(bp: Breakpoint | null): void;
  setDisplayPositions(positions: GridLayoutItem[]): void;
  commitCompactedLayout(layout: GridLayoutItem[]): void;

  // Continuous gestures + mutations used by Tile/tilecontent
  beginMove(): void; commitMove(): void;
  beginResize(): void; commitResize(): void;
  beginEditing(tileId: string): void; commitEditing(tileId: string): void;
  setTileContent(tileId: string, content: AnyTileContent): void;
  patchTileContent(tileId: string, patch: Partial<AnyTileContent>): void;
  patchDocumentItem(/* ... */): void;
  updateCaption(input: UpdateCaptionInput): void;
  removeTile(tileId: string): void;
  duplicateTile(tileId: string): string | null;

  // Menus, cookies, metadata reads used by Tile/toolbars
  toggleMenuActive(tileId: string): void;
  togglePanelActive(tileId: string, panelId: string): void;
  closeMenus(): void;
  getCookieValue(name: string): string | null;
}
```

The interface should reflect the **actual** audited usage, not this draft —
trim or add members so live behavior is preserved and the demo can satisfy every
member.

## Implementation Slices

### 1. Audit Canvas Subtree Usage

- Enumerate every `gridStore.*` read and call inside `Grid.vue`, `Tile.vue`,
  `tilecontent/*`, `TileCaption.vue`, `TileToolbar.vue`, `TileActions.vue`.
- Classify each as read-state, command, or layout/breakpoint plumbing.
- This audited set is the authoritative `GridViewContext` member list.
- Confirm none of these files need members the demo cannot satisfy locally
  (e.g. persistence/analytics calls). If any do, the demo must no-op them.

### 2. Define the Context and Injection Seam

- Add `GridViewContext` and a typed `InjectionKey<GridViewContext>`.
- Add `provideGridViewContext(ctx)` and `useGridViewContext()`.
- `useGridViewContext()` returns the injected context, or **lazily constructs
  and memoizes a live context** when no provider exists. This keeps the seam
  backward-compatible: a live grid route works whether or not it explicitly
  provides a context.

### 3. Implement the Live Context (Facade-Backed)

- `createLiveGridViewContext()` wraps `useGridStore()`.
- Reads map to `computed(() => gridStore.x)`; commands bind to the matching
  facade method.
- No behavior change versus today; this is pure delegation through one seam.
- Add a unit test asserting each member forwards to the facade.

### 4. Implement the Demo Context (Local + Read-Only)

- `createDemoGridViewContext(grid: Grid)` owns:
  - `grid` as a local readonly ref (from `createDemoGrid()`).
  - `forcedBreakpoint`, `activeBreakpoint`, `viewportBreakpoint`,
    `displayPositions` as local refs.
  - `isOwner = false`, `canEdit = false`, `isLoading = false`,
    `showMetaData/Verbose = false`, empty upload maps.
- Expose a demo-only setter for `forcedBreakpoint` so the scroll-jack can drive
  it (or return the ref for the embed to write).
- All mutation commands (`removeTile`, `patchTileContent`, `commitMove`, …) are
  no-ops. `registerLayoutReadinessAdapter` returns a no-op disposer.
- `setActiveBreakpoint` / `setViewportBreakpoint` / `setDisplayPositions` write
  the local refs only.
- The demo context never imports the global store, controller, services,
  theme store, or analytics.

### 5. Repoint the Canvas Subtree at the Context

- In each canvas file, replace `const gridStore = useGridStore()` with
  `const view = useGridViewContext()` and rewrite the audited reads/calls.
- Behavior for live grids is unchanged because the live context delegates to the
  facade. Run each component's existing characterization suite after editing it.
- Keep edits mechanical: do not change command semantics, only the source.

### 6. Isolate the Marketing Demo

- In `LandingPageGridEmbed.vue`:
  - Create a demo context with `createDemoGridViewContext(createDemoGrid())`.
  - `provideGridViewContext(demoContext)` so the embedded `<Grid>` and its
    subtree resolve the demo context.
  - Drive `forcedBreakpoint` on the demo context from the existing scroll-jack
    `displayBreakpoint` watcher.
  - **Delete** all global-store interaction: remove `useGridStore()`,
    `loadDemoGrid()`, `setForcedBreakpoint()`, the `prevGrid/prevIsOwner/
    prevForcedBreakpoint` snapshots, and the `onBeforeUnmount` restore block.
  - Keep the device-frame, scroll, and click-interception logic unchanged.
- The theme-leak guard (no `applyGridTheme`) is automatically satisfied: the
  demo context performs no theme work.

## Acceptance Criteria

- Mounting the demo does not call any global store mutator and does not change
  `currentGrid`, `isOwner`, `isDemoGrid`, or `forcedBreakpoint` in the global
  session/viewport stores.
- Unmounting the demo requires no save/restore of global state and leaves any
  pre-existing global session byte-for-byte unchanged.
- The demo grid renders with `isOwner = false` / `canEdit = false` regardless of
  the global session's ownership.
- The scroll-jack still switches the demo grid between `lg`/`md`/`sm` via the
  demo context's local `forcedBreakpoint`.
- Live grid rendering and editing are unchanged; all canvas characterization
  suites pass.
- The demo context imports no store, controller, service, theme, or analytics
  module.
- `isDemoGrid` global state is no longer needed for rendering correctness (it may
  remain on the facade until Step 7; note it for removal).

## Verification

Focused tests first:

```sh
npm --prefix apps/web run test:run -- apps/web/src/grid-view/__tests__
npm --prefix apps/web run test:run -- apps/web/src/components/marketing/__tests__/LandingPageGridEmbed.test.ts
npm --prefix apps/web run test:run -- apps/web/src/components/grid/__tests__/Grid.test.ts apps/web/src/components/grid/__tests__/Tile.test.ts
npm --prefix apps/web run test:run -- apps/web/src/components/tile/__tests__ apps/web/src/components/tilecontent/__tests__
```

Then the full regression and static checks:

```sh
npm --prefix apps/web run test:run
npm --prefix apps/web run type-check
npm --prefix apps/web run lint
git diff --check
```

Searches confirming isolation:

```sh
rg -n "useGridStore" apps/web/src/components/marketing
rg -n "loadDemoGrid|setForcedBreakpoint\(prev|prevGrid" apps/web/src/components/marketing
rg -n "useGridStore" apps/web/src/components/grid/Grid.vue apps/web/src/components/grid/Tile.vue apps/web/src/components/tilecontent
```

Expected: the marketing embed no longer references `useGridStore`, `loadDemoGrid`,
or the restore dance; the canvas subtree imports `useGridViewContext` instead of
`useGridStore`.

Manual scenario:

- Load and edit an owned live grid, navigate to `/`, mount the demo, scroll
  through all three breakpoints, return to the grid, and confirm the live grid,
  ownership, breakpoint override, and history are exactly as left.

## Out of Scope (Deferred to Step 7)

- Migrating non-canvas consumers (dashboard, route, app shell, undo controls,
  settings, grid toolbar, upload composables) off the facade.
- Repointing the live context off the facade onto stores/controller.
- Deleting `grid.ts`, adding restricted-import linting, and making canonical
  state deeply readonly.
- Removing the now-unused `isDemoGrid` global flag.
