# Griddle-Owned Responsive Reflow Refactor Plan

**Status:** Implementation and verification are complete through Step 8 except
for Step 7's final registry dependency and lockfile refresh, which intentionally
waits for the maintainer to publish Griddle 0.1.10.

**Created:** 2026-07-16

**Supersedes:**
[`griddle-responsive-reflow-implementation-plan.md`](./griddle-responsive-reflow-implementation-plan.md),
which is deprecated and retained only as a historical record.

**Repositories in scope:**

- Grids app: this repository (`grids`)
- Griddle library: the sibling repository (`../griddle`)

## Objective

Make responsive reflow a Griddle-only implementation detail while preserving
the exact geometry behavior of the app's historical projection algorithm.
This is an ownership refactor, not an algorithm redesign.

After this work:

- Grids owns breakpoint selection, breakpoint meanings, target column counts,
  canonical desktop geometry, saved breakpoint overrides, and persistence.
- Griddle owns all geometry calculation needed to reflow ordinary tiles to a
  caller-supplied finite column count.
- Grids always activates Griddle reflow when deriving a narrower layout. It has
  no alternate app-owned projection path and no algorithm-selection branch.
- The sole supported responsive-layout stamp and Griddle reflow strategy is
  `griddle-v1`.
- `griddle-v1` means "the historical Grids responsive projection algorithm,
  now owned and executed by Griddle." It does not mean the newer dense-packing
  algorithm currently present in Griddle.
- Existing saved `md` and `sm` overrides remain authoritative placements.
- The Griddle-layout preview and one-way "Switch to Griddle layout" feature are
  removed. Generic transient preview-state foundations remain available for
  future, unrelated preview features.
- A maintainer migration stamps existing grid documents as `griddle-v1` after
  the single-path runtime is deployed.

## Non-negotiable behavior contract

The algorithm to keep is the behavior currently implemented by
`apps/web/src/utils/GridLayoutUtils.ts::projectGridLayout()` and already copied
into Griddle as `preserve-v1`. The dense algorithm currently named
`griddle-v1` in Griddle is removed rather than retained under another name.

The sole final Griddle strategy, named `griddle-v1`, must behave as follows.

### Automatic layout without saved placements

1. Validate a positive finite integer target column count.
2. Sort working tiles by row, then column, then stable tile ID.
3. If a tile is wider than the target, set its width to the target and scale
   its height proportionally by `targetColumns / originalWidth`, using
   `Math.round` and a minimum height of 1.
4. Preserve a tile's current position when it is horizontally in bounds and
   does not collide with an already placed tile.
5. Otherwise scan left-to-right and then downward for the first free position.
   Start at the tile's current row when its horizontal position is in bounds;
   otherwise start at row 0.
6. Return tiles in original input order and preserve all non-geometry data and
   capabilities.

### Layout with saved placements

1. Treat every matching caller-supplied placement as authoritative geometry.
2. Validate authoritative placements before committing any state; invalid,
   overlapping, or out-of-bounds placements fail atomically.
3. Scale only tiles without a matching placement when they are wider than the
   target.
4. Place unpositioned tiles one at a time into the first free position,
   scanning from row 0 around the authoritative tiles.
5. Preserve authoritative placement position and size exactly.

The existing requirement that user-authored breakpoint overrides have priority
remains in force. When an active breakpoint has saved placements, Grids must
not invoke a later gravity pass that would move those anchors. Gravity remains
a separate Griddle operation for layouts without authoritative placements; it
is not part of the reflow algorithm.

## Target ownership boundary

```text
Grids
  observe/force lg, md, or sm
  map breakpoint to target columns
  load canonical tiles and active saved overrides
                    |
                    v
Griddle
  reflow({ cols, strategy: "griddle-v1", placements? })
  install one validated layout atomically
                    |
                    v
Grids
  publish display geometry
  persist user gestures to canonical tiles or breakpoint overrides
```

Griddle must not learn about `lg`, `md`, `sm`, viewport thresholds, Firestore,
or the Grids persistence shape. Grids may adapt its domain tile and override
shapes into Griddle inputs, but it must not calculate responsive tile geometry.

## Version-stamp policy

1. `griddle-v1` is the only supported `ResponsiveLayoutVersion` and the only
   supported Griddle `ReflowStrategy` after the refactor.
2. Missing, old, malformed, or otherwise unsupported stored values resolve to
   `griddle-v1` for rendering. Stored version data never selects a second
   runtime algorithm.
3. Keep the generic read-time supported/unsupported classification if needed
   to avoid clobbering a future version written by a newer client. Remove all
   eligibility and routing semantics tied to `legacy-v1`.
4. Fresh grids and duplicates write `griddle-v1` directly. Duplication no
   longer needs to inherit an old algorithm choice because no such choice
   exists.
5. The literal `legacy-v1` may remain only inside the maintainer migration as
   an old-data sentinel. It must not remain in app runtime algorithm code,
   contracts as a supported value, UI, or tests except migration fixtures.

For migration safety, the maintainer script will update documents whose stamp
is missing or exactly `legacy-v1`, leave documents already on `griddle-v1`
unchanged, and report any unknown value as a blocking anomaly rather than
silently overwriting a possible future version. A successful migration run
therefore requires the unknown count to be zero and leaves every preexisting
known grid stamped `griddle-v1`.

## Preview boundary

Remove the responsive-layout-specific preview and upgrade feature:

- the "Preview Griddle layout" button and preview banner;
- the "Switch to Griddle layout" button, confirmation modal, toast, and
  irreversible upgrade command;
- responsive-version override state used to select a preview algorithm;
- controller and view-context methods dedicated to starting responsive-layout
  preview or upgrading the version.

Do not remove the generic preview-state foundation. Keep a session-local,
grid-scoped preview store capable of holding a future preview descriptor,
answering whether it blocks grid mutation, and being reset on grid/session
changes. Generalize names or APIs that currently hard-code
`responsive-layout`, but do not invent a replacement product preview.

The breakpoint switcher itself stays. It belongs to Grids' breakpoint
ownership and is unrelated to the removed "Switch to Griddle layout" action.

## Implementation sequence

### Step 1 — Freeze the parity fixtures before deleting either implementation

**Status:** Complete (2026-07-16).

1. Inventory the fixed cases in
   `apps/web/src/utils/__tests__/GridLayoutUtils.test.ts` and the existing
   `preserve-v1` fixtures in `packages/core/test/run.mjs`.
2. Move or reproduce all behavior-defining fixtures at the Griddle core
   boundary before deleting the Grids implementation.
3. Cover automatic layouts, partial and complete placements, wide-tile
   proportional scaling, preserved gaps, collisions, horizontal overflow,
   deterministic ordering, metadata preservation, invalid inputs, and atomic
   failure.
4. Add a temporary parity comparison during implementation if useful, but do
   not ship a Grids runtime fallback or dual-path feature flag.

**Exit criterion:** Griddle tests completely describe the old app algorithm
without depending on Grids source at runtime.

**Implementation record:** The complete fixed and product-shaped Grids parity
matrix now runs against Griddle's public `griddle-v1` strategy. Additional core
coverage locks deterministic ordering, immutability, metadata/capability
preservation, proportional scaling boundaries, stale-only placement maps,
exact authoritative placement geometry, invalid inputs, atomic state changes,
out-of-flow behavior, and separation from gravity and `pack()`.

### Step 2 — Make `griddle-v1` the sole Griddle reflow implementation

**Status:** Complete locally (2026-07-16); package version 0.1.10 is prepared but
has not been published.

1. In `packages/core/src/reflow.ts`, reduce `ReflowStrategy` to
   `"griddle-v1"` and attach that name to the current `preserve-v1` algorithm.
2. Remove the current dense `griddle-v1` implementation, width-trimming
   behavior, exact/greedy packing calls, and dense-packing rationale.
3. Remove `preserve-v1` as a public strategy name. It was a bootstrap name and
   must not remain as a second supported algorithm.
4. Remove `computePackAround()` from `packages/core/src/packing.ts` if it has no
   non-reflow consumer. Keep Griddle's ordinary `pack()` implementation intact;
   dense loop packing remains a separate feature.
5. Keep `Grid.reflow()` explicit, breakpoint-agnostic, atomic, limited to
   in-flow tiles, and responsible for installing the target column count before
   emitting one final `reflow` event.
6. Update core and adapter tests, all adapter demos, package READMEs, root
   README, `docs/reflow.md`, and the changelog so they describe the sole parity
   algorithm accurately.
7. Prepare all Griddle packages in lockstep. If the currently prepared package
   version has not been published, replace its unreleased contents; otherwise
   use the next coordinated patch version. Publishing remains a maintainer
   action and is not part of an implementation run unless explicitly requested.

**Exit criterion:** searching the Griddle checkout finds no supported
`preserve-v1` strategy and no dense responsive `griddle-v1` path; every adapter
exposes the same sole reflow contract.

**Implementation record:** Griddle now exposes only `griddle-v1`, backed by the
historical gap-preserving projection previously named `preserve-v1`. The dense
responsive implementation and its anchor-aware `computePackAround()` helper
were removed without changing ordinary loop `pack()`. Core and adapter tests,
demos, public reflow documentation, the root README, and the changelog now use
the sole strategy. All four packages are aligned at 0.1.10 with adapter
`@griddle/core` ranges at `^0.1.10`; build, tests, demo builds, Vue template type
checking, and four-package dry-run packing pass locally.

### Step 3 — Collapse the Grids version model to one supported stamp

**Status:** Complete (2026-07-16).

1. In `packages/contracts/src/types/Grid.ts`, remove `legacy-v1` from the
   supported vocabulary and remove `isResponsiveLayoutUpgradeEligible()`.
2. Make `griddle-v1` the creation, duplication, resolution, and rendering
   default everywhere.
3. Retain only generic forward-compatibility handling needed to distinguish a
   supported stamp from missing or unknown raw data; it must not affect which
   algorithm renders.
4. Update Firebase and stubbed DAO mappers, GridService, MockGridService,
   fixtures, and tests so ordinary reads all render through Griddle and all new
   writes carry `griddle-v1`.
5. Ensure ordinary saves do not accidentally overwrite an unknown future stamp
   before the maintainer migration has classified it.

**Exit criterion:** Grids has one supported version value and zero runtime
upgrade-eligibility concepts.

**Implementation record:** The shared contract now supports only
`griddle-v1`; every missing, malformed, or unknown raw value resolves to that
same rendering version while retaining generic read-time status metadata.
Fresh grids, duplicates, Firebase reads, stubbed reads, and mock data all use
`griddle-v1`. Ordinary saves and updates omit the version field when a mapper
classified the stored value as unsupported, preserving a possible future
stamp in persistence. The old upgrade-eligibility predicate was removed, and
the responsive-layout preview and upgrade entry points are dormant pending
their full deletion in Step 5.

### Step 4 — Replace Grids' dual projection route with one Griddle call

**Status:** Complete (2026-07-16).

1. In `apps/web/src/components/grid/Grid.vue`, always map canonical contract
   tiles to Griddle tiles and load them under their canonical/base column count.
2. For a derived narrower breakpoint, call `api.reflow()` exactly once with the
   target column count, `strategy: "griddle-v1"`, and the active breakpoint's
   saved placements when present.
3. Keep desktop canonical geometry unreflowed when the active target equals the
   canonical column count.
4. Keep the settled-state publication and layout-readiness transaction: no
   intermediate load/reflow event may be published to app state.
5. Apply Griddle gravity only when enabled and no authoritative placements are
   active. Continue to persist desktop gestures to `tiles` and narrower
   breakpoint gestures to `overrides`.
6. Delete `apps/web/src/utils/ResponsiveLayoutStrategy.ts` and its tests; there
   is no version-to-algorithm map with one unconditional path.
7. Remove `projectGridLayout()` and every helper used only by that app-owned
   projection from `GridLayoutUtils.ts`. Keep or relocate only breakpoint and
   viewport calculations, because those remain Grids responsibilities.
8. Replace tests that import app projection collision helpers with test-local
   assertions or Griddle geometry helpers so test code does not preserve a
   shadow reflow implementation.

**Exit criterion:** Grids chooses only a breakpoint, target columns, and input
placements; all responsive geometry is returned by Griddle.

**Implementation record:** `Grid.vue` now always loads canonical tile geometry
under the grid's base column count. Targets narrower than that base make
exactly one explicit `api.reflow()` call with `strategy: "griddle-v1"` and the
active saved placements when present; an equal-width target remains canonical
and unreflowed. Settled geometry is still published only after the complete
load, optional reflow, and optional gravity transaction. Gravity is skipped
whenever authoritative placements are active, including when gravity is
toggled on. The version-to-strategy adapter, app-owned projection algorithm,
projection-only helpers, parity fixtures, and their tests were deleted;
`GridLayoutUtils.ts` now owns only breakpoint and viewport column calculations.
Component tests keep collision checks local and verify canonical loading,
single-call reflow, placement forwarding, equal-width behavior, settled-state
publication, and gravity isolation. Publishing and consuming the prepared
Griddle package remains Step 7.

### Step 5 — Remove responsive preview and upgrade product surfaces

**Status:** Complete (2026-07-16).

1. Remove `ResponsiveLayoutSettings.vue`, its tests, and its inclusion in
   `GridSettings.vue`.
2. Remove the responsive preview banner prop/event/UI from
   `AppStatusBanners.vue` and the corresponding wiring from `App.vue`.
3. Remove `GridController.startResponsiveLayoutPreview()`,
   `upgradeResponsiveLayout()`, the in-flight flag, save boundary, and their
   dedicated tests.
4. Remove responsive-version preview fields and methods from
   `GridViewContext`, live/demo context factories, and related tests.
5. Refactor `gridPreview.ts` to retain neutral, grid-scoped preview state,
   mutation-blocking, stop/reset behavior, and a generic future entry point,
   while removing the `responsive-layout` descriptor and responsive version
   override getter.
6. Retain session cleanup and controller mutation guards that form the generic
   preview safety foundation.

**Exit criterion:** there is no user-visible or callable Griddle-layout preview
or upgrade feature, while generic preview state remains tested and usable by a
future feature.

**Implementation record:** The responsive-layout settings component, grid-menu
inclusion, app banner, stop event, confirmation/toast surface, controller
start/upgrade commands, view-context start command, effective-version override,
and their dedicated tests were removed. `gridPreview.ts` now stores only a
neutral `{ kind, gridId }` descriptor through a generic `startPreview()` entry
point. Grid-scoped reads, mutation blocking, scoped and unscoped stop behavior,
idempotent reset, controller mutation guards, and session cleanup remain in
place and covered. The live and demo contexts continue to expose neutral
preview state and stop behavior without any responsive-layout semantics.

### Step 6 — Convert the maintainer backfill into the `griddle-v1` migration

**Status:** Complete (2026-07-16).

1. Keep the existing dry-run-by-default, explicit `--project`, `--commit`, and
   typed `--confirm` safety model.
2. Scan the complete `grids` collection and classify documents as missing,
   exact old `legacy-v1`, already `griddle-v1`, or unknown.
3. In commit mode, transactionally re-read each missing/legacy candidate and
   set only `{ responsiveLayoutVersion: "griddle-v1" }` when the latest value
   is still eligible.
4. Do not increment `rev`, touch timestamps, or modify tiles, overrides, or any
   other field.
5. Make reruns idempotent. Concurrent `griddle-v1` writes count as safe skips;
   concurrent unknown writes are reported and never overwritten.
6. Make an unknown value produce a clearly blocking summary/exit outcome so a
   maintainer cannot claim full migration while anomalies remain.
7. Update utility tests for dry-run counts, commit updates, pagination,
   concurrency, idempotency, authorization, unknown blocking, and exact write
   shape.

**Exit criterion:** a zero-unknown successful run guarantees all preexisting
grid documents are stamped `griddle-v1` without geometry or revision changes.

**Implementation record:** The existing dry-run, explicit-project, commit, and
typed-confirmation safeguards remain intact. The migration now scans every grid
and classifies missing, exact `legacy-v1`, current `griddle-v1`, and unknown
values. Commit mode transactionally re-reads missing and legacy candidates and
writes only `responsiveLayoutVersion: "griddle-v1"`; concurrent current writes
and deletions are safe skips, while scan-time or concurrent unknown values are
reported by document ID and produce a blocking nonzero exit. Pagination,
authorization, exact write shape, concurrency, idempotency, and blocking
outcomes are covered by the functions test suite. No migration was run against
a Firebase project during implementation.

### Step 7 — Update dependency and release wiring

**Status:** Release prepared and locally verified (2026-07-16); final Grids
dependency and lockfile update awaits publication of 0.1.10.

1. Consume the coordinated Griddle release in `apps/web/package.json` and the
   root lockfile only after the Griddle tarballs pass preflight.
2. Verify the installed `@griddle/core` and `@griddle/vue` artifacts contain
   the sole parity `griddle-v1` implementation and matching types.
3. Do not point a committed lockfile at an unpublished registry version unless
   publication is part of the explicitly authorized release sequence.

**Exit criterion:** a clean Grids install resolves a published, verified
Griddle release containing the expected algorithm.

**Implementation record:** `@griddle/core`, `@griddle/react`, `@griddle/vue`,
and `@griddle/svelte` are prepared in lockstep at 0.1.10, with adapter peer and
development ranges on `@griddle/core` updated to `^0.1.10`. The release
changelog preserves the already-published 0.1.9 history and records the sole
parity strategy under 0.1.10. All four dry-run tarballs passed package preflight.
Grids was then verified against actual locally packed and unpacked 0.1.10 core
and Vue artifacts. Its committed manifest and lockfile intentionally remain on
published 0.1.9 until the maintainer publishes 0.1.10; refreshing those files
and proving a clean registry install is the only unfinished action in this
step.

### Step 8 — Run the verification matrix

**Status:** Complete (2026-07-16).

#### Griddle contract matrix

- automatic reflow at 12, 8, and 4 columns;
- valid positions and gaps preserved;
- collision and horizontal overflow resolved in legacy order;
- oversized tiles proportionally scale width and height;
- no placements, partial placements, complete placements, and stale placement
  IDs;
- authoritative placements unchanged exactly;
- deterministic output and original tile ordering;
- metadata/capability preservation;
- invalid inputs and placements fail without partial mutation;
- out-of-flow tiles remain untouched;
- one final adapter refresh/event per reflow;
- ordinary `pack()` and gravity remain separate operations.

#### Grids integration matrix

Run `lg`, `md`, and `sm` with gravity on/off and no/partial/full overrides.
For each case verify:

- breakpoint and column selection remain app-owned and unchanged;
- desktop canonical geometry is unchanged;
- every narrower layout matches the frozen historical app fixture;
- every tile is present, in bounds, and non-overlapping;
- saved overrides remain exact, including when gravity is enabled;
- repeated breakpoint switching is deterministic and does not mutate canonical
  tiles or unrelated override maps;
- fresh grids and duplicates carry `griddle-v1`;
- missing, exact old, and malformed stamps all take the same Griddle runtime
  path;
- no preview/upgrade controls or responsive preview banner render;
- generic preview mutation blocking and session cleanup still pass.

#### Ownership audit

Search both repositories and confirm:

- no app `projectGridLayout`, legacy packing/scaling/first-free projection, or
  runtime version routing remains;
- no supported `legacy-v1` or `preserve-v1` remains outside historical notes
  and maintainer migration fixtures;
- no responsive preview/upgrade action remains;
- no dense-packing implementation is used by responsive `griddle-v1`;
- Griddle source contains no breakpoint names or Grids persistence concepts.

#### Commands

Griddle:

```sh
npm run build
npm test
npm run build --prefix demos/react
npm run build --prefix demos/vue
npx vue-tsc --noEmit -p demos/vue/tsconfig.json
npm run build --prefix demos/svelte
npm pack --dry-run --workspace @griddle/core
npm pack --dry-run --workspace @griddle/react
npm pack --dry-run --workspace @griddle/vue
npm pack --dry-run --workspace @griddle/svelte
```

Grids:

```sh
npm --prefix apps/web run test:run
npm --prefix apps/web run type-check
npm --prefix apps/web run lint
npm --prefix apps/web run build
npm --prefix apps/firebase-functions run test
npm --prefix apps/firebase-functions run type-check
npm --prefix apps/firebase-functions run lint
npm --prefix apps/firebase-functions run build
```

Also run `git diff --check` and verify both worktrees contain only intentional
changes. Perform a live browser pass across desktop, tablet, and phone widths
after the automated matrix passes.

**Implementation record:** Griddle build, 116 package tests, all three adapter
demo builds, Vue demo template type checking, and four-package dry-run packing
passed at 0.1.10. Grids web passed 143 files and 2,605 tests plus type checking,
lint, and production build; Firebase Functions passed 65 files and 919 tests
plus type checking, lint, and build. The cross-repository ownership searches
found no app-owned responsive projection/runtime strategy route, no supported
`preserve-v1`, no responsive preview/upgrade surface, no responsive dense
packing path, and no Grids breakpoint or persistence concepts in Griddle. A
live desktop/tablet/phone pass, including a phone-to-desktop round trip, kept
all 12 demo tiles present, in bounds, and non-overlapping with no browser
console errors. The audit found and fixed one placement edge case: Griddle
gravity is now disabled for the entire session whenever authoritative
breakpoint placements are active, preventing a later move or resize from
compacting user-authored overrides. Component coverage locks that behavior.

## Rollout order

1. Land, verify, and publish the coordinated Griddle package release. Package
   publication is a maintainer-only action.
2. Land and deploy the Grids single-path runtime using that release. At this
   point every stamp value renders through the parity `griddle-v1` algorithm.
3. Allow the new web bundle to propagate before changing stored stamps, because
   an old open client interprets `griddle-v1` as the now-rejected dense path.
4. Run the maintainer script in dry-run mode and require an unknown count of
   zero before commit.
5. Run the confirmed migration, capture its summary, then rerun dry-run and
   require zero missing, zero legacy, zero unknown, and all scanned documents
   already on `griddle-v1`.

The maintainer migration must not run before the single-path app is deployed.
The current app gives `legacy-v1` and `griddle-v1` different geometry, so
changing stamps first would activate the dense algorithm for existing grids.

## Completion criteria

This refactor is complete only when all of the following are true:

1. Griddle exposes one responsive reflow strategy, `griddle-v1`.
2. That strategy matches the historical Grids algorithm fixture-for-fixture.
3. The newer dense responsive algorithm and the `preserve-v1` bootstrap name
   are gone.
4. Grids contains no responsive geometry algorithm or version-based routing.
5. Breakpoint selection, column mapping, switching, overrides, and persistence
   remain owned by Grids.
6. Responsive preview and one-way switching UI/functions are gone, while the
   generic preview-state foundation remains.
7. Fresh and duplicated grids write `griddle-v1`.
8. The maintainer migration can safely and idempotently stamp all existing
   known grids as `griddle-v1`.
9. The full automated and live verification matrix passes.
10. The old implementation plan is visibly deprecated and used only as a
    historical record.
