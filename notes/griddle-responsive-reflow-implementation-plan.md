# Griddle Responsive Reflow and Projection Versioning — Implementation Plan

> [!WARNING]
> **DEPRECATED — HISTORICAL RECORD ONLY.** This plan is old, is no longer the
> current implementation direction, and must not be used for further work.
> It is retained only to record the decisions and implementation history that
> led to the pivot. The current plan is
> [`griddle-owned-responsive-reflow-refactor-plan.md`](./griddle-owned-responsive-reflow-refactor-plan.md).

**Status:** Deprecated and superseded on 2026-07-16. Do not execute any
remaining steps or treat the architecture below as current guidance.

**Repositories in scope:**

- Grids app: this repository (`grids`)
- Griddle library: the sibling repository (`../griddle`)

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
   selects the active breakpoint, maps it to a column count, manages scaling,
   and exposes the layout-readiness contract.
2. `apps/web/src/utils/GridLayoutUtils.ts` owns today's automatic projection:
   width/height scaling, collision checks, first-free placement, and application
   of partial or complete breakpoint overrides.
3. `apps/web/src/components/grid/Grid.vue` resolves the effective version and
   routes either frozen app projection or explicit Griddle reflow, then applies
   optional gravity, publishes only final engine positions, and marks the
   layout ready after render.
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

**Step 1 implementation record (2026-07-15):**

- Added the dependency-free `reflowTiles()` primitive, immutable
  `preserve-v1` strategy, `ReflowOptions`, and public exports in Griddle core.
- Added atomic `Grid.reflow()`: it reflows only in-flow tiles, installs finite
  columns and geometry before notification, leaves out-of-flow tiles untouched,
  emits one `reflow` event, and keeps gravity and dense packing separate.
- Mirrored all ten Step 0 pre-gravity fixtures in Griddle and added coverage for
  determinism, metadata, rounding, invalid-input rollback, event atomicity,
  out-of-flow behavior, finite conversion, renderability, gravity separation,
  and unchanged `pack()` behavior.
- Verification: 79 Griddle core tests passed, all existing adapter tests passed,
  and the complete Griddle package build succeeded.
- No adapter API/demo/documentation or package-version changes were made; those
  remain Step 2 work.

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

**Step 2 implementation record (2026-07-15):**

- Added the same `api.reflow(options)` method to the React, Vue, and Svelte
  adapters and verified that one completed core event refreshes adapter tiles,
  config, and version exactly once.
- Replaced React's tile-count/config-string snapshot with a monotonic revision
  source so geometry-only events cannot be dropped.
- Updated all three demos' finite column controls to call
  `reflow({ strategy: "preserve-v1" })`; infinite-axis controls continue using
  `updateConfig()`.
- Added `docs/reflow.md`, linked reflow guidance from the root and package
  READMEs, and added the `0.1.5` changelog entry.
- Coordinated the `0.1.5` bump across core/react/vue/svelte, all adapter core
  peer/dev ranges, and `package-lock.json`.
- Verification: full package build and tests passed (79 core tests and 6 tests
  per adapter), all three demos built, Vue demo type checking passed, and all
  four `npm pack --dry-run` tarballs contained the expected `0.1.5` artifacts.
- Griddle `0.1.5` was subsequently published by the maintainer. Grids remains
  on `@griddle/vue` `0.1.4` until the planned runtime integration in Step 6.

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

**Step 3 implementation record (2026-07-15):**

- Added the shared `ResponsiveLayoutVersion` vocabulary, exact `legacy-v1` and
  `griddle-v1` constants, supported-value validator, and optional
  `Grid.responsiveLayoutVersion` field in `@grids/contracts`.
- Added a defensive resolver that maps missing, malformed, and unsupported
  future runtime values to `legacy-v1` for rendering.
- Kept `NEW_GRID_RESPONSIVE_LAYOUT_VERSION` (`griddle-v1`) separate from that
  read fallback. Production creation remains gated until the final Griddle
  strategy is launch-ready.
- Added centralized upgrade eligibility: only an absent value or exact
  `legacy-v1` is eligible; unknown future values render as legacy but cannot be
  automatically overwritten.
- Added the web's single strategy-mapping seam. During bootstrap verification,
  resolved `griddle-v1` maps there to Griddle `preserve-v1`; `legacy-v1`
  continues to select the app-owned projection path.
- Kept persistence normalization, creation/duplication behavior, runtime
  projection routing, and the Griddle dependency upgrade in their later
  planned steps.
- Verification: contracts build/tests/type-check/lint passed (24 tests), Pro
  build/tests/type-check/lint passed (241 tests), Firebase Functions
  build/tests/type-check/lint passed (894 tests), and the complete web suite
  passed (141 files / 2,599 tests plus type-check and production build).

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

**Step 4 implementation record (2026-07-15):**

- Normalized missing, malformed, and unsupported responsive-layout values to
  `legacy-v1` in the Firebase mapper, stubbed database mapper, and mock grid
  service while preserving explicit supported values. Read-time status remains
  transiently available so unknown future values stay ineligible for upgrade
  and ordinary saves do not overwrite them with `legacy-v1`.
- Made `createDefaultGrid()` use the eventual `griddle-v1` new-grid default,
  but routed real `GridService.createGrid()` calls through the single
  deployment-wide creation gate, which remains pinned to `legacy-v1` during
  bootstrap.
- Added `responsiveLayoutVersion` to both create/save and update payloads.
- Made duplicates inherit the normalized source version rather than the fresh
  grid default, and verified both `legacy-v1` and `griddle-v1` inheritance
  alongside breakpoint override ID remapping.
- Marked the homepage demo explicitly as `griddle-v1` for the future routed
  demo path and the maintained mock fixture explicitly as `legacy-v1` for
  compatibility coverage.
- Verified ownership transfer continues using a partial grid update that omits
  `responsiveLayoutVersion`, preserving the stored value unchanged.
- Added no Firestore rule or Griddle dependency changes.
- Verification: contracts build/tests/type-check/lint passed (24 tests), Pro
  build/tests/type-check/lint passed (242 tests), Firebase Functions
  build/tests/type-check/lint passed (894 tests), and the complete web suite
  passed (142 files / 2,608 tests plus type-check and production build).

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

**Step 5 implementation record (2026-07-15):**

- Added the compiled `backfillResponsiveLayoutVersion` maintainer CLI and the
  `responsive-layout:backfill` package command.
- Required an explicit `--project`; dry-run remains the default, and writes
  require both `--commit` and an exact `--confirm <project>`. Existing Firebase
  project environment variables must also match the selected project.
- Added deterministic document-ID pagination in 300-document pages and stable
  counters for scanned pages/documents, missing candidates, explicit supported
  values, unknown values, proposed/actual writes, and concurrent skips.
- Selected only documents where `responsiveLayoutVersion` is truly absent.
  Explicit `legacy-v1`, `griddle-v1`, null/malformed, and unknown future values
  are counted but never rewritten.
- Re-read each commit candidate inside a Firestore transaction and update only
  `{ responsiveLayoutVersion: "legacy-v1" }` if the field is still absent.
  Concurrent field additions and document deletion are skipped; interrupted
  runs remain safe to resume and completed runs are idempotent.
- Added 20 isolated tests covering argument/confirmation guards, project
  mismatch protection, pagination, default dry-run, missing-only selection,
  Firestore query/update shape, concurrent changes, idempotent reruns, cursor
  safety, and deterministic summaries.
- Verification: the compiled CLI returned exit code 1 before Firebase access
  for missing-project and unconfirmed-commit invocations. Contracts passed 25
  tests, Pro passed 242 tests, Firebase Functions passed 914 tests, and web
  passed 2,615 tests across 142 files; all builds, type-checks, and lints passed.
- The backfill was not run against any Firebase project, so no documents were
  changed.

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

**Step 6 implementation record (2026-07-15):**

- Upgraded the web app and lockfile to published `@griddle/vue` 0.1.5 and its
  `@griddle/core` 0.1.5 peer.
- Removed tile projection from `useResponsiveGridLayout`; it now owns only
  viewport measurement, breakpoint/column selection, scaling, height
  observation, and pending/ready coordination.
- Routed rendering in `Grid.vue` from the defensively resolved effective
  version. Missing, malformed, unknown, and explicit `legacy-v1` values use the
  frozen `projectGridLayout()` path. Explicit `griddle-v1` loads canonical
  geometry and calls Griddle `reflow()` with the centralized `preserve-v1`
  strategy, target columns, and converted active `md`/`sm` placements.
- Kept gravity after projection/reflow for both paths. Removed the broad engine
  version publisher so canonical, pre-reflow, and pre-compaction events cannot
  escape through `displayPositions`; only the generation-current final engine
  state is published after Vue's render tick.
- Added explicit same-breakpoint pending readiness and retained the existing
  breakpoint waiter contract. Demo contexts now seed canonical geometry rather
  than precomputing a legacy projection for their `griddle-v1` grid.
- Added focused coverage for routing, placement conversion, final-only
  publication, data-neutral viewing, differential legacy/bootstrap parity, and
  readiness reset. The focused matrix passed 122 tests across six files.
- Verification: the complete web suite passed 2,620 tests across 142 files;
  web lint, type-check, dependency builds, and production build all passed.

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

**Step 7 implementation record (2026-07-15):**

- Added the focused `gridPreview` Pinia store with an extensible
  `responsive-layout` discriminated union. All state queries require the current
  grid ID, so a stale preview is inert for another grid or an empty session.
- Added scoped `isActive`, `blocksGridMutation`, and responsive-layout override
  getters plus idempotent start, stop, and reset actions. Preview state remains
  session-local and is never added to a grid or persistence snapshot.
- Exposed active preview, mutation blocking, and the effective responsive
  layout version through `GridViewContext`. Live contexts combine the scoped
  preview override with the defensively resolved persisted version; demo
  contexts expose the same contract without importing live stores.
- Kept `gridSession.isOwner` as actual identity. Preview makes `canEdit` false
  through the controller's edit predicate while owner-only navigation controls
  can remain visible.
- Added a controller-level user-mutation boundary covering tile gestures,
  history, content, layout/breakpoint writes, tile structure, settings, rename,
  and active-grid deletion. Breakpoint inspection and preview exit remain
  allowed. Upload resolution and the persistence scheduler retain their
  ownership/breakpoint authorization path so work started before preview can
  settle and save. Valid pre-preview upload failures use a narrow, upload-record
  scoped rollback path so their optimistic tile can be removed or restored
  without reopening general mutation during preview.
- Preview entry clears pending edit/move/resize transactions and active tile
  menus before changing effective geometry. `Grid.vue` now queues an engine
  resync requested during a live gesture, rejects the gesture commit once
  preview is read-only, and renders the preview immediately after gesture end.
- Reset preview during session replacement/clear/navigation, stale-grid passive
  reload, and realtime ownership loss. The same stop/reset action is available
  for Step 8 to invoke only after a successful irreversible upgrade save.
- Added focused store, context, controller, lifecycle, canvas, and interaction
  coverage, including grid scoping, persisted-versus-effective version
  separation, mutation taxonomy, upload settlement, and mid-gesture preview.
- Verification: the complete web suite passed 2,632 tests across 143 files;
  web lint, type-check, dependency builds, and production build all passed.

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

**Step 8 implementation record (2026-07-15):**

- Added a responsive-layout section to `GridSettings.vue` through the focused
  `ResponsiveLayoutSettings.vue` component. It is shown only to actual owners
  of missing or explicit `legacy-v1` grids in non-production environments;
  visitors, unsupported versions, upgraded grids, and production builds have
  no upgrade controls.
- Added separate preview/stop and irreversible switch actions. Preview remains
  grid-scoped and data-neutral and does not change the selected breakpoint.
- Added an explicit confirmation modal stating that saved mobile/tablet
  overrides remain, automatic layouts use `griddle-v1`, and UI/undo cannot
  revert the switch. Success is acknowledged only after persistence completes.
- Added `GridController.upgradeResponsiveLayout()` as the single upgrade
  command. It requires actual ownership and persisted legacy eligibility,
  rejects concurrent/repeated calls, drains earlier queued saves, changes only
  `responsiveLayoutVersion`, schedules and flushes the upgrade snapshot, and
  revalidates the session before crossing the boundary.
- On persistence failure the controller restores the exact prior in-memory
  version, retains preview and history, and leaves the failed persistence lane
  ready for an immediate retry. On success it clears preview, preserves the
  current breakpoint, initializes a fresh history manager, and refreshes the
  stable snapshot so undo cannot cross the version boundary.
- Added a non-dismissible read-only preview banner to `AppStatusBanners` with a
  direct stop action. It is independent of the larger-breakpoint warning, and
  `App.vue` scopes it to the active grid preview.
- Added focused controller and component coverage for missing/legacy
  eligibility, visitors, unsupported and upgraded versions, production
  hiding, preview/stop, confirmation copy, success, rollback and retry,
  idempotency, history reset, breakpoint preservation, toast timing, and
  simultaneous status banners.
- Verification: the complete web suite passed 2,644 tests across 144 files;
  web lint, type-check, dependency builds, and production build all passed.

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

The Griddle duplicate and fresh-grid rows below verify the launched
`griddle-v1` contract. The final Griddle strategy is now distinct from the
bootstrap parity strategy.

| Grid state | Expected projection | Persisted changes on view |
| --- | --- | --- |
| Missing version | `legacy-v1` | None |
| Explicit `legacy-v1` | App legacy code | None |
| Legacy + `griddle-v1` preview | Griddle `griddle-v1` | None |
| Explicit `griddle-v1` | Griddle `griddle-v1` | None |
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

Final `griddle-v1` assertions must use explicit expected differences from
legacy while keeping the same persistence and preview invariants.

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

**Final `griddle-v1` algorithm implementation record (2026-07-16):**

- Added a new immutable Griddle core strategy named `griddle-v1`; the bootstrap
  `preserve-v1` implementation remains unchanged as a compatibility reference.
- Chose Griddle's dense packer as the gesture-independent reflow behavior.
  Directional movement and add-displacement were not reused because breakpoint
  changes have no user gesture origin, target direction, or privileged new
  tile from which to derive those rules.
- Automatic tiles trim widths at the finite edge without proportionally
  changing height, matching Griddle's finite creation/resize footprint rule,
  then use the same exact-search/greedy dense packing model as `Grid.pack()`.
- Caller placements are validated and installed as immutable anchors. Missing
  tiles use largest-first top-left packing around occupied anchor cells;
  unknown placement IDs remain ignored.
- Grids maps persisted `griddle-v1` directly to Griddle `griddle-v1`, leaves
  canonical desktop geometry unreflowed, and skips post-reflow gravity whenever
  active breakpoint placements exist so saved positions and sizes stay exact.
- Replaced bootstrap parity expectations with versioned golden behavior and an
  `lg`/`md`/`sm` matrix covering gravity plus empty, partial, and full overrides.
- Prepared coordinated Griddle 0.1.9 packages and updated Grids to require
  `@griddle/vue`/`@griddle/core` 0.1.9. Publish Griddle 0.1.9 before deploying
  the corresponding Grids lockfile; publishing remains a maintainer action.

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

1. Griddle exposes explicit, breakpoint-agnostic, immutable `preserve-v1` and
   final `griddle-v1` reflow operations.
2. Differential tests preserve bootstrap parity while golden tests prove final
   `griddle-v1` produces its intentional dense-packing differences.
3. Existing and missing-version grids remain on frozen legacy behavior.
4. Fresh grids launch on `griddle-v1`; duplicate inheritance remains explicit
   and tested for both persisted versions.
5. The backfill script is ready to safely stamp every missing production field
   as `legacy-v1`; production execution remains in the final-algorithm phase.
6. Legacy owners can exercise preview and irreversible upgrade without writes
   or lost overrides in tests/non-production, while production controls remain
   disabled.
7. Preview state is transient, mutation-safe, and structurally ready for a later
   visitor-preview mode without conflating presentation with authorization.
8. Both repositories pass their full tests, type checks, builds, and release
   preflights.
9. The centralized mapping and fixtures use final `griddle-v1`; coordinated
   Griddle 0.1.9 artifacts are release-ready before the matching Grids deploy.
