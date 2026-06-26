# Plan: Delete chat subcollections on tile & grid deletion

Branch: `chat-tiles-delete-subcollections`

## Problem

Chat messages are stored in the Firestore subcollection `grids/{gridId}/tiles/{tileId}/messages`
(`FirebaseChatDao.messagesCollection`). Firestore does **not** cascade deletes, and nothing in the
codebase removes these messages when their parent goes away:

- **Tile removal** — `GridTileStructureController.removeTile` only filters the tile out of the in-memory
  `grid.tiles` array and schedules a save. The messages subcollection is orphaned.
- **Grid deletion** — `FirebaseGridDao.delete` is a bare `deleteDoc(gridDoc)`. Every tile's `messages`
  subcollection under it survives. (The existing `onTrigger_gridDeleted` only sends a Discord/analytics
  notification — no data cleanup.)

`tiles/{tileId}` is **not** a real document; tiles live in an array on the grid doc. The `messages`
subcollection hangs off a phantom parent path.

## Three fixes, layered

- **Fix 1 (client-side)** — tiles aren't documents, so there is no Firestore trigger for tile deletion;
  clean up a removed chat tile's messages from the app, deferred so undo can restore them (Option A).
- **Fix 2 (server-side trigger)** — grid deletion already has a server trigger and may span many tiles;
  reclaim the whole subtree with the Admin SDK's `recursiveDelete` (general: covers chat + any future
  subcollection).
- **Fix 3 (server-side schedule)** — a weekly sweep backstops the residual leak the first two can't
  reach (client dies before a flush on a grid that is kept).

The three compose: see the **Coverage** note at the end of Fix 3.

---

## Fix 1 — Tile deletion: delete that tile's messages (client-side)

Add a bulk-delete down the existing DAO/service stack and call it from tile removal.

1. **Contract** — `packages/contracts/src/dao/ChatDao.ts`
   Add `deleteAllMessages(gridId: string, tileId: string): Promise<void>`. Rebuild contracts
   (`npm run build`) so `@grids/pro` and stubs see it.

2. **Firebase DAO** — `packages/pro/src/dao/firebase/FirebaseChatDao.ts`
   Implement `deleteAllMessages`: `getDocs` the messages collection, delete in batches
   (`writeBatch`, ≤500 ops/batch) to stay within Firestore limits. Convert internally; no Firebase
   types cross the boundary.

3. **Stub** — `apps/web/src/dao/stubbed/StubbedChatDao.ts`
   Implement `deleteAllMessages`: `memoryDatabase.messages.delete(key)` + `emit(channel(...))`.

4. **Service** — `ChatServiceInterface.ts` + `ChatService.ts`
   Add `deleteAllMessages(gridId, tileId)` that delegates to `chatDao.deleteAllMessages`.
   Mirror in `MockChatService.ts`.

5. **Expose chat service to the controller** — add
   `getChatService(): ChatServiceInterface` to `GridControllerDependencies`
   (`GridControllerTypes.ts`) and wire it in `createDefaultGridControllerDependencies`
   (`useGridController.ts`) as `() => getServiceFactory().getChatService()`.

6. **Deferred cleanup so undo can restore messages (Option A)** — do **not** delete in `removeTile`.

   Why this works: messages are not part of the undo `Snapshot` (which is purely structural — `tiles`,
   `overrides`, theme, background). An undo restores the **tile** with its original `i` id, and messages
   are keyed by `gridId/tileId`. So as long as the message docs still exist in Firestore, the restored
   tile re-subscribes to the same path and the messages reappear with zero extra work. The only job is to
   delay the real Firestore delete until undo can no longer bring the tile back.

   **GC invariant:** a removed chat tile's messages may be hard-deleted only when its `tileId` is in
   **none** of: the live grid's tiles, the undo stack, or the redo stack. (The redo clause matters — after
   undo-then-redo, the tile sits in the undo stack, so the union check keeps protecting it.)

   Pieces:
   - **Pending set — keyed per-grid, not bare `tileId`s.** Each pending entry must carry its **own
     `gridId`**, because the most important flush point (history reset) fires on **grid switch**, exactly
     when the live grid is changing out from under us. If we stored bare `tileId`s and flushed against
     "the current live grid id," we would call `deleteAllMessages` with the *wrong* `gridId`. Store a
     `Map<string, Set<string>>` (gridId → removed chat tileIds) — or an equivalent `Set<{gridId,
     tileId}>` — on the **`GridController`** (decision 2 below), not on the `gridHistory` store.
     `removeTile` adds `tile.i` under the grid's id when `tile.content.type === ContentType.CHAT`; it
     does **not** touch Firestore.
   - **Reachability accessor on `UndoRedoManager`** — add e.g. `getReferencedTileIds(): Set<string>`
     that unions the `tileId`s across every snapshot in both `undoStack` and `redoStack`. (Existing
     `getStacks()` only returns labels/ids, so a new method is needed.) Keep Firestore knowledge out of
     the manager — it only reports reachability.
   - **Flush (GC) routine owned by the controller, never the store.** The pending set and the flush
     routine live on the **`GridController`** (it holds the `getChatService()` dependency from step 5).
     The flush computes, for a given grid, `reachable = liveGridTileIds ∪ manager.getReferencedTileIds()`;
     for each pending `tileId` under that `gridId` not in `reachable`, it calls
     `chatService.deleteAllMessages(gridId, tileId)` (fire-and-forget, `.catch(console.error)`) and drops
     it from pending. Invoke it at:
     - **Grid switch / teardown — driven by the controller *around* reset, not inside it.** The
       `gridHistory` store must not call services, so `gridHistory.reset()` itself stays untouched.
       Instead, the controller-level grid-switch/teardown path (`GridSessionController.resetSessionDependents`,
       which *invokes* `reset()`) flushes the **outgoing** grid's pending entries **before** it tells the
       store to reset — so `session.currentGrid` is still the outgoing grid. **Teardown reachability is
       live-grid-only** (`reachable = liveGridTileIds`, *not* unioned with `getReferencedTileIds()`):
       the undo/redo stacks are about to be discarded, so a removed tile can no longer be restored and
       only its presence in the live grid (e.g. an undo already brought it back) should protect it.
       This matters because `removeTile` always parks a pre-removal snapshot (still containing the chat
       tile) in the undo stack — counting stack reachability at teardown would protect every just-removed
       tile and punt all cleanup to the sweep. Anything pending and not in the live grid is therefore
       deleted at teardown.
     - **Save commit** — hooked into `GridPersistenceController.flushPersistenceScope` (which already
       knows the scope/`gridId`), as a periodic GC tick while editing. Do **not** couple GC into the
       generic, grid-agnostic `GridPersistenceScheduler`. Here the grid is **kept**, so reachability
       **does** union `getReferencedTileIds()` — a tile still in the undo/redo stacks stays protected.
       (Implemented as `flushChatCleanup(discardingHistory)`: `true` at teardown, `false` at save commit.)
   - Note an evicted snapshot (the `shift()` at `MAX_STACK_SIZE = 20` in `pushSnapshot`) needs no direct
     hook: once it leaves the stack it no longer appears in `getReferencedTileIds()`, so the next flush
     collects it. Undo-window deletions are therefore eventually-consistent, backstopped by Fix 2 / the
     sweep for any client that dies before a flush.

---

## Fix 2 — Grid deletion: delete all subcollections (server-side)

Use the Admin SDK's recursive delete in a Cloud Function that fires on grid document deletion.

1. **New trigger** — `apps/firebase-functions/src/grids/onTrigger_gridDeleted_cleanupSubcollections.ts`
   (new `grids/` folder; one deployed function per file per `conventions.md`).
   `functions.firestore.document("grids/{gridId}").onDelete(...)` → `noopIfMaintenance` guard →
   `await admin.firestore().recursiveDelete(snapshot.ref)`. `recursiveDelete` traverses and deletes all
   descendant subcollections (`tiles/*/messages`, etc.) even though the grid doc itself is already gone.
   Keep it separate from the existing notification `onTrigger_gridDeleted` (different concern; multiple
   onDelete triggers on the same path are allowed).

2. **Register** — export it from `apps/firebase-functions/src/index.ts`.

3. Client `FirebaseGridDao.delete` stays unchanged in behavior, but **add a comment** there
   (`packages/pro/src/dao/firebase/FirebaseGridDao.ts`, the `delete` method) noting that deleting the
   grid doc is what fires the `onTrigger_gridDeleted_cleanupSubcollections` trigger, which
   `recursiveDelete`s the whole grid subtree — and that this is **irreversible** (no undo/trash today).
   If grid deletion ever becomes soft-delete / trash-restore, this delete and the trigger must be
   revisited (see caveat below) so the coupling is caught and understood.

**Caveat — depends on grid deletion being permanent & non-undoable.** Today grid deletion is a hard,
immediate `deleteDoc` with no undo and no trash/restore (`GridCollectionController.deleteGrid` pushes no
undo snapshot). Fix 2 relies on that: firing on the initial `onDelete` and reclaiming everything is safe
because nothing can bring the grid back. **If a trash/restore-grids feature is ever added**, Fix 2 must
move to fire on *permanent* deletion (e.g. trash purge / TTL expiry) rather than the initial delete —
otherwise it would destroy subcollections of a grid the user could still restore.

---

## Fix 3 — Scheduled orphan sweep (server-side backstop)

Closes the residual leak Option A + Fix 2 can't reach: a chat tile removed on a grid that is **kept**,
where the client died before any flush ran. A scheduled function reconciles each grid's message
subcollections against its current tile ids.

1. **New scheduled function** —
   `apps/firebase-functions/src/grids/onSchedule_sweepOrphanedSubcollections.ts`
   (introduces a new `onSchedule_` file-naming prefix — extend `conventions.md` accordingly).
   - **Schedule:** weekly, Wednesday 23:00 Mountain Time:
     `functions.pubsub.schedule("0 23 * * 3").timeZone("America/Denver").onRun(...)`.
     `America/Denver` = Mountain Time with DST (chosen). Swap to `America/Phoenix` if strict UTC−7
     year-round is ever wanted. This is cosmetic — the timezone only sets the wall-clock fire time; it
     does not affect guard correctness (grace/active windows are relative durations). `noopIfMaintenance`
     guard.
   - **Enumeration:** for each grid doc, build `liveTileIds = new Set(grid.tiles.map(t => t.i))`, then
     `gridRef.collection("tiles").listDocuments()` — the Admin SDK returns refs to **missing** tile docs
     that still have subcollections (exactly the orphaned phantom tiles).
   - **Delete guard (per candidate tileRef whose id ∉ liveTileIds):**
     - **Grace period 24h** — read the newest message `createdAt` in `tileRef.collection("messages")`;
       skip if it is < 24h old (or if age can't be determined — conservative skip).
     - **Skip actively-edited grids** — skip the whole grid if `grid.updatedAt` is within the last
       **1 hour**. `updatedAt` is a server timestamp (absolute instant) bumped on every save
       (`GridService.ts:246`); the check is a relative duration (`now − updatedAt < 1h`), so it is
       timezone-independent — an editor's location never enters the comparison. 1h comfortably exceeds
       the save-debounce gap so a live session always reads as active, while not over-skipping grids
       abandoned earlier the same day.
     - Otherwise `await admin.firestore().recursiveDelete(tileRef)`.
   - **Scope guard (critical):** the delete target is always the individual `tileRef`
     (`grids/{gridId}/tiles/{tileId}`) — **never** `gridRef`. The sweep only ever reads the grid doc;
     it must not delete or mutate it. Add an explicit code comment; calling `recursiveDelete` on the
     grid ref here would wipe the entire grid (that is Fix 2's job, on actual grid deletion).
   - Bound per-run work (paginate grids / cap deletions) — fine to defer until grid count grows; leave a
     TODO.

2. **Register** — export from `apps/firebase-functions/src/index.ts`.

**Coverage:** the sweep + 24h grace + skip-active stack cleanly with Option A and Fix 2 — every path is
covered, and the skip-active gap is itself closed by Option A (an active grid's own client flushes its
pending deletions). Active window = `updatedAt` within 1h. Worst-case orphan lifetime ≈ 8 days
(weekly cadence + 24h grace) — acceptable for a storage-hygiene job.

---

## Tests

- `FirebaseChatDao.test.ts` — `deleteAllMessages` queries + batch-deletes; handles empty collection.
- `StubbedChatDao.test.ts` — clears messages for the key and emits.
- `ChatService.test.ts` — delegates to DAO.
- Deferred-cleanup (Option A) tests:
  - `removeTile` on a chat tile adds its `tileId` to the pending set and does **not** call
    `deleteAllMessages`; on a non-chat tile it touches neither.
  - Flush deletes a pending tile's messages only when its `tileId` is in neither the live grid nor
    `manager.getReferencedTileIds()`; it skips (does not delete) one still referenced by an undo/redo
    snapshot — i.e. undo-then-flush leaves messages intact.
  - `UndoRedoManager.getReferencedTileIds()` unions tile ids across both stacks.
- Grid-delete function test — `onDelete` calls `recursiveDelete` with the grid ref; no-op under maintenance.
- Sweep function test — deletes a stale orphan; **skips** a tile id still in the grid, an orphan with a
  message newer than 24h, and a grid whose `updatedAt` is within the active window; no-op under maintenance.
  Assert the grid doc itself still exists after a sweep (target is `tileRef`, never `gridRef`).

## Build order

Contracts → pro → web (root `build:web-deps`). Lint is zero-warning. Run web + functions Vitest suites.
Fix 2/3 also need exporting from `firebase-functions` `index.ts` and a `conventions.md` update for the
new `onSchedule_` prefix.

## Decisions locked

- Tile-removal cleanup uses **Option A** (deferred GC, undo-restorable) — not optimistic fire-and-forget.
- **Pending set is keyed per-grid** — each entry carries its own `gridId` (so a grid-switch flush deletes
  against the correct grid, not the incoming one).
- **Pending set + flush routine live on the `GridController`**, never on the `gridHistory` store (the store
  must not call services). The controller drives flush *around* `gridHistory.reset()` — flushing the
  outgoing grid before reset — rather than from inside `reset()`. **Teardown flush is live-grid-only**
  (stacks are being discarded); the save-commit flush also unions undo/redo reachability.
- **Save-commit GC hooks into `GridPersistenceController.flushPersistenceScope`**, not the generic
  grid-agnostic `GridPersistenceScheduler`.
- Sweep: weekly Wed 23:00 `America/Denver`, 24h message grace, skip grids with `updatedAt` within 1h.
- Grid deletion stays a hard delete; Fix 2 fires on `onDelete` (valid only while deletion is permanent).
