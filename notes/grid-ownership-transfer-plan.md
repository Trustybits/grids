# Grid Ownership Transfer — Implementation Plan

Status: **design/planning only — not yet implemented.**

This document designs a feature that transfers ownership of a grid from one Grids user to
another, including copying the grid's archive-backed files into the recipient's per-user storage
namespace. It is grounded in the current storage/dedup model (`docs/architecture/storage-and-uploads.md`),
the Firestore/Storage rules, the web app in `apps/web`, and the Cloud Functions in
`apps/firebase-functions`.

## Product decisions (confirmed with the maintainer)

1. **Consent model: invitation + accept.** The sender initiates a transfer; the recipient must
   explicitly **accept** before ownership and files move. A pending record is created at initiation
   and the actual work happens at acceptance.
2. **Notion connections are stripped on transfer.** The `grids/{gridId}/notionTokens/{tileId}`
   subcollection is deleted and `roadmap_feed` tiles are reset to unconnected, so the old owner's
   Notion OAuth token is never handed to the new owner.
3. **Default-grid pointer: clear the old owner's only.** If the transferred grid was the old owner's
   `defaultGridId` (and their `slugs/{slug}.defaultGridId`), clear it. Do **not** auto-set it as the
   new owner's default.
4. **No feature flag.** Ship the Transfer Grid entry point unconditionally to grid owners.

## Sender-chosen option: keep vs. remove files

The transfer modal includes a toggle controlling what happens to the **sender's** copies of the
files after transfer:

- **Keep all files (default, non-destructive):** the sender's archive keeps every file that appeared
  on the grid. After the ownership change their `refCount`s for those files drop (the grid no longer
  references them) but the bytes remain in their File Archive.
- **Remove files used only in this grid:** permanently delete, from the **sender's** archive, only
  the files that are referenced **solely** by this grid among the sender's grids. Files also used in
  the sender's other grids are always kept. (Tooltip copy explains exactly this.)

This choice is recorded on the pending-transfer record and applied at **accept** time.

---

## Why this needs a Cloud Function (not client-only)

Two hard constraints make a server component mandatory. The user wondered whether it could be
client-only — it cannot:

1. **Email → uid resolution needs the Admin SDK.** There is no public email index. Slugs resolve
   client-side via the public `slugs/{slug}` collection (`UserService.getUserIdBySlug`), but email
   lookup requires Firebase Auth `admin.auth().getUserByEmail(...)`, which only server code can call.
2. **Copying bytes into the recipient's namespace needs the Admin SDK.** Storage rules
   (`storage.rules`) only allow a user to `create` objects under **their own** `users/{uid}/...`
   path. The sender cannot write into the recipient's namespace from the client. The server copies
   objects with `bucket.file(src).copy(bucket.file(dest))` exactly as
   `onCall_prepareGridDuplicateStorage.ts` already does.

### Key structural facts that make the transfer clean

- **Files are content-addressed.** A file's identity is the SHA-256 of its bytes; the canonical path
  is `users/{uid}/{images|videos|documents}/{sha256}.{ext}`. Copying a file to a new owner keeps the
  **same hash** — only the owner namespace (and therefore the download URL) changes. So the grid's
  stored `srcHash`/`hash` fields do **not** change; only the URL fields are rewritten.
- **refCount already handles owner changes.** `onTrigger_gridStorageReferences.ts`
  (`onGridStorageReferencesUpdated`) detects a grid whose `userId` changed between snapshots and
  **decrements the old owner's** per-hash refCounts while **incrementing the new owner's**. So once
  the recipient has archive docs for those hashes and we write the grid with `userId = recipient`,
  refCount accounting is automatic. `adjustUploadRefCounts` clamps at zero and logs (never throws) if
  a doc is missing — but we must not rely on that: we explicitly create the recipient's archive docs
  first, otherwise the increment would target non-existent docs and the recipient would have broken
  references.
- **Grid queries are ownership-scoped.** The dashboard loads via `GridDao.findByUserId` /
  `GridService.fetchGridsByUserId`. Changing `userId` automatically moves the grid off the sender's
  dashboard and onto the recipient's — no extra bookkeeping needed for listing.
- **Admin writes bypass rules.** Doing the ownership flip + hash/URL rewrite + `rev` bump server-side
  via the Admin SDK sidesteps the `isGridOwner` + `rev`-advance rule contract in `firestore.rules`
  and avoids any client `rev` race.

---

## End-to-end flow (invitation + accept)

```text
SENDER (grid owner)                         SERVER (Cloud Functions / Admin SDK)          RECIPIENT
------------------                          ------------------------------------          ---------
1. GridSettings → "Transfer Grid"
2. TransferGridModal: enter email/slug,
   choose keep/remove, read warning,
   confirm
3. createGridTransfer(gridId,               resolve recipient (email via Admin Auth /
   recipientRef, removeOrphanedFiles) ----> slug via slugs/), validate ownership,
                                            no self-transfer, recipient exists, no
                                            existing pending transfer for this grid,
                                            write gridTransfers/{id} = pending  --------> 4. sees pending
   <---- { transferId, status: pending }                                                    incoming transfer
                                                                                             (dashboard UI)
                                                                                          5. Accept / Decline
6. (optional) sees status flip via     <--- acceptGridTransfer(transferId): <------------ Accept
   outgoing-transfers subscription           - reload grid; verify sender still owns it
                                              - extract archive refs from CURRENT grid
                                              - copy each file into recipient namespace
                                                (Admin copy), create recipient archive
                                                reservations, publish + finalize active
                                              - HARD quota check on recipient (fail if
                                                over) BEFORE any write
                                              - rewrite grid URL fields to recipient URLs
                                                (hashes unchanged), strip notionTokens +
                                                reset roadmap_feed tiles, set
                                                userId = recipient, bump rev (Admin write)
                                              - apply keep/remove: if remove, delete files
                                                referenced ONLY by this grid among sender's
                                                other grids
                                              - if grid was sender's defaultGridId, clear
                                                sender user + slug defaultGridId
                                              - mark transfer accepted
```

`onGridStorageReferencesUpdated` fires from the single grid update and reconciles both users'
refCounts. `onFileDeleted` decrements the sender's `storageUsed` for any removed files.

**Decline / cancel:** recipient can `declineGridTransfer`; sender can `cancelGridTransfer`. Both just
flip status (no file work). Expiry is handled **lazily** (accept rejects an expired transfer) plus an
optional scheduled sweep.

---

## Data model

### New collection: `gridTransfers/{transferId}`

Server-written only. Suggested shape (add a `GridTransfer` type to
`packages/contracts/src/types/`, e.g. `GridTransfer.ts`, exported from the types barrel):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Doc id. |
| `gridId` | string | Grid being transferred. |
| `gridName` | string | Snapshot of the grid name at invite time, for display in recipient UI. |
| `fromUserId` | string | Sender (must own the grid at accept time too). |
| `fromSlug` / `fromEmail` | string \| null | Optional display context for the recipient. |
| `toUserId` | string | Resolved recipient uid. |
| `removeOrphanedFiles` | boolean | Sender's keep/remove choice. |
| `status` | `"pending" \| "accepted" \| "declined" \| "cancelled" \| "expired"` | Lifecycle. |
| `createdAt` / `updatedAt` / `resolvedAt` | timestamp | Lifecycle timestamps. |
| `expiresAt` | timestamp | e.g. +14 days; checked lazily at accept. |
| `failureReason` | string? | Set if an accept attempt fails a precondition. |

**Invariant:** at most **one** `pending` transfer per `gridId` at a time (enforced in
`createGridTransfer`). A second attempt returns `failed-precondition` until the first is
resolved/cancelled.

### `firestore.rules` — add a `gridTransfers` match

```
match /gridTransfers/{transferId} {
  // Sender and recipient can read their own transfers; everyone else cannot.
  allow read: if request.auth != null
              && (resource.data.fromUserId == request.auth.uid
                  || resource.data.toUserId == request.auth.uid);
  // All writes are Cloud Functions only (Admin SDK).
  allow write: if false;
}
```

### `firestore.indexes.json` — composite indexes for the recipient/sender queries

- `toUserId ASC, status ASC` (recipient's incoming pending list)
- `fromUserId ASC, status ASC` (sender's outgoing list, optional)
- optionally add `createdAt DESC` for ordering.

### No `grids` rules change

Ownership flip + rewrite + `rev` bump all happen via Admin SDK, which bypasses rules. We deliberately
do **not** loosen the grid update rule to let a client change `userId`.

---

## Cloud Functions (apps/firebase-functions/src)

Follow the folder/naming conventions (one deployed function per file, `onCall_`/`onTrigger_`/`utils_`
prefixes). Suggested new folder: `src/transfers/`.

### 1. `onCall_createGridTransfer.ts` (callable)

- `requireAuth` → `senderUid`. Payload: `{ gridId, recipient: { email?: string; slug?: string }, removeOrphanedFiles: boolean }`.
- Load `grids/{gridId}`; assert it exists and `userId === senderUid` (else `permission-denied`).
- Resolve recipient uid:
  - slug → `slugs/{slug}.userId`;
  - email → `admin.auth().getUserByEmail(email).uid` (catch not-found → generic
    `not-found: "No Grids account was found for that email/slug."`).
- Assert `recipientUid !== senderUid` (`failed-precondition`).
- Assert no existing `pending` transfer for this `gridId`.
- (Best-effort) estimate additional bytes for the recipient and surface it in the response so the
  sender UI can warn; the **authoritative** quota check happens at accept.
- Write `gridTransfers/{id}` with `status: "pending"`, `expiresAt`, snapshots.
- Optionally notify the recipient (reuse the Discord/notification patterns if desired; not required
  for MVP).
- Return `{ transferId, status: "pending", estimatedBytes }`.

**Privacy note:** resolving by email reveals whether an account exists. Because this is an
invite-based flow where the sender types a known address, this is acceptable, but the error message
should stay generic and the function should be rate-limitable.

### 2. `onCall_acceptGridTransfer.ts` (callable) — the core

- `requireAuth` → `recipientUid`. Payload: `{ transferId }`.
- Load transfer; assert `status === "pending"`, `toUserId === recipientUid`, and not past
  `expiresAt` (else mark `expired` + throw).
- Reload `grids/{gridId}`; assert it still exists and `userId === fromUserId` (else mark
  `failed`/`expired` + throw). This re-read is essential — the grid may have changed since the invite.
- Extract references with `extractGridStorageReferencesFromRecord(grid)` (shared contract extractor).
- **Copy files into recipient namespace** using the same mechanics as
  `onCall_prepareGridDuplicateStorage.ts`, but with the sender as source owner and **no shareable
  gate** (the sender is giving away their own files, so all sender-owned, archive-backed files are
  copiable):
  - For each unique hash, read `users/{fromUserId}/uploads/{hash}`.
  - `active` files → copiable. Files with **no archive doc** (legacy original-filename paths the
    extractor already skips, or missing docs) are **non-copiable** → their tiles become suggestion
    tiles / background removed, mirroring the duplication `replacementTileIds` /
    `removeBackgroundImage` behavior. (In practice the extractor only returns canonical refs, so this
    is an edge case.)
  - Compute `additionalBytesRequired` from only the files the recipient does **not** already have
    (per-user dedupe), then `assertUserHasStorageQuota(recipientUid, additionalBytesRequired)` —
    **hard fail** with `resource-exhausted` before any mutation.
  - For each needed file: `createPendingArchiveReservation(recipientUid, metadata)`,
    `bucket.file(srcPath).copy(bucket.file(destPath))`, `setMetadata({ published: "true", token })`,
    and finalize to `active` (reuse `finalizeUploadArchiveDoc` or the same publish path the duplicate
    callable uses). Build a `rewriteMap` of `hash → { newUrl }` (hash unchanged).
- **Rewrite the grid** server-side to the recipient's URLs. Port the rewrite logic already in
  `apps/web/src/services/GridService.ts` (`rewriteArchiveBackedContent`, `rewriteTiptapImages`,
  `rewriteBackgroundImage`) into a **shared** util so client duplication and server transfer stay in
  lockstep. Recommended home: a new `packages/contracts/src/storage/GridStorageRewrite.ts` (pure,
  no Firebase deps) consumed by both `apps/web` and the functions. Only URL fields change; `*Hash`
  fields stay the same.
- **Strip Notion:** delete `grids/{gridId}/notionTokens/*` and reset any `roadmap_feed` tile content
  to its unconnected state (clear database/token references) so the tile prompts the new owner to
  connect their own Notion.
- **Flip ownership:** in one Admin write, set `userId = recipientUid`, apply the rewritten
  tiles/background, bump `rev = rev + 1`, set `updatedAt`. This single update drives
  `onGridStorageReferencesUpdated` to move refCounts old→new.
- **Apply keep/remove:** if `removeOrphanedFiles`, scan the sender's **other** grids
  (`grids where userId == fromUserId and id != gridId`) for referenced hashes; for every hash on the
  transferred grid **not** present in that set, delete `users/{fromUserId}/uploads/{hash}` + the
  storage object (mirror `onCall_deleteStorageUpload.ts`). This is computed explicitly (not by racing
  the refCount trigger), so it's deterministic. `onFileDeleted` decrements the sender's `storageUsed`.
- **Clear sender default:** if `users/{fromUserId}.defaultGridId === gridId`, set it to `null` and
  clear `slugs/{senderSlug}.defaultGridId` (mirror `onCall_updateDefaultGrid.ts`).
- Mark transfer `accepted` (`resolvedAt`). Return success.

**Preview before accept.** The recipient must be able to see, *before* committing, exactly how much
of their quota will be consumed and which files will be copied into their archive. Provide this via a
read-only **preview** — either a dedicated `onCall_previewGridTransferAcceptance.ts` callable or a
`preview: true` (dry-run) mode on `acceptGridTransfer` that runs the same inventory but performs **no**
copies/writes. It returns:

```jsonc
{
  "additionalBytesRequired": 1234567,          // net new bytes charged to the recipient
  "recipientQuotaRemaining": 987654321,         // for a "you have enough / not enough" indicator
  "wouldExceedQuota": false,
  "files": [                                    // one entry per archive-backed file on the grid
    { "hash": "…", "displayName": "photo.jpg", "kind": "images", "size": 204800, "alreadyOwned": false }
  ],
  "nonCopiableCount": 0                          // legacy/missing-archive refs that will be replaced
}
```

`alreadyOwned` (recipient already has that hash `active`) files are listed but contribute **0** to
`additionalBytesRequired` (per-user dedupe). The recipient UI renders this list + the total quota
cost and disables Accept when `wouldExceedQuota` is true. Because the grid can change between preview
and accept, `acceptGridTransfer` still performs the authoritative quota check and can fail with
`resource-exhausted` even after a green preview.

**Ordering / partial-failure:** do the quota check and file copies first; only then the ownership
flip; only then the sender-side cleanup (removal + default clear). If a step after the flip fails,
the grid is already safely owned by the recipient — cleanup can be retried. Consider wrapping the
Firestore doc mutations (grid flip + transfer status + default clear) in a transaction where
practical; storage byte copies happen before the transaction.

### 3. `onCall_declineGridTransfer.ts` (callable)

- Auth = recipient; assert `toUserId === uid` and `status === "pending"`; set `status = "declined"`.
  No file work. (Could be merged with cancel into one `onCall_resolveGridTransfer.ts` taking an
  action, but the convention favors one clear function per file — decide during implementation.)

### 4. `onCall_cancelGridTransfer.ts` (callable)

- **The sender can cancel their own transfer any time while it is still pending** (before the
  recipient accepts).
- Auth = sender; assert `fromUserId === uid` and `status === "pending"`; set `status = "cancelled"`.
  Because no files are copied and no ownership changes until **accept**, cancellation is a pure
  status flip with no cleanup. Once `status === "accepted"` the transfer is done and cannot be
  cancelled (the confirmed transfer is itself irreversible — a new transfer back would be required).

### 5. Hook grid deletion + optional sweep

- In `onTrigger_gridDeleted_cleanupSubcollections.ts` (or a sibling trigger to keep concerns
  separate), cancel/expire any `pending` `gridTransfers` for the deleted `gridId` so a stale transfer
  can't later resolve against a missing grid. Accept already guards this, but proactively closing them
  keeps the recipient UI clean.
- Also `onSchedule_sweepExpiredGridTransfers.ts` to flip long-past-`expiresAt` pendings to
  `expired`.

### Shared server utils

- `src/transfers/utils_gridTransfer.ts` — transfer doc read/validate helpers.
- Reuse from `src/storage/`: `readUploadArchiveDoc`, `createPendingArchiveReservation`,
  `ensureDownloadToken`, `buildDownloadUrl`, `assertUserHasStorageQuota`, `finalizeUploadArchiveDoc`,
  `buildCanonicalUploadPath`. **Factor the copy loop** currently inline in
  `onCall_prepareGridDuplicateStorage.ts` into a shared `utils_copyArchiveObjects.ts` so both the
  duplicate and transfer callables use one implementation (with a `requireShareable` flag: `true` for
  cross-user duplication, `false` for owner-authorized transfer).

### `index.ts` exports

Export the new callables/triggers alongside the existing storage/accounts exports.

---

## Web app (apps/web/src)

### Contracts / types (`packages/contracts`)

- `types/GridTransfer.ts` — `GridTransfer` domain type + the callable request/response types
  (`CreateGridTransferRequest/Response`, `AcceptGridTransferRequest/Response`, etc.). Export from the
  types barrel.
- `storage/GridStorageRewrite.ts` — the shared, Firebase-free rewrite functions ported from
  `GridService.ts` (see above), so `apps/web` duplication and the server transfer share one impl.

### Service layer (backend-agnostic)

Add a `GridTransferService` (interface in `services/interfaces/GridTransferServiceInterface.ts`,
impl in `services/GridTransferService.ts`, mock in `services/mocks/`, wired through the service
factory). Methods:

- `createTransfer(gridId, recipient, removeOrphanedFiles)` → callable via `CloudFunctionsDao`.
- `acceptTransfer(transferId)` / `declineTransfer(transferId)` / `cancelTransfer(transferId)` →
  callables.
- `listIncomingTransfers()` / `subscribeIncomingTransfers(cb)` and the outgoing equivalents.

**Listing option:**
- **Realtime DAO (recommended, matches existing pattern):** add a `GridTransferDao` to
  `@grids/contracts/dao` with a Firebase impl in `@grids/pro` and a stubbed impl in
  `src/dao/stubbed/`, subscribing to `gridTransfers` filtered by participant (read rule above). This
  mirrors the realtime `UploadArchiveDao` already used for finalize-watching.

The mutation callables can also be exposed as thin methods on the existing
`CloudFunctionsService.callFunction`, but a typed `GridTransferService` keeps components clean and
testable, consistent with the codebase's service pattern.

### Sender UI — `GridSettings.vue` + new `TransferGridModal.vue`

- In `GridSettings.vue`'s owner-only `MenuSection` (near "Duplicate Grid" / "Delete Grid"), add a
  `MenuItem` **"Transfer Grid"** (owner-only via the existing `isOwner` computed). Clicking opens a
  new modal.
- `components/modal/TransferGridModal.vue` (follow existing modal primitives like `PromptModal.vue` /
  `OgImageModal.vue`):
  - **Warning** text: transferring is permanent and cannot be undone; you will lose access once the
    recipient accepts.
  - **Input** for recipient **email or slug** (single field; detect `@` to decide email vs slug, or
    accept either and let the server resolve).
  - **Toggle** (reuse `Toggle.vue`) for keep-vs-remove files, defaulting to **keep**. Next to it, a
    short sentence with a **`?`** affordance that expands a tooltip (reuse `FloatingTooltip.vue` /
    the `ui-elements/` tooltip) explaining: "Remove files that appear only on this grid from your
    File Archive. Files you also use in other grids are always kept."
  - **Confirm** → `gridTransferService.createTransfer(...)`; on success show a toast ("Transfer
    invitation sent to <recipient>") and close; on error surface the server message (not found,
    self-transfer, already-pending, over-quota estimate, etc.).
  - Consider a type-to-confirm guard (like `PromptModal`'s `require-match`) given the destructive
    framing — optional.
- **Pending-transfer / cancel state on the sender side.** Once an invitation is sent and still
  `pending`, the grid should reflect that a transfer is awaiting the recipient, and the sender must be
  able to **cancel** it. Surface this where the owner already manages the grid — e.g. in
  `GridSettings.vue` the "Transfer Grid" item becomes a "Transfer pending — Cancel" affordance while a
  pending transfer exists for the current grid (driven by the outgoing-transfers subscription/list),
  calling `gridTransferService.cancelTransfer(transferId)`. Optionally also list outgoing pending
  transfers on the dashboard. Cancel is available right up until the recipient accepts.

### Recipient UI — pending incoming transfers

- New `composables/useGridTransfers.ts` exposing incoming/outgoing transfers (subscription or fetch).
- New component (e.g. `components/dashboard/PendingGridTransfers.vue`) rendered on the
  **DashboardPage** showing each pending incoming transfer: grid name, sender, and **Accept** /
  **Decline** actions.
  - **Accept flow (two steps):** clicking Accept first calls the **preview**
    (`previewTransferAcceptance(transferId)`) and shows a confirmation panel with **the total storage
    quota that will be used** (`additionalBytesRequired`, formatted via `formatBytes`, against the
    recipient's remaining quota) and **an itemized list of the files that will be copied** into their
    archive (displayName, kind, size; mark `alreadyOwned` files as "already in your archive — no
    extra storage"). Disable the final Confirm when `wouldExceedQuota` is true and show a "free up
    space" hint. Confirming calls `acceptTransfer(transferId)` → loading state → toast. On success,
    refresh the dashboard grid list (the grid now belongs to the recipient) and route to it if
    desired. `acceptTransfer` may still fail with `resource-exhausted` if the grid grew after preview.
  - **Decline** → `declineTransfer(transferId)`.
- Optionally surface a badge/count in the app bar / `UserMenu` when incoming pending transfers exist.

### Stubbed runtime (local dev)

- Add stubbed implementations so the flow works against the local stubbed backend
  (`src/dao/stubbed/`, `src/services/mocks/`): stub the transfer callables and (if using the DAO
  route) a `StubbedGridTransferDao`. Keep parity with how `StubbedCloudFunctionsDao` handles the
  duplicate/storage callables.

---

## Edge cases & invariants to honor

- **Recipient must be an existing Grids user.** We need their uid + storage namespace; unknown
  email/slug → generic not-found.
- **No self-transfer.** Reject when recipient resolves to the sender.
- **One pending transfer per grid.** Enforced at create; second attempt fails until resolved.
- **Grid changed/deleted between invite and accept.** Accept re-reads the grid and re-extracts refs;
  if the grid is gone or no longer owned by the sender, the accept fails and the transfer is
  expired/failed. Grid deletion also proactively closes pending transfers.
- **Recipient over quota at accept.** Hard `resource-exhausted` failure **before** any mutation; the
  transfer stays pending so the recipient can free space and retry.
- **Dedupe on the recipient side.** Files the recipient already has (same hash, `active`) are not
  re-copied and cost no quota — same as the duplicate path.
- **Hashes never change; only URLs.** The rewrite touches URL fields only; `*Hash` fields are
  preserved, keeping the shared extractor/refCount logic valid.
- **Non-copiable / legacy refs.** Any archive-backed ref without an active archive doc is treated
  like the duplicate path's non-copiable case (suggestion-tile replacement / background removal),
  rather than leaving the recipient pointed at the sender's soon-to-be-deleted object.
- **Notion tokens are never handed over.** `notionTokens` subcollection deleted; `roadmap_feed` tiles
  reset to unconnected.
- **Chat messages / upvotes** (`tiles/{tileId}/messages`, `tiles/{tileId}/upvotes`) live under the
  grid doc and carry over with the grid automatically (no userId rewrite needed) — confirm this is
  desired during implementation; if authorId-scoped moderation matters, revisit.
- **`onGridUpdated` notification** fires on the ownership flip (updatedAt + tiles change). Confirm it
  produces a sensible/no message for a transfer; adjust `hasMeaningfulChanges` handling if the
  transfer should be announced differently or suppressed.

---

## Suggested implementation order

1. **Contracts:** `GridTransfer` types + shared `GridStorageRewrite` util; refactor
   `GridService.ts` to consume the shared rewrite (no behavior change) with tests.
2. **Server storage refactor:** extract the copy loop from `onCall_prepareGridDuplicateStorage.ts`
   into `utils_copyArchiveObjects.ts` (with `requireShareable` flag); keep duplicate behavior
   identical (tests green).
3. **Server transfer callables:** `createGridTransfer`, `acceptGridTransfer`, `declineGridTransfer`,
   `cancelGridTransfer`; grid-delete cleanup hook; expiry sweep. Unit tests for each
   (ownership, self-transfer, quota fail, keep/remove, Notion strip, default clear, expired accept).
4. **Rules + indexes:** `gridTransfers` read/write rules; composite indexes; rules tests.
5. **Web services/DAO:** `GridTransferService` (+ interface/mock), transfer DAO or callable listing,
   stubbed impls.
6. **Sender UI:** `TransferGridModal.vue` + `GridSettings.vue` entry point.
7. **Recipient UI:** `useGridTransfers` + `PendingGridTransfers.vue` on the dashboard (+ optional
   app-bar badge).
8. **Docs:** add a `docs/architecture/grid-ownership-transfer.md` (or extend
   `storage-and-uploads.md`) describing the transfer model, and update any relevant maintainer notes.

## Open items to confirm during implementation

- Merge decline+cancel into one `resolveGridTransfer` callable, or keep separate (convention leans
  separate).
- Whether to notify the recipient out-of-band (Discord/email) at invite time. - Do not do this
- Whether chat messages/upvotes should carry over verbatim or be scrubbed. - chat messages carry over verbatim, upvotes and notion-related things are scrubbed
- Exact `expiresAt` window (proposed 14 days) and whether to ship the scheduled sweep in v1. - 14 days is fine, and we do want a sweep that removes expired ones running on a schedule
