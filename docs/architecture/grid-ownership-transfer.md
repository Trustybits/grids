# Grid Ownership Transfer

This document describes how Grids transfers ownership of a grid from one user to another, including
copying the grid's archive-backed files into the recipient's per-user storage namespace. It builds on
the storage/dedup model in [Storage, uploads, and deduplication](storage-and-uploads.md); read that
first for how content addressing, upload archive documents, `refCount`, and quota work.

It is grounded in the code. Where a detail matters, the owning source file is named. If this document
and the code ever disagree, the code is authoritative.

## The model in one paragraph

A transfer is an **invitation the recipient must accept**. The sender initiates a transfer from a grid
they own; a `pending` record is written and nothing else changes yet. The recipient sees the pending
invitation on their dashboard, can preview the exact storage cost, and then **accepts** or **declines**.
Only at accept time does the server copy the grid's files into the recipient's namespace, flip the
grid's `userId`, and (optionally) remove the sender's now-orphaned copies. The sender can **cancel** any
time before the recipient accepts. Because files are content-addressed, a copied file keeps the **same
hash** — only the owner namespace and the download URL change, so the grid's stored `*Hash` fields are
untouched and only URL fields are rewritten.

## Why a Cloud Function is required

The flow cannot be client-only for two reasons:

1. **Email → uid resolution needs the Admin SDK.** There is no public email index. Slugs resolve
   client-side via the public `slugs/{slug}` collection, but email lookup requires
   `admin.auth().getUserByEmail(...)`, which only server code can call.
2. **Copying bytes into the recipient's namespace needs the Admin SDK.** `storage.rules` only allow a
   user to create objects under their own `users/{uid}/...` path, so the sender cannot write into the
   recipient's namespace from the client. The server copies objects with
   `bucket.file(src).copy(bucket.file(dest))`, exactly as grid duplication does.

Doing the ownership flip, hash/URL rewrite, and `rev` bump server-side via the Admin SDK also bypasses
the `isGridOwner` + `rev`-advance rule contract in `firestore.rules` and avoids any client `rev` race.

## Data model: `gridTransfers/{transferId}`

Server-written only. The domain type is `GridTransfer` in
`packages/contracts/src/types/GridTransfer.ts` (exported from the types barrel), alongside the
callable request/response types.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Doc id. |
| `gridId` | string | Grid being transferred. |
| `gridName` | string | Snapshot of the grid name at invite time, for the recipient UI. |
| `fromUserId` | string | Sender. Must still own the grid at accept time. |
| `fromSlug` / `fromEmail` | string \| null | Optional display context for the recipient. |
| `toUserId` | string | Resolved recipient uid. |
| `removeOrphanedFiles` | boolean | Sender's keep-vs-remove choice, applied at accept. |
| `status` | `pending` \| `accepted` \| `declined` \| `cancelled` \| `expired` | Lifecycle. |
| `createdAt` / `updatedAt` / `resolvedAt` | timestamp | Lifecycle timestamps. |
| `expiresAt` | timestamp | +14 days (`GRID_TRANSFER_EXPIRY_MS`); checked lazily at accept and by the sweep. |
| `failureReason` | string? | Set when a transfer is expired/closed by a precondition (`expired`, `grid-unavailable`, `grid-deleted`). |

**Invariant:** at most **one** `pending` transfer per `gridId` at a time, enforced in
`createGridTransfer`. A second attempt fails with `failed-precondition` until the first is resolved.

### Security rules

`firestore.rules` — `gridTransfers/{transferId}`:

- **Read** allowed only to the sender or recipient (`fromUserId == uid || toUserId == uid`).
- **Write** is `if false` — every write is a Cloud Function via the Admin SDK.

The `grids` rules are **not** loosened; a client can never change a grid's `userId`.

### Indexes

`firestore.indexes.json` defines composite indexes on `gridTransfers`:

- `toUserId ASC, status ASC, createdAt DESC` — recipient's incoming list.
- `fromUserId ASC, status ASC, createdAt DESC` — sender's outgoing list.
- `gridId ASC, status ASC` — the one-pending-per-grid check and grid-delete cleanup.
- `status ASC, expiresAt ASC` — the expiry sweep.

## Keep vs. remove the sender's files

The transfer modal has a toggle, recorded as `removeOrphanedFiles` and applied at accept:

- **Keep all files (default):** the sender's archive keeps every file that appeared on the grid. After
  the ownership change their `refCount`s for those files drop (the grid no longer references them) but
  the bytes remain in their File Archive.
- **Remove files used only in this grid:** permanently delete, from the **sender's** archive, only the
  files referenced **solely** by this grid among the sender's grids. Files also used in the sender's
  other grids are always kept. This is computed explicitly (see `deleteSenderOrphanedFiles`), not by
  racing the `refCount` trigger, so it is deterministic.

## End-to-end flow

```text
SENDER (grid owner)                    SERVER (Cloud Functions / Admin SDK)         RECIPIENT
------------------                     ------------------------------------         ---------
GridSettings -> "Transfer Grid"
TransferGridModal: email/slug,
  keep/remove, confirm
  createGridTransfer  ------------->   resolve recipient, validate ownership,
                                       no self-transfer, no existing pending,
                                       write gridTransfers/{id} = pending  ----->   sees pending on
  <---- { transferId, pending }                                                     dashboard
                                                                                    Accept / Decline
  (optional) sees status via     <---  acceptGridTransfer  <--------------------    Accept ->
  outgoing subscription                - reload grid; verify sender still owns it     preview first
                                       - inventory refs; HARD quota check
                                       - copy files into recipient namespace
                                       - rewrite grid URLs (hashes unchanged),
                                         strip Notion + upvotes,
                                         set userId = recipient, bump rev  (txn)
                                       - if remove: delete sender-orphaned files
                                       - if grid was sender's default: clear it
                                       - mark transfer accepted
```

## Cloud Functions

All live in `apps/firebase-functions/src/transfers/` and are exported from `src/index.ts`.

| Function | Type | Responsibility |
| --- | --- | --- |
| `createGridTransfer` | Callable | Validate ownership, resolve recipient (email via Admin Auth / slug via `slugs/`), reject self-transfer, enforce one-pending-per-grid, write the `pending` record. Returns `{ transferId, status, estimatedBytes }`. |
| `previewGridTransferAcceptance` | Callable | Recipient-only dry run: re-reads the grid, inventories archive-backed files, and returns `additionalBytesRequired`, `recipientQuotaRemaining`, `wouldExceedQuota`, the per-file list (`alreadyOwned` files cost 0), and `nonCopiableCount`. No copies or writes. |
| `acceptGridTransfer` | Callable | The core. Re-verifies ownership, hard quota check, copies files, rewrites the grid, strips Notion/upvotes, flips ownership + `rev` in a transaction, applies keep/remove, clears the sender's default. |
| `declineGridTransfer` | Callable | Recipient-only status flip to `declined`. No file work. |
| `cancelGridTransfer` | Callable | Sender-only status flip to `cancelled`, allowed only while `pending`. No file work. |
| `sweepExpiredGridTransfers` | Scheduled (daily) | Flip long-past-`expiresAt` pendings to `expired`. |

Shared helpers:

- `utils_gridTransfer.ts` — recipient resolution, normalizers, expiry math, transfer read/resolve
  helpers, recipient quota lookup.
- `utils_gridTransferAcceptance.ts` — `buildTransferInventory`, `copyTransferArchiveObjects`,
  `rewriteGridForTransfer`, `deleteNotionAndUpvoteSubcollections`, `deleteSenderOrphanedFiles`.

### The copy loop is shared with grid duplication

The object-copy loop was factored out of the duplicate callable into
`apps/firebase-functions/src/storage/utils_copyArchiveObjects.ts`
(`prepareArchiveObjectCopyPlan` + `copyArchiveObjects`), so
[grid duplication](storage-and-uploads.md#grid-duplication-and-cross-owner-copies) and transfer accept
use one implementation. The key difference is the `requireShareable` flag:

- **Duplication** (cross-user): `requireShareable: true` — only files the source owner marked
  `shareable` (or the caller's own files) are copiable.
- **Transfer** (owner-authorized): `requireShareable: false` — the sender is giving away their own
  grid, so every sender-owned, `active` archive file is copiable. Transfer also passes
  `requireActiveSource: true`.

Files with no archive document (legacy original-filename paths the extractor skips, or missing docs)
are **non-copiable**; their tiles become suggestion tiles and a non-copiable background is removed —
mirroring the duplication `replacementTileIds` / `removeBackgroundImage` behavior. In practice the
extractor only returns canonical refs, so this is an edge case.

### What `acceptGridTransfer` does, in order

Ordering is deliberate so a partial failure never leaves the grid half-transferred:

1. **Guards.** Recipient owns the transfer, status is `pending`, not past `expiresAt` (else mark
   `expired`), and the grid still exists and is still owned by `fromUserId` (else mark `expired` with
   `grid-unavailable`).
2. **Inventory + hard quota check.** `buildTransferInventory` extracts refs with
   `extractGridStorageReferencesFromRecord`, builds the copy plan, and (with `assertQuota: true`) calls
   `assertUserHasStorageQuota` — a **hard `resource-exhausted` failure before any mutation**. Only files
   the recipient does not already have (per-user dedupe) count.
3. **Copy files** into the recipient's namespace and build a `rewriteMap` of `hash → { newUrl }` (hash
   unchanged).
4. **Rewrite the grid** with the shared, Firebase-free rewrite util
   (`packages/contracts/src/storage/GridStorageRewrite.ts` — `rewriteArchiveBackedContent`,
   `rewriteTiptapImages`, `rewriteBackgroundImage`, the same functions `GridService.ts` uses for client
   duplication). Only URL fields change; `*Hash` fields are preserved. `roadmap_feed` tile content is
   reset to its unconnected state.
5. **Strip Notion + upvotes** (`deleteNotionAndUpvoteSubcollections`): delete the
   `grids/{gridId}/notionTokens/*` subcollection and the `upvotes` subcollection under each
   `roadmap_feed` tile, so the old owner's Notion OAuth token is never handed over and vote counts do
   not carry.
6. **Ownership flip in a transaction.** In one `runTransaction` (all reads before writes): re-verify the
   grid is still owned by the sender and the transfer is still pending, then `update` the grid with the
   rewritten tiles/background, `userId = recipient`, `rev = rev + 1`, `updatedAt`; clear the sender's
   `defaultGridId` (and `slugs/{senderSlug}.defaultGridId`) if it pointed at this grid; mark the transfer
   `accepted`. This single grid update drives `onGridStorageReferencesUpdated`, which decrements the old
   owner's per-hash `refCount`s and increments the new owner's.
7. **Keep/remove cleanup** (after the transaction, only if `removeOrphanedFiles`):
   `deleteSenderOrphanedFiles` scans the sender's **other** grids for referenced hashes and permanently
   deletes, from the sender's archive, every transferred hash not present in that set (archive doc +
   Storage object). `onFileDeleted` then decrements the sender's `storageUsed`.

Because the copies and quota check happen before the flip, and cleanup happens after, a failure after
the flip leaves the grid safely owned by the recipient and only leaves the sender's cleanup to retry.

## Web app

The client codes against contracts and the service/DAO boundary — see
[Data and service layer](data-and-service-layer.md).

- **Service:** `GridTransferService` (`apps/web/src/services/GridTransferService.ts`) behind
  `GridTransferServiceInterface`, with `MockGridTransferService` for the mock runtime, wired through the
  service factory. Mutations go through `CloudFunctionsDao.callFunction`; listing goes through
  `GridTransferDao`.
- **DAO:** `GridTransferDao` (`packages/contracts/src/dao/GridTransferDao.ts`) exposes
  list/subscribe for incoming and outgoing transfers, filtered by participant per the read rule. The
  Firebase impl is `FirebaseGridTransferDao` in `@grids/pro`; the local stub is `StubbedGridTransferDao`
  in `apps/web/src/dao/stubbed/`. Both are handed out by their DAO factories. This mirrors the realtime
  `UploadArchiveDao` pattern used for upload finalize-watching.
- **Composable:** `useGridTransfers` (`apps/web/src/composables/useGridTransfers.ts`) exposes
  incoming/outgoing transfers and the mutation methods.
- **Sender UI:** `GridSettings.vue` shows an owner-only **Transfer Grid** entry that opens
  `components/modal/TransferGridModal.vue` (recipient email/slug field, keep/remove toggle with a
  tooltip, permanent-action warning). While a pending outgoing transfer exists for the grid, the entry
  flips to a **Cancel Transfer** affordance driven by the outgoing subscription.
- **Recipient UI:** `components/dashboard/PendingGridTransfers.vue` renders on the dashboard. **Accept
  is two steps:** it first calls `previewTransferAcceptance` and shows the total quota cost and an
  itemized file list (marking `alreadyOwned` files as free), disabling **Confirm** when
  `wouldExceedQuota` is true; confirming calls `acceptTransfer`. Because the grid can change between
  preview and accept, `acceptTransfer` may still fail with `resource-exhausted`.

## Edge cases and invariants

- **Recipient must be an existing Grids user** (uid + storage namespace required); unknown email/slug
  returns a generic `not-found`. Resolving by email reveals whether an account exists; this is
  acceptable for an invite flow where the sender types a known address, and the message stays generic.
- **No self-transfer**, enforced at create.
- **One pending transfer per grid**, enforced at create.
- **Grid changed or deleted between invite and accept.** Accept re-reads and re-extracts; if the grid is
  gone or no longer owned by the sender it is marked `expired`. Grid deletion also proactively closes
  pending transfers: `onTrigger_gridDeleted_cleanupSubcollections.ts` flips them to `expired` with
  `failureReason: "grid-deleted"`.
- **Recipient over quota at accept:** hard `resource-exhausted` **before** any mutation; the transfer
  stays pending so the recipient can free space and retry.
- **Dedupe on the recipient side:** files the recipient already has (same hash, `active`) are not
  re-copied and cost no quota.
- **Hashes never change; only URLs** — keeping the shared extractor/`refCount` logic valid.
- **Notion tokens are never handed over; upvotes are scrubbed.** Chat messages
  (`tiles/{tileId}/messages`) carry over with the grid verbatim.
- **Default-grid pointer:** only the sender's is cleared (if it pointed at this grid). The grid is not
  auto-set as the recipient's default.
- **Expiry** is 14 days, enforced lazily at accept/preview and by the daily
  `sweepExpiredGridTransfers` schedule.

## Tests

- Functions: `apps/firebase-functions/src/transfers/__tests__/` (per-callable + the acceptance/util
  suites) and the copy-util and grid-delete-cleanup tests under `src/storage/` and `src/grids/`.
- Contracts: `packages/contracts/src/storage/__tests__/GridStorageRewrite.test.ts`.
- Rules: `rules/__tests__/firebaseRulesHarness.test.ts` covers `gridTransfers` read/write.
- Web: `StubbedGridTransferDao` and `PendingGridTransfers` test suites, plus the Firebase DAO test in
  `@grids/pro`.
