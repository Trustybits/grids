# Metrics & Analytics Architecture Plan

This document describes the plan for adding first-party metrics and analytics to grids.so, using Firestore as the backing store. The design follows the existing project conventions: DAO interfaces + Firestore implementations + stubbed implementations, services behind `IServiceFactory`, and Cloud Functions for server-side aggregation.

---

## 1. Firestore Collections

### 1.1 `gridStats` — User-Facing Grid Statistics

Stores aggregated, displayable statistics for each grid. Two document types live in this collection, distinguished by their ID pattern:

**Aggregate document** — one per grid
- **Document ID:** `{layoutId}`
- **Fields:**
  - `layoutId: string`
  - `ownerId: string`
  - `totalViews: number` — lifetime view count
  - `uniqueViewers: number` — lifetime unique viewers (deduplicated by viewer fingerprint)
  - `authenticatedViews: number` — views from logged-in users
  - `anonymousViews: number` — views from non-logged-in visitors
  - `totalTimeSpentMs: number` — cumulative time spent by all viewers (milliseconds)
  - `totalSessions: number` — count of view sessions (used as the denominator for average time)
  - `averageTimeSpentMs: number` — precomputed `totalTimeSpentMs / totalSessions` (updated by the aggregation function for fast reads)
  - `updatedAt: Timestamp`

**Daily document** — one per grid per day
- **Document ID:** `{layoutId}__{YYYY-MM-DD}` (double underscore delimiter)
- **Fields:** same shape as the aggregate document, but scoped to a single UTC day
  - `layoutId`, `ownerId`, `date: string` (YYYY-MM-DD), `totalViews`, `uniqueViewers`, `authenticatedViews`, `anonymousViews`, `totalTimeSpentMs`, `totalSessions`, `averageTimeSpentMs`, `updatedAt`
- **Note on `uniqueViewers`:** on the daily doc this means **new** unique viewers on that date — visitors whose lifetime fingerprint marker was created today. Returning visitors count toward `totalViews` but not `uniqueViewers`. This avoids a per-day fingerprint marker subcollection (see §5).

This flat structure (aggregate + daily docs in one collection) keeps queries simple: fetch the aggregate doc for lifetime stats, query by `layoutId` + date range for daily stats. Using `{layoutId}__{date}` as the doc ID avoids the need for a subcollection and makes TTL cleanup straightforward later.

### 1.2 `businessStats` — Internal Business Metrics

Tracks platform-wide operational metrics. Same aggregate + daily pattern:

**Aggregate document**
- **Document ID:** `global`
- **Fields:**
  - `totalGridsCreated: number`
  - `totalGridsDeleted: number`
  - `activeGrids: number` — `created - deleted` (maintained by the aggregation function)
  - `totalUsers: number` — cumulative signups
  - `totalLogins: number`
  - `totalOwnerVisits: number` — times an owner entered/opened their own grid for editing
  - `tileAdds: Record<string, number>` — map of `ContentType → count` (e.g. `{ "image": 342, "text": 891 }`)
  - `tileDeletes: Record<string, number>` — same shape
  - `updatedAt: Timestamp`

**Daily document**
- **Document ID:** `daily__{YYYY-MM-DD}`
- **Fields:** same shape as aggregate, scoped to a single UTC day, plus `date: string`

### 1.3 `analyticsEvents` — Raw Event Log (90-day TTL)

A flat, append-only event log. Every trackable action writes one document here. A Firestore TTL policy on the `expiresAt` field auto-deletes documents after 90 days.

- **Document ID:** auto-generated
- **Fields:**
  - `eventType: string` — discriminator (see event catalog below)
  - `timestamp: Timestamp` — server timestamp at write time
  - `expiresAt: Timestamp` — `timestamp + 90 days`, used by Firestore TTL
  - `userId: string | null` — Firebase Auth UID if authenticated, null otherwise
  - `layoutId: string | null` — grid ID when relevant
  - `metadata: Record<string, unknown>` — event-specific payload (flexible schema per event type)

**Initial event catalog (`eventType` values):**

| eventType | metadata | When logged |
|---|---|---|
| `grid_view` | `{ viewerType: 'authenticated' \| 'anonymous', sessionId, viewerFingerprint }` | Public grid page loaded |
| `grid_view_end` | `{ sessionId, durationMs }` | Viewer leaves / tab hidden on a public grid |
| `grid_created` | `{ gridName }` | Owner creates a new grid |
| `grid_deleted` | `{ gridName }` | Owner deletes a grid |
| `tile_added` | `{ tileType: ContentType, tileId }` | Owner adds a tile |
| `tile_removed` | `{ tileType: ContentType, tileId }` | Owner removes a tile |
| `user_signup` | `{ signInMethod }` | New user created (Firebase Auth trigger) |
| `user_login` | `{ signInMethod }` | Existing user logs in |
| `owner_grid_enter` | `{ }` | Owner opens their own grid (edit session) |

This catalog is intentionally small to start. New event types can be added without schema migration — just add a new `eventType` string and whatever `metadata` shape it needs.

---

## 2. Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│  Vue Frontend (browser)                                   │
│                                                           │
│  composable: useAnalytics()                               │
│    ├─ tracks grid_view (on mount)                         │
│    ├─ tracks grid_view_end (on unmount / visibilitychange)│
│    ├─ tracks owner_grid_enter (owner loads own grid)      │
│    └─ calls AnalyticsService methods                      │
│                                                           │
│  AnalyticsService (via IServiceFactory)                   │
│    ├─ logEvent(eventType, metadata) → AnalyticsDao        │
│    └─ getGridStats(layoutId) → GridStatsDao               │
│                                                           │
│  DAO layer                                                │
│    ├─ AnalyticsEventDao   → writes to analyticsEvents     │
│    ├─ GridStatsDao        → reads from gridStats          │
│    └─ BusinessStatsDao    → reads from businessStats      │
│                                                           │
└───────────────────────────────────────────────────────────┘
                          │
                          │ Firestore writes
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Firestore                                              │
│    analyticsEvents  ──(TTL: 90 days on expiresAt)       │
│    gridStats                                            │
│    businessStats                                        │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Firestore triggers
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Cloud Functions (functions/src/)                       │
│                                                         │
│  onAnalyticsEventCreated (analyticsEvents/{docId})      │
│    ├─ reads eventType                                   │
│    ├─ increments the appropriate gridStats aggregate    │
│    │   and daily document                               │
│    ├─ increments the appropriate businessStats aggregate│
│    │   and daily document                               │
│    └─ recomputes averageTimeSpentMs when relevant       │
│                                                         │
│  Existing triggers (enhanced):                          │
│    onNewUserSignup  → also writes user_signup event     │
│    onUserLogin      → also writes user_login event      │
│    onGridCreated    → also writes grid_created event    │
│    onGridDeleted    → also writes grid_deleted event    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why this architecture?

- **Single write path:** The frontend writes directly to `analyticsEvents` from the browser (Firestore client SDK), and Cloud Function triggers also write there for server-originated events. A single Firestore `onCreate` trigger on that collection handles all aggregation into `gridStats` and `businessStats`. This means the aggregation logic lives in one place, is easy to test, and new event types only need a new case in the switch statement.
- **Why direct client writes (not a callable function):** Grid views come from anonymous visitors, and view events are high-volume on the hot read path — routing every event through a callable would add cold-start latency and per-invocation cost. Abuse is mitigated through Firestore security rules that validate the event payload (see §8). The one exception is `grid_view_end` on page unload, which uses an HTTP `sendBeacon` endpoint because client Firestore writes aren't reliable during teardown.
- **Read path is pre-aggregated:** The user-facing dashboard reads directly from `gridStats/{layoutId}` — one document read, no queries. Daily stats are a simple range query on doc IDs.
- **Follows existing patterns:** New DAOs (`AnalyticsEventDao`, `GridStatsDao`, `BusinessStatsDao`) follow the interface → Firestore impl → stubbed impl → factory pattern already established.
- **Expandable:** Adding a new metric means: (1) add the field to the appropriate stats document type, (2) add a case to the aggregation Cloud Function, (3) optionally add a new event type. No structural changes needed.

---

## 3. New Files to Create

### 3.1 Types

**`src/types/Analytics.ts`**
- `AnalyticsEvent` interface — the shape written to `analyticsEvents`
- `GridStats` interface — the shape of a `gridStats` document
- `DailyGridStats` interface — extends `GridStats` with `date: string`
- `BusinessStats` interface — the shape of a `businessStats` document
- `DailyBusinessStats` interface — extends `BusinessStats` with `date: string`
- `AnalyticsEventType` enum — `GRID_VIEW`, `GRID_VIEW_END`, `GRID_CREATED`, `GRID_DELETED`, `TILE_ADDED`, `TILE_REMOVED`, `USER_SIGNUP`, `USER_LOGIN`, `OWNER_GRID_ENTER`

### 3.2 DAO Layer

**Interfaces:** (frontend DAOs are scoped to what clients are actually allowed to do per the security rules — writes to `gridStats` / `businessStats` and reads on `analyticsEvents` are server-only, so they don't belong on these interfaces. The aggregation Cloud Function writes to `gridStats` / `businessStats` via the admin SDK directly inside `functions/`.)

- `src/dao/interfaces/AnalyticsEventDao.ts` — `logEvent(event)` only. No query methods: clients cannot read `analyticsEvents`.
- `src/dao/interfaces/GridStatsDao.ts` — read-only: `getAggregate(layoutId)`, `getDaily(layoutId, date)`, `getDailyRange(layoutId, startDate, endDate)`.
- `src/dao/interfaces/BusinessStatsDao.ts` — read-only: `getAggregate()`, `getDaily(date)`, `getDailyRange(startDate, endDate)`.

**Firestore implementations:**
- `src/dao/firestore/FirestoreAnalyticsEventDao.ts`
- `src/dao/firestore/FirestoreGridStatsDao.ts`
- `src/dao/firestore/FirestoreBusinessStatsDao.ts`

**Stubbed implementations (for tests/mock mode):**
- `src/dao/stubbed/StubbedAnalyticsEventDao.ts`
- `src/dao/stubbed/StubbedGridStatsDao.ts`
- `src/dao/stubbed/StubbedBusinessStatsDao.ts`

**Factory updates:**
- Add `getAnalyticsEventDao()`, `getGridStatsDao()`, `getBusinessStatsDao()` to `DaoFactory` interface, `FirestoreDaoFactory`, and `StubbedDaoFactory`

### 3.3 Service Layer

**Interface:**
- `src/services/interfaces/IAnalyticsService.ts`
  - `logEvent(eventType, layoutId?, metadata?)` — writes to `analyticsEvents` via DAO
  - `getGridStats(layoutId)` — returns the aggregate `GridStats` document
  - `getYesterdayGridStats(layoutId)` — returns the daily doc for yesterday
  - `getGridStatsDailyRange(layoutId, startDate, endDate)` — returns array of daily docs
  - `getBusinessStats()` — returns global aggregate
  - `getBusinessStatsDailyRange(startDate, endDate)` — returns array of daily docs

**Concrete + Mock:**
- `src/services/AnalyticsService.ts`
- `src/services/mocks/MockAnalyticsService.ts`

**Factory updates:**
- Add `getAnalyticsService()` to `IServiceFactory`, `ServiceFactory`, and mock factory

### 3.4 Composable

**`src/composables/useAnalytics.ts`**

This composable is the main integration point for the frontend. It provides:

- `trackGridView(layoutId)` — called when a public grid page mounts. Generates a `sessionId`, determines `viewerType` (authenticated vs anonymous) via `getAuthProvider().getCurrentUserId()`, and logs a `grid_view` event. Starts a timer.
- `trackGridViewEnd(layoutId, sessionId)` — called on unmount or `visibilitychange` (hidden). Computes `durationMs` from the timer and logs a `grid_view_end` event.
- `trackOwnerGridEnter(layoutId)` — called when the layout store detects the viewer is the owner. Logs `owner_grid_enter`.
- `trackTileAdded(layoutId, tileType, tileId)` — called from the layout store's `addTile` action. Logs `tile_added`.
- `trackTileRemoved(layoutId, tileType, tileId)` — called from the layout store's `removeTile` action. Logs `tile_removed`.

The composable handles deduplication (e.g. won't double-log a `grid_view` if the component re-mounts) and gracefully no-ops if analytics aren't configured.

### 3.5 Cloud Functions

**New function: `onAnalyticsEventCreated`**
- Trigger: `functions.firestore.document('analyticsEvents/{docId}').onCreate`
- Reads `eventType` from the new document
- Dispatches to handler per event type:
  - `grid_view`: increments `gridStats/{layoutId}` aggregate `totalViews`, `uniqueViewers` (if new fingerprint), `authenticatedViews` or `anonymousViews`; increments matching daily doc; increments `businessStats/global` and daily
  - `grid_view_end`: looks up the layout document first; if it does not exist, the handler logs a warning and skips aggregation entirely (no partial writes). Otherwise: adds `durationMs` to `totalTimeSpentMs`, increments `totalSessions`, recomputes `averageTimeSpentMs`, and ensures `ownerId` is populated on both the aggregate and daily docs (sourced from `layouts/{layoutId}.userId`). The aggregate and daily updates **must** be performed inside a **single** Firestore transaction so that an automatic retry after a partial failure cannot double-apply `durationMs` / `totalSessions` to the side that already committed.
  - `grid_created` / `grid_deleted`: increments `businessStats` counters
  - `tile_added` / `tile_removed`: increments the appropriate key in `businessStats.tileAdds` / `tileDeletes` map
  - `user_signup` / `user_login`: increments `businessStats` counters
  - `owner_grid_enter`: increments `businessStats.totalOwnerVisits`
- Uses Firestore `FieldValue.increment()` for atomic counter updates (no read-before-write races)
- Uses transactions or batched writes to update both aggregate and daily docs atomically
- **`ownerId` must be populated whenever a `gridStats` document is created.** Any handler that writes a previously-nonexistent aggregate or daily `gridStats` doc must look up `layouts/{layoutId}.userId` and include it as `ownerId` in the write. `ownerId` is required by both the data model (§1.1) and the security rules (§8 — owner reads are gated on `request.auth.uid == resource.data.ownerId`); a stats doc missing `ownerId` will deny the owner access to their own stats.
- **Cross-document read-modify-write must use a single transaction.** When a single event coordinates read-modify-write updates across both the aggregate and daily docs (e.g. `grid_view_end`'s average recomputation), both writes must occur inside one `runTransaction` call. Two parallel transactions are not equivalent — a partial failure followed by Firebase's automatic retry will double-apply the successful side's effect (e.g. `totalTimeSpentMs` inflated, skewing `averageTimeSpentMs`).

**Existing functions enhanced:**
- `onNewUserSignup`: add a Firestore write to `analyticsEvents` with `eventType: 'user_signup'`
- `onUserLogin`: add a Firestore write to `analyticsEvents` with `eventType: 'user_login'`
- `onGridCreated`: add a Firestore write to `analyticsEvents` with `eventType: 'grid_created'`
- `onGridDeleted`: add a Firestore write to `analyticsEvents` with `eventType: 'grid_deleted'`

---

## 4. Integration Points in Existing Code

### 4.1 Grid View Tracking

**`GridPage.vue`** — the entry point for viewing a grid:
- Import and use `useAnalytics()`
- On `onMounted`: call `trackGridView(layoutId)` after the grid loads successfully
- On `onUnmounted`: call `trackGridViewEnd(layoutId, sessionId)`
- Also listen for `document.visibilitychange` to capture tab-switches and backgrounding

### 4.2 Owner Grid Enter

**Layout store `loadLayout` action** (`src/stores/layout.ts:513`):
- After the `isOwner` check resolves to `true`, call `trackOwnerGridEnter(layoutId)` via the analytics service (not the composable, since this is a store not a component)

### 4.3 Tile Add/Remove

**Layout store `addTile` action** (`src/stores/layout.ts:654`):
- After successfully adding a tile, call `analyticsService.logEvent('tile_added', layoutId, { tileType, tileId })`

**Layout store `removeTile` action** (`src/stores/layout.ts:879`):
- Before removing the tile (so we can read its `content.type`), call `analyticsService.logEvent('tile_removed', layoutId, { tileType, tileId })`

### 4.4 Displaying Stats to Users

Grid stats should be displayed in a component within the grid owner's editing view — likely a new section/panel in the grid page or dashboard. The `GridStats` aggregate document provides:
- **Yesterday's views:** read from `gridStats/{layoutId}__{yesterday's date}`
- **Lifetime views:** read from `gridStats/{layoutId}` aggregate doc
- **Average time spent:** `averageTimeSpentMs` from the aggregate doc, formatted as seconds/minutes

The `uniqueViewers` count differentiates visitors without revealing usernames. The `authenticatedViews` vs `anonymousViews` split gives the owner a sense of how many viewers are registered users vs passersby, without exposing who specifically viewed.

---

## 5. Viewer Fingerprinting (for Unique Viewer Counts)

To count unique viewers without requiring authentication:
- Generate a random `viewerFingerprint` string and store it in `localStorage` on first visit
- Include it in the `grid_view` event metadata
- The aggregation Cloud Function maintains a set (or uses a subcollection/bloom filter) to deduplicate

A single marker subcollection lives under the lifetime aggregate: `gridStats/{layoutId}/viewers/{fingerprint}`. The Cloud Function runs one transaction per `grid_view` — if the marker exists, the viewer is a returning visitor and `uniqueViewers` is not incremented; if not, the marker is created, the aggregate's `uniqueViewers` is incremented (lifetime uniques), AND the day's `uniqueViewers` is incremented (interpreted as **new** uniques today). There is no per-day marker subcollection — daily docs only count first-time-ever visitors, not "any unique today." This halves the dedup write cost and removes an unbounded-growth daily subcollection.

Note: This is approximate — `localStorage` can be cleared, different browsers on the same device produce different fingerprints, etc. It's sufficient for the "how many different people saw my grid" use case without being invasive.

---

## 6. Time Tracking Implementation

Tracking time spent on a grid page:
1. `useAnalytics()` starts a timer on mount (`performance.now()` or `Date.now()`)
2. Listens for `visibilitychange` — when the tab becomes hidden, compute elapsed time and log `grid_view_end` with `durationMs`
3. When the tab becomes visible again, start a new session
4. On `beforeunload` / `onUnmounted`, log any remaining session time via `navigator.sendBeacon` to a Cloud Function endpoint (since Firestore client writes may not complete during page teardown)

The `sendBeacon` endpoint is a small `onRequest` Cloud Function that accepts the `grid_view_end` payload and writes it to `analyticsEvents`. This ensures time tracking works even when users close the tab.

---

## 7. TTL Setup for analyticsEvents

Firestore TTL policy configuration (done once via Firebase console or `gcloud`):

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=analyticsEvents \
  --project=grids-one
```

The `expiresAt` field is set to `timestamp + 90 days` when writing each event. Firestore automatically garbage-collects expired documents (within ~24h of expiry).

---

## 8. Firestore Security Rules

New rules to add:
- `analyticsEvents`: allow `create` for any authenticated or anonymous user (since grid views come from non-logged-in visitors too). Deny `read`, `update`, `delete` from clients — only Cloud Functions (admin SDK) aggregate and read these. Because clients write directly, the `create` rule must validate the payload to prevent abuse:
  - `eventType` is in the allowed set (the catalog in §1.3)
  - `timestamp == request.time` (clients can't forge backdated/future events)
  - `expiresAt == request.time + 90 days` (so TTL works correctly and can't be extended)
  - `userId` either equals `request.auth.uid` or is `null`
  - `metadata` size cap (e.g. payload under ~2KB) and no unexpected top-level fields
  - Server-originated events (`user_signup`, `user_login`, `grid_created`, `grid_deleted`) should only be writable by the admin SDK — clients should not be allowed to forge these `eventType` values. Easiest enforcement: gate the allowed `eventType` set in the client rule to the client-originated subset (`grid_view`, `grid_view_end`, `tile_added`, `tile_removed`, `owner_grid_enter`).
- `gridStats`: allow `read` for the grid owner (`request.auth.uid == resource.data.ownerId`). Deny `write` from clients — only Cloud Functions write.
- `businessStats`: deny all client access — admin-only via Cloud Functions or Firebase console.

---

## 9. Implementation Order

Recommended phasing:

### Phase 1 — Foundation (no UI yet)
1. Define types in `src/types/Analytics.ts`
2. Create DAO interfaces + Firestore impls + stubbed impls
3. Update `DaoFactory` interface and both factory implementations
4. Create `IAnalyticsService` interface + `AnalyticsService` + `MockAnalyticsService`
5. Update `IServiceFactory` and `ServiceFactory`
6. Write the `onAnalyticsEventCreated` Cloud Function
7. Configure Firestore TTL on `analyticsEvents.expiresAt`
8. Update Firestore security rules

### Phase 2 — Event Logging
9. Create `useAnalytics()` composable
10. Integrate `grid_view` / `grid_view_end` tracking into `UserSlugPage.vue` and `GridPage.vue`
11. Integrate `tile_added` / `tile_removed` tracking into the layout store
12. Integrate `owner_grid_enter` tracking into the layout store's `loadLayout`
13. Enhance existing Cloud Functions to write `user_signup`, `user_login`, `grid_created`, `grid_deleted` events
14. Add the `sendBeacon` Cloud Function endpoint for reliable time tracking on page close

### Phase 3 — User-Facing Stats Display
15. Build a grid stats display component (views yesterday, lifetime views, average time spent)
16. Integrate into the grid editing view or dashboard

### Phase 4 — Business Stats Dashboard (internal)
17. Build an internal admin view or use Firebase console / a simple script to query `businessStats`

---

## 10. Future Expandability

This architecture naturally supports future metrics without structural changes:

- **Tile interaction tracking** (clicks, hovers, time-per-tile): new event types in `analyticsEvents`, new fields in `gridStats`
- **Referrer tracking** (where viewers come from): add `referrer` to `grid_view` metadata
- **Geographic data**: add approximate geo to `grid_view` metadata (from IP, via a Cloud Function)
- **Engagement scoring**: computed field in `gridStats` combining views, time, and interactions
- **Funnel analysis** (view → interact → follow link): query `analyticsEvents` by `sessionId`
- **A/B testing metrics**: tag events with experiment variant in metadata
- **Per-tile analytics**: add tile-level stat documents to a `tileStats` collection using the same pattern
- **Export/reporting**: Cloud Functions can periodically aggregate `analyticsEvents` into BigQuery for deeper analysis

The `metadata: Record<string, unknown>` field on `analyticsEvents` means new data points never require a schema migration — just start including them in the metadata and handle them in the aggregation function.
