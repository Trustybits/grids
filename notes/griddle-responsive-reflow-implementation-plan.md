# Griddle Responsive Reflow and Projection Versioning — Implementation Plan

**Status:** Implementation in progress. Step 0 is complete; Step 1 has not
started. Bootstrap parity and final-algorithm launch remain intentionally
separate phases.

**Repositories in scope:**

- Grids app: `/Users/tylerbartschi/Documents/GitHub/grids`
- Griddle library: `/Users/tylerbartschi/Documents/GitHub/griddle`

## Objective

Move automatic responsive tile reflow into Griddle without teaching Griddle about
breakpoints or giving it responsibility for application state or persistence.

Grids remains responsible for:

- choosing `lg`, `md`, or `sm`;
- mapping those breakpoints to 12, 8, or 4 columns;
- storing canonical desktop geometry on `tiles`;
- storing optional `md`/`sm` geometry in `Grid.overrides`;
- selecting a pinned responsive-layout projection version;
- previewing and irreversibly upgrading a legacy grid;
- persisting every grid-domain field.

Griddle receives ordinary tiles, a finite target column count, an immutable
reflow strategy identifier, and optional pre-positioned geometry. It computes a
single layout without knowing why the column count changed.

## Confirmed decisions

1. Keep the existing persistence model: one canonical `tiles` array plus
   breakpoint `overrides`. Do not introduce one full tile array per breakpoint.
2. Add a persisted `responsiveLayoutVersion` field.
3. Pin projection versions to exact algorithms:
   - `legacy-v1`: the current app-owned algorithm, kept frozen in Grids.
   - `griddle-v1`: Griddle's first product reflow algorithm, frozen only after
     its follow-up algorithm-design phase is complete.
   - A future algorithm change requires a new value such as `griddle-v2`; it
     must not silently change `griddle-v1`.
4. A missing or invalid version renders defensively as `legacy-v1`.
5. A maintainer backfill stamps every missing field as `legacy-v1`.
6. At product launch, fresh grids start on the finalized `griddle-v1`.
7. Duplicated grids inherit the source grid's version.
8. Existing `md` and `sm` overrides remain authoritative through preview and
   upgrade. Upgrading does not delete or regenerate them.
9. Legacy owners can preview `griddle-v1` without persistence and can
   irreversibly switch to it.
10. Build a shared transient preview-state foundation now, but do not implement
    full “view as visitor” behavior in this project.

## Scope boundary: bootstrap parity versus final `griddle-v1`

This plan intentionally implements the new Griddle reflow machinery first with
an algorithm copied from `legacy-v1`. That temporary parity implementation is a
**bootstrap strategy** (named `preserve-v1` below), used to prove that the API,
framework adapters, projection routing, overrides, preview state, persistence,
and readiness flow all work without introducing geometry differences at the
same time.

`preserve-v1` is not the final product definition of persisted `griddle-v1`.
After this plan is implemented and verified, a separate follow-up changes the
new Griddle algorithm, assigns that final algorithm its own immutable Griddle
strategy identifier, updates the `griddle-v1` mapping, and replaces parity
expectations with explicit new expected layouts.

Consequences for this plan:

- `preserve-v1` itself remains immutable so it stays useful as a wiring/parity
  reference.
- During this plan, mapping `griddle-v1` to `preserve-v1` is allowed only in
  tests and non-production verification. Any non-production document persisted
  under that temporary mapping is disposable test data, not a compatibility
  promise.
- Do not enable the fresh-grid `griddle-v1` default, upgrade action, or
  production writes of `griddle-v1` until the follow-up algorithm is finalized.
- The schema, routing, preview, upgrade command, and creation/duplication logic
  should still be implemented and tested now so the follow-up changes the
  algorithm mapping and fixtures rather than rebuilding the architecture.
- Exact version pinning begins when the final `griddle-v1` algorithm is declared
  launch-ready; after that point it can never change in place.

## Non-goals

- Changing breakpoint thresholds, column counts, row height, or margins.
- Changing the `tiles` plus `overrides` storage shape.
- Automatically opting existing grids into Griddle behavior.
- Recomputing or materializing complete `md`/`sm` arrays during upgrade.
- Removing `legacy-v1` after migration.
- Making `Grid.updateConfig({ cols })` reflow implicitly.
- Implementing visitor-preview presentation or auditing every tile-content
  distinction between owner and visitor in this project.
- Making preview state durable across reloads or navigation.
- Designing or selecting the final `griddle-v1` geometry algorithm.
- Launching the temporary parity implementation as production `griddle-v1`.

## Current code-grounded flow

1. `apps/web/src/composables/useResponsiveGridLayout.ts` measures the viewport,
   selects the active breakpoint, maps it to a column count, and currently calls
   `projectGridLayout()`.
2. `apps/web/src/utils/GridLayoutUtils.ts` owns today's automatic projection:
   width/height scaling, collision checks, first-free placement, and application
   of partial or complete breakpoint overrides.
3. `apps/web/src/components/grid/Grid.vue` converts the projected geometry into
   Griddle tiles, calls `loadJSON()`, optionally calls `compactAll()` for gravity,
   publishes final engine positions, and marks the layout ready.
4. Desktop gesture geometry is persisted back onto `Grid.tiles`; `md`/`sm`
   gesture geometry is persisted into `Grid.overrides` by
   `GridLayoutController`.
5. Griddle's `Grid.updateConfig()` currently changes the column count without
   relocating tiles. Its virtualization range then excludes tiles outside the
   smaller finite width, which is why tiles appear to disappear in the demos.
6. Griddle's existing `pack()` is not the legacy responsive algorithm. It is a
   dense loop-layout packer and must remain a separate operation.

## Target runtime flow

```text
Grid document
  tiles (canonical lg) + overrides + responsiveLayoutVersion
                          |
                          v
Grids chooses breakpoint, columns, effective projection version
                          |
          +---------------+----------------+
          |                                |
          v                                v
     legacy-v1                        griddle-v1
 app projectGridLayout()       Griddle reflow(strategy=v1)
          |                                |
          +---------------+----------------+
                          |
                          v
          Griddle owns the one rendered engine layout
                          |
              optional Griddle compactAll()
                          |
                          v
              displayPositions / gesture commits
                          |
                          v
           Grids persists tiles or breakpoint overrides
```

Preview changes only the **effective** projection version. It does not clone the
grid, mutate tiles, alter overrides, or change the persisted version.

## Frozen bootstrap parity contract

The bootstrap `preserve-v1` strategy must reproduce the geometry returned by
today's `projectGridLayout()` before the already-existing Griddle gravity pass.
This proves the new execution path; it does not define the final geometry of
persisted `griddle-v1`.

The Griddle strategy should be named generically (for example,
`preserve-v1`), not `md`, `sm`, `responsive`, or `grids-legacy`. Tests and
non-production verification temporarily map `griddle-v1` to that strategy.

### Without pre-positioned geometry

1. Validate a positive finite target column count.
2. Sort working items by row, then column, then stable tile ID.
3. If a tile is wider than the target:
   - set width to the target column count;
   - scale height by `targetColumns / originalWidth`;
   - round height with `Math.round` and clamp it to at least 1.
4. Preserve a tile's position when it is horizontally in bounds and does not
   overlap an already placed tile.
5. Otherwise scan left-to-right and then downward for the first free position.
   Begin at the tile's current row when it is horizontally in bounds; otherwise
   begin at row 0.
6. Return tiles in their original input order and preserve every non-geometry
   property.

### With pre-positioned geometry

This generic input is how Grids passes the active breakpoint's stored override
map without exposing breakpoint semantics to Griddle.

1. Partition the input into matching pre-positioned tiles and missing tiles,
   preserving input order within each partition. The returned order is the
   pre-positioned partition followed by the newly placed partition, matching
   today's partial-override path.
2. Apply supplied positions verbatim to matching tiles, preserving current
   `legacy-v1` behavior even when stored geometry is unusual.
3. Scale only tiles that do not have a supplied position.
4. Place each missing tile in original input order at the first free location,
   scanning from row 0 around the supplied tiles.
5. Ignore supplied IDs that are absent from the tile set.
6. Preserve all supplied positions during the reflow calculation. The existing
   later gravity pass may still compact the resulting layout, exactly as it does
   today.

### Desktop behavior

Desktop remains canonical. Grids loads `lg` geometry directly unless it has the
same out-of-bounds condition for which `projectGridLayout()` currently invokes
packing. This avoids making ordinary desktop loads a new automatic reflow event.

## Step 0 — Capture baselines and parity fixtures

1. Record clean worktree status in both repositories.
2. Run current Griddle core tests and Grids' focused responsive-layout tests.
3. Convert the existing `GridLayoutUtils.test.ts` projection cases into a clear
   parity matrix covering:
   - 12→8 and 12→4 projections;
   - preserved gaps and valid positions;
   - horizontal out-of-bounds placement;
   - collisions;
   - widths larger than the target and proportional height rounding;
   - stable ID tie-breaking;
   - empty, partial, and complete overrides;
   - override entries for missing tiles;
   - input-order preservation;
   - gravity on and off.
4. Add several real-grid-shaped fixtures with mixed tile sizes and partial
   overrides. Keep expected geometry explicit so these fixtures become the
   compatibility specification, not snapshots that are casually regenerated.
5. Optionally add a deterministic seeded differential test in Grids that feeds
   valid generated layouts through both app `legacy-v1` and installed Griddle
   `preserve-v1`. Keep fixed fixtures as the primary proof and use the generated
   cases as extra collision/order coverage.

**Exit criterion:** current behavior is represented by stable expected outputs
before code is moved.

**Step 0 implementation record (2026-07-15):**

- Both worktrees were clean at baseline on
  `moving-breakpoint-tile-repositioning-to-griddle` (Grids) and
  `implementing-reflow-mechanics` (Griddle).
- Griddle core baseline: 55 tests passed with `node test/run.mjs` from
  `packages/core`.
- Grids focused baseline: 61 tests passed across `GridLayoutUtils.test.ts`,
  `useResponsiveGridLayout.test.ts`, and `Grid.test.ts`.
- The projection cases now use ten explicit golden fixtures: seven focused
  contract cases and three real-grid-shaped cases. Every fixture records both
  the frozen pre-gravity result and the result with top gravity.
- Focused verification after the fixture expansion: 77 tests passed, plus web
  type checking and targeted linting.

## Step 1 — Add a generic, versioned reflow primitive to Griddle core

Repository: `../griddle`

1. Add a dependency-free reflow module under `packages/core/src/` with public
   types similar to:

   ```ts
   type ReflowStrategy = "preserve-v1";

   interface ReflowOptions {
     cols: number;
     strategy: ReflowStrategy;
     placements?: Readonly<Record<string, CellRect>>;
   }
   ```

2. Implement a pure `reflowTiles(tiles, options)` function containing the frozen
   bootstrap parity algorithm above. Do not reuse `packing.ts`; dense packing
   and responsive reflow have different contracts.
3. Add `Grid.reflow(options)` as the stateful wrapper:
   - compute from the engine's current in-flow tiles;
   - update the finite column configuration and geometry atomically;
   - leave out-of-flow tiles untouched;
   - emit one `reflow` change event after the final state is installed;
   - return whether geometry changed;
   - reject invalid or infinite target columns without partially mutating state.
4. Add `reflow` to `GridChangeEvent` rather than reporting it as `compact` or
   `repack`.
5. Export the pure helper, options, strategy type, and method-facing types from
   `packages/core/src/index.ts`.
6. Keep `updateConfig({ cols })` side-effect-free. Consumers opt into reflow by
   calling the new operation explicitly.

**Tests in `packages/core/test/run.mjs`:**

- Exact parity fixtures from Step 0.
- Determinism, no-placement input-order preservation, and the exact
  positioned-first ordering of the partial-placement path.
- All tile metadata/capabilities survive.
- Partial placement maps and unknown IDs.
- Width/height scaling and rounding boundaries.
- Invalid columns roll back atomically.
- Out-of-flow tiles remain untouched.
- A shrink from 12 to 8/4 leaves every in-flow tile renderable and in bounds
  unless a caller-supplied placement was itself intentionally out of bounds.
- `pack()` behavior is unchanged.

**Exit criterion:** the Griddle primitive is generic, `preserve-v1` is immutable
by strategy name, and it independently proves the legacy geometry contract
without claiming to be the final product algorithm.

## Step 2 — Expose reflow consistently through Griddle adapters and demos

1. Add `reflow(options)` to Vue, React, and Svelte adapter APIs so consumers do
   not need framework-specific access patterns.
2. Verify the emitted core event refreshes each adapter's tiles, config, and
   version exactly once for the completed reflow.
3. Update finite-column controls in the Vue, React, and Svelte demos to call
   `reflow({ cols, strategy: "preserve-v1" })` when the user intentionally wants
   a responsive resize. Keep infinite-axis controls on `updateConfig()`.
4. Add a short core/API document explaining:
   - reflow is explicit;
   - Griddle has no breakpoint model;
   - `placements` are generic pre-positioned geometry;
   - strategy identifiers are immutable;
   - `pack()` and gravity solve different problems.
5. Add a changelog entry and perform the coordinated core/react/vue/svelte
   version bump required by Griddle's lockstep release policy.
6. Build/test all packages and demos, run Vue demo type checking, and run
   `npm pack --dry-run` for all four packages before maintainer publication.

**Exit criterion:** a published Griddle version exposes the bootstrap reflow
contract through every adapter, and reducing columns no longer makes ordinary
demo tiles disappear when the explicit reflow operation is used. Publishing
this reusable primitive does not authorize launching it as persisted
`griddle-v1` in Grids.

## Step 3 — Add the responsive-layout version contract to Grids

1. In `packages/contracts/src/types/Grid.ts`, add:
   - `ResponsiveLayoutVersion`;
   - constants for `legacy-v1` and `griddle-v1`;
   - the `responsiveLayoutVersion` grid field;
   - a centralized validator/resolver that falls back to `legacy-v1` for a
     missing or unsupported runtime value.
2. Keep the resolver separate from the constant for **new** grids. A defensive
   read fallback must never become the creation default by accident.
3. Create a single strategy-mapping seam in the web app; do not scatter string
   comparisons through components. During non-production parity verification it
   maps `griddle-v1` to `preserve-v1`. The follow-up replaces that one mapping
   with the finalized Griddle strategy before launch.
4. Treat unsupported future values as legacy for rendering safety, but do not
   present them as eligible for an automatic overwrite. Only an absent field or
   exact `legacy-v1` value can use the legacy→Griddle upgrade command.
5. Rebuild contracts before validating `@grids/pro`, functions, or web.

**Exit criterion:** version names and fallback semantics have one shared source
of truth.

## Step 4 — Normalize, create, duplicate, and persist versions

1. Update `packages/pro/src/dao/firebase/FirebaseUtils.ts` to normalize missing
   values to `legacy-v1` on read.
2. Apply the same normalization in
   `apps/web/src/dao/stubbed/StubbedMemoryDatabase.ts` and mock services.
3. Implement `griddle-v1` as the eventual `createDefaultGrid()` default so the
   normal fresh-grid paths can start on the new projection at launch. Keep the
   production launch gate closed during this bootstrap plan; production must
   continue creating legacy grids until final `griddle-v1` is installed.
4. Update `GridService.buildGridPayload()` to write the field on creates and
   updates.
5. In `GridService.duplicateGrid()`, copy the normalized source version instead
   of applying the fresh-grid default.
6. Verify the clone/remap path still preserves all overrides and that ownership
   transfer partial updates preserve the field unchanged.
7. Update demo/seed data deliberately:
   - use `griddle-v1` where the demo should exercise the new path;
   - use `legacy-v1` in compatibility fixtures;
   - do not let omission ambiguously choose behavior in maintained fixtures.
8. Do not add a Firestore rule change: current grid rules do not field-allowlist
   writes. Add a rule regression only if the implementation introduces field
   validation later.

**Tests:** mapper defaults/validation, stubbed mapper parity, new-grid default,
payload persistence, duplicate inheritance for both versions, and override
preservation.

**Exit criterion:** every live and stubbed read path has the same fallback; fresh
and duplicate creation paths implement and test their intentionally different
launch behavior without yet writing temporary `griddle-v1` documents in
production.

## Step 5 — Add the maintainer backfill script

1. Add a compiled admin script under
   `apps/firebase-functions/src/scripts/`, with an adjacent unit test.
2. Follow the repository's maintainer-script conventions:
   - explicit `--project`;
   - dry-run by default;
   - require both `--commit` and `--confirm <project>` to write;
   - paginated traversal of `grids` documents;
   - deterministic counters and non-zero exit on failure;
   - resumable/idempotent behavior.
3. Scan all grid documents and select only documents where the field is absent.
   Do not rewrite explicit `legacy-v1`, `griddle-v1`, or unknown values.
4. On commit, update only:

   ```ts
   { responsiveLayoutVersion: "legacy-v1" }
   ```

   Do not change `tiles`, `overrides`, `rev`, `updatedAt`, or `lastOpenedAt`.
   The stamp is behavior-preserving metadata, and avoiding those fields prevents
   false edit activity, revision conflicts, and update notifications.
5. Re-read or use an update precondition before each write so a grid created or
   upgraded during a long scan is not overwritten.
6. Unit-test pagination, default dry-run, confirmation guards, missing-only
   selection, concurrent-field appearance, idempotent reruns, and summaries.

**Exit criterion:** maintainers can prove the candidate count, safely stamp only
missing documents, and rerun the operation with zero additional writes.

## Step 6 — Route projection by effective version in the web app

1. Upgrade Grids to the published Griddle package version from Step 2.
2. Refactor `useResponsiveGridLayout.ts` so viewport measurement, breakpoint
   selection, scaling, and layout readiness remain app responsibilities, while
   the actual algorithm is selected at the Grid/engine integration seam.
3. Keep `projectGridLayout()` and its helper functions frozen for
   `legacy-v1`. Rename/comment the boundary if needed so future cleanup does not
   treat it as dead code.
4. In `Grid.vue`, resolve the effective version and perform one of two paths:
   - `legacy-v1`: project with `projectGridLayout()`, then load the result;
   - new Griddle path: load canonical tile geometry, then explicitly call the
     strategy selected by the centralized mapping with the target columns and
     the active `md`/`sm` placement map. During this plan's non-production
     verification, `griddle-v1` selects bootstrap `preserve-v1`.
5. For both paths, run the existing `compactAll()` only after projection/reflow
   when `verticalCompact` is enabled.
6. Publish `displayPositions` only from the final engine state. Do not expose an
   intermediate canonical or pre-compaction state to GridMenu or gesture commits.
7. Mark layout readiness pending before load/reflow and ready only after the
   final engine event plus Vue render tick. Preserve the existing undo/redo
   breakpoint wait contract.
8. Keep the current persistence direction unchanged:
   - `lg` commits update canonical tile positions;
   - `md`/`sm` commits update overrides;
   - merely viewing a computed layout never persists it.
9. Remove projection computation from any new-version computed path only after
   differential parity tests pass. Do not delete legacy helpers.

**Exit criterion:** identical input data can be rendered through either the
frozen legacy path or bootstrap Griddle path, and selecting the effective path
does not alter persisted data. The strategy mapping is isolated for the
follow-up algorithm change.

## Step 7 — Create the shared transient preview-state foundation

1. Add a focused `gridPreview` Pinia store rather than putting preview into the
   persisted grid, viewport, or ownership state.
2. Model active preview as an extensible discriminated union, initially:

   ```ts
   type GridPreview =
     | {
         kind: "responsive-layout";
         gridId: string;
         responsiveLayoutVersion: "griddle-v1";
       }
     | null;
   ```

   A future visitor-preview variant can extend this union without changing the
   responsive projection contract.
3. Add getters for `isActive`, `blocksGridMutation`, and the effective projection
   override. Scope state to `gridId` so stale preview cannot affect a newly
   loaded grid.
4. Reset preview during grid/session reset, navigation, passive resync, ownership
   loss, and successful upgrade.
5. Preserve `gridSession.isOwner` as **actual authorization/identity**. Do not set
   it to false to simulate preview; chat ownership and other permission behavior
   rely on it.
6. Expose preview state and the effective projection through `GridViewContext`
   so live and demo canvases keep the existing context boundary.
7. Make `canEdit` false while a blocking preview is active, while leaving the
   actual-owner GridMenu and breakpoint switcher visible as escape/navigation
   controls.
8. Introduce a controller-level mutation predicate, not only disabled buttons.
   Gate user-initiated layout, content, settings, and history commands during
   preview. Permit background completion needed to settle an already-started
   upload or persistence write.
9. Define the action taxonomy explicitly:
   - blocked: tile gestures, tile/content edits, breakpoint save/reset, gravity,
     theme/background changes, rename, undo/redo;
   - allowed: stop preview, switch breakpoint for inspection, share, and the
     confirmed projection upgrade;
   - require exiting preview first: destructive/ownership workflows if keeping
     them available would complicate state guarantees.
10. Close active tile editors/menus on preview entry and prevent a pending
    gesture from committing preview geometry.

**Future visitor-preview seam:** later work can add an effective presentation
audience separately from actual ownership. Components such as image links may
want visitor presentation, while chat must continue using actual identity. This
project must not redefine `isOwner` to mean both.

**Exit criterion:** preview is session-local, non-persistent, read-only at the
controller boundary, and safely extensible.

## Step 8 — Add legacy preview and irreversible upgrade UX

1. Add a responsive-projection section to `GridSettings.vue` for actual owners
   whose persisted value is absent or exactly `legacy-v1`.
2. Provide:
   - “Preview Griddle layout” / “Stop preview”;
   - “Switch to Griddle layout” as a separate action.
3. Projection preview changes only the preview store. It does not automatically
   force a breakpoint; the existing breakpoint switcher remains available for
   inspecting `md` and `sm` independently.
4. Add a non-dismissible preview banner to `AppStatusBanners` showing that the
   layout is read-only and providing an obvious “Stop preview” action. Keep it
   separate from the existing larger-breakpoint warning so both states can be
   represented simultaneously.
5. Require explicit irreversible confirmation before switching. The copy must
   state:
   - existing saved mobile/tablet overrides are retained;
   - automatic layouts use `griddle-v1` afterward;
   - the switch cannot be reverted through UI or undo.
6. Implement one controller command for the upgrade:
   - require actual ownership and persisted legacy eligibility;
   - set only `responsiveLayoutVersion`;
   - schedule and flush persistence;
   - clear preview only after the save succeeds;
   - restore the prior in-memory value and keep preview available if saving
     fails;
   - reject repeated calls idempotently.
7. Do not capture the version field in `GridSnapshotCodec`. On successful
   upgrade, reset/refresh grid history so undo cannot cross the irreversible
   version boundary.
8. After success, show a toast and keep the same breakpoint. The re-render now
   uses the persisted `griddle-v1` path and should match the preview exactly.
9. Visitors and already-upgraded owners see no legacy-upgrade controls.
10. Keep these controls unavailable in production during the bootstrap parity
    phase. Exercise them in tests and an explicitly non-production environment;
    the follow-up enables them only after final `griddle-v1` fixtures pass.

**Exit criterion:** preview is reversible and data-neutral; upgrade is explicit,
atomic from the user's perspective, non-undoable, and preserves overrides.

## Step 9 — Verification matrix

### Griddle unit and package verification

- `node test/run.mjs` in `../griddle/packages/core`
- `npm run build` and `npm test` from the Griddle root
- Build all three demos; run Vue demo type checking
- Dry-run all four npm package tarballs

### Grids focused tests

- `GridLayoutUtils.test.ts`: frozen `legacy-v1`
- `GriddleAdapter.test.ts` and `Grid.test.ts`: new reflow integration and final
  display positions
- `useResponsiveGridLayout.test.ts`: breakpoint/column/readiness responsibilities
- `gridPreview.test.ts`, `createLiveGridViewContext.test.ts`, and
  `createDemoGridViewContext.test.ts`: preview/effective-version behavior
- Controller tests: mutation gates, preview reset, upgrade success/failure,
  history boundary, and breakpoint persistence
- `GridSettings` component tests: eligibility, preview, stop, confirmation,
  failed save, success, and hidden controls
- `AppStatusBanners.test.ts`: simultaneous viewport and projection warnings
- `GridService.test.ts`: new default, duplicate inheritance, payload field
- Firebase/stubbed mapper tests: fallback and explicit values
- Backfill script tests

### End-to-end behavior matrix

For each of `lg`, `md`, and `sm`, verify gravity on/off and overrides
none/partial/full across:

The Griddle duplicate and fresh-grid rows below verify the eventual launch
contract behind the launch boundary. During this plan, production creation
continues to use `legacy-v1`; only tests and disposable non-production data may
exercise those rows.

| Grid state | Expected projection | Persisted changes on view |
| --- | --- | --- |
| Missing version | `legacy-v1` | None |
| Explicit `legacy-v1` | App legacy code | None |
| Legacy + bootstrap preview (non-production) | Griddle `preserve-v1` | None |
| Explicit test `griddle-v1` during bootstrap | Griddle `preserve-v1` | None |
| Duplicate of legacy | Legacy | New document carries `legacy-v1` |
| Duplicate of Griddle | Griddle | New document carries `griddle-v1` |
| Fresh grid | Griddle | New document carries `griddle-v1` |

Also verify:

- visitor rendering follows the persisted version;
- preview never leaks to another grid or page reload;
- all tiles remain present when columns shrink;
- previewed and post-upgrade geometry are identical;
- upgrade does not change tiles or overrides;
- saved overrides remain authoritative;
- adding a new tile to a partial override places only the missing tile;
- undo/redo cannot restore `legacy-v1` after upgrade;
- thumbnail/OG browser captures naturally follow each grid's persisted version.

The equality assertions in this step are bootstrap-only. The follow-up final
`griddle-v1` phase must intentionally replace them with explicit expected
differences while keeping the same persistence and preview invariants.

### Workspace verification

1. Rebuild `@grids/contracts` first.
2. Run contracts tests/type checking.
3. Run `@grids/pro` tests/type checking.
4. Run Firebase Functions tests/type checking/build.
5. Run `npm --prefix apps/web run test:run`.
6. Run `npm --prefix apps/web run type-check` and build.
7. Confirm both worktrees contain only intentional changes.

## Step 10 — Bootstrap release and follow-up handoff

1. Land and publish the coordinated Griddle release containing explicit reflow
   plus immutable `preserve-v1`. Publishing remains a maintainer action.
2. Update Grids' lockfile to that release and run the complete bootstrap parity
   verification matrix.
3. Implement all schema, fallback, duplication, routing, preview, upgrade, and
   backfill mechanics, but do not launch temporary parity behavior as product
   `griddle-v1`:
   - production fresh-grid creation remains legacy;
   - production preview/upgrade controls remain disabled;
   - no production grid is intentionally written as `griddle-v1`;
   - do not commit the production backfill yet if old clients can still create
     unversioned grids and a later rerun is not planned.
4. If the shared code must deploy before the final algorithm, use one
   deployment-wide launch gate with a production-safe default. Do not use a
   per-user experiment to choose a persisted creation version.
5. Verify the complete flow in tests and an explicit non-production project:
   - missing/legacy grids use app legacy;
   - bootstrap preview uses Griddle `preserve-v1` and writes nothing;
   - upgrades of disposable test grids persist `griddle-v1` and preserve
     overrides;
   - fresh test grids and duplicates follow the intended version rules;
   - switching breakpoints never loses tiles.
6. Hand off to a separately planned final-algorithm phase that:
   - implements the intended new Griddle v1 geometry under a new immutable
     Griddle strategy identifier (for example, `reflow-v1`);
   - adds explicit golden fixtures for its intentionally different outputs;
   - updates the single Grids mapping from bootstrap `preserve-v1` to that final
     strategy;
   - reruns preview-versus-post-upgrade, override, readiness, and persistence
     tests;
   - only then enables the fresh-grid default and irreversible upgrade UI.
7. The final-algorithm phase owns production deployment and backfill execution:
   deploy defensive readers and final routing first, dry-run the backfill,
   commit it after the compatible client is live, rerun to zero, and sample old,
   fresh, duplicated, previewed, and upgraded grids.

## Eventual production rollback model

- Before a grid is upgraded, rollback is straightforward: deploy a client that
  continues routing `legacy-v1` and hide the upgrade UI.
- Backfilled fields are harmless and should not be removed.
- A grid already switched to `griddle-v1` must continue to have a supported
  `griddle-v1` implementation even if the UI feature is rolled back. Never map
  it back to mutable “latest” behavior.
- Because upgrade preserves tiles and overrides, emergency rendering can fall
  back to an explicitly supported compatibility implementation, but the
  persisted version must not be rewritten automatically. Bootstrap
  `preserve-v1` is not automatically the correct fallback once final
  `griddle-v1` intentionally differs.
- Do not unpublish or remove the Griddle release consumed by deployed Grids.

## Completion criteria

This project is complete when:

1. Griddle exposes an explicit, breakpoint-agnostic, immutable `preserve-v1`
   reflow operation.
2. Differential tests prove app `legacy-v1` and bootstrap Griddle
   `preserve-v1` produce the same geometry for the compatibility matrix.
3. Existing and missing-version grids remain on frozen legacy behavior.
4. Fresh-grid `griddle-v1` creation and duplicate inheritance are implemented
   and tested behind the launch boundary.
5. The backfill script is ready to safely stamp every missing production field
   as `legacy-v1`; production execution remains in the final-algorithm phase.
6. Legacy owners can exercise preview and irreversible upgrade without writes
   or lost overrides in tests/non-production, while production controls remain
   disabled.
7. Preview state is transient, mutation-safe, and structurally ready for a later
   visitor-preview mode without conflating presentation with authorization.
8. Both repositories pass their full tests, type checks, builds, and release
   preflights.
9. The follow-up has a narrow handoff: replace the centralized strategy mapping
   and parity fixtures with the final `griddle-v1` algorithm, then launch.
