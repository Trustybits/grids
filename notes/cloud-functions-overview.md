# Cloud Functions Overview

Every deployed Cloud Function in `apps/firebase-functions`, grouped by folder. Each entry lists the
exported (deployed) name, its trigger type, and what it does — grounded in the source. All functions
are Firebase v1 and short-circuit early when maintenance mode is enabled (`noopIfMaintenance` /
`respondWithMaintenanceIfEnabled`).

## accounts

- MI **assignDefaultGridOnCreate** — Firestore `onCreate` on `grids/{gridId}`. When a user's first fresh
  grid is created, sets it as their `defaultGridId` (on the user doc and mirrored to their `slugs` doc)
  if they don't already have one. Skips cloned/duplicated grids (`clonedFrom`). Runs independently of
  the grid-created Discord notification so core data assignment can't be blocked by notification logic.
- MI **checkSlugAvailability** — Callable (`onCall`). Validates a requested slug's format, rejects reserved
  slugs, and checks the `slugs` collection to report whether it's available, taken, released, or the
  caller's own slug. Read-only — does not claim anything. Requires auth.
- MI **claimSlug** — Callable. Claims or updates the caller's slug in a transaction: enforces format,
  reserved-word, and uniqueness rules, releases the user's previous slug (recording ownership history),
  and writes the new slug to both the `slugs` and `users` docs. Requires auth.
- MI **updateDefaultGrid** — Callable. Sets the caller's `defaultGridId` on their user doc and mirrors it to
  their `slugs` doc for public access. Requires auth.

## analytics

- **trackGridViewEndBeacon** — HTTP `onRequest`. Endpoint for `navigator.sendBeacon`, called on page
  unload/hide to record a `grid_view_end` event (client Firestore writes are unreliable during teardown).
  Validates/size-caps/rate-limits the payload per IP+grid, then writes an `analyticsEvents` doc.
- **onAnalyticsEventCreated** — Firestore `onCreate` on `analyticsEvents/{docId}`. Aggregates each raw
  analytics event (grid views/view-ends, tile add/remove, signups, logins, grid create/delete) into
  rolled-up `businessStats` (global + per-day) documents.

## grids

- **cleanupGridSubcollectionsOnDelete** — Firestore `onDelete` on `grids/{gridId}`. Cascades deletion of
  the grid's orphaned subtree (Firestore doesn't cascade): expires any pending `gridTransfers` for the
  grid, then `recursiveDelete`s the grid ref to remove descendant subcollections (e.g. chat tiles'
  `messages`). Separate from the grid-deleted notification so cleanup can't be blocked by it.
- **sweepOrphanedSubcollections** — Scheduled (`pubsub.schedule`, weekly Wed 23:00 America/Denver,
  540s timeout). Backstop sweep that reclaims orphaned tile subcollections (phantom `tiles/{tileId}`
  docs whose messages were never cascaded) on kept grids. Paginated reads and a per-run deletion cap
  keep it bounded; guarded by a 24h message-age grace and a skip for actively-edited grids.

## transfers

- MI **createGridTransfer** — Callable. Sender initiates transferring grid ownership to a recipient:
  resolves the recipient UID, rejects self-transfer, builds a transfer inventory, and creates a pending
  `gridTransfers` doc with an expiry.
- MI **previewGridTransferAcceptance** — Callable. Recipient previews what accepting a pending transfer
  entails (inventory + their remaining storage quota) without accepting. Validates ownership/pending/
  not-expired.
- MI **acceptGridTransfer** — Callable. Recipient accepts a pending transfer: copies archived storage
  objects to the recipient, rewrites the grid for the new owner, deletes the sender's Notion/upvote
  subcollections and orphaned files, and resolves the transfer. Validates ownership/pending/not-expired.
- MI **declineGridTransfer** — Callable. Recipient declines a pending transfer, marking it resolved as
  `declined`.
- MI **cancelGridTransfer** — Callable. Sender cancels their own pending transfer, marking it resolved as
  `cancelled`.
- **sweepExpiredGridTransfers** — Scheduled (daily 03:00 America/Denver). Batch-marks all pending
  `gridTransfers` whose `expiresAt` has passed as `expired`.

## integrations

- **fetchNotionRoadmap** — Callable (Notion secrets). Fetches pages from a grid's connected Notion
  database, maps them to roadmap items via the owner-configured status mapping/filters, and returns up
  to 100 items sorted by upvotes plus the available status options. No auth required (roadmap data is
  public); the Notion token is read server-side and never returned.
- **listNotionDatabases** — Callable (Notion secrets). Lists the Notion databases shared with the
  integration (via Notion's search endpoint) so the owner can pick one after OAuth. Requires auth.
- **notionOAuthExchange** — Callable (Notion secrets). Exchanges a Notion OAuth authorization code for an
  access token and stores it server-side (encrypted) at `grids/{gridId}/notionTokens/{tileId}`. Verifies
  the caller owns the grid; token is never returned to the client. Requires auth.
- **upvoteRoadmapItem** — Callable (Notion secrets). Records/toggles a user's upvote on a roadmap item
  (one doc per user per item under the tile's `upvotes` subcollection) and patches the new count back to
  the Notion page. Requires auth.

## notifications

- **onGridCreated** — Firestore `onCreate` on `grids/{gridId}` (Discord secret). Writes a `grid_created`
  analytics event and sends a Discord notification to the user-activity channel (skips dev-team users).
- **onGridDeleted** — Firestore `onDelete` on `grids/{gridId}` (Discord secret). Writes a `grid_deleted`
  analytics event and sends a Discord user-activity notification.
- **onGridUpdated** — Firestore `onUpdate` on `grids/{gridId}` (Discord secret). Fires only when
  `updatedAt` actually changed and a meaningful field (name/tiles/privacy) changed, then sends a Discord
  user-activity notification.
- **onNewUserSignup** — Auth `user().onCreate` (Discord secret). On new user signup, detects the sign-in
  method, writes a `user_signup` analytics event, syncs the dev-account flag, and sends a Discord
  notification to the new-users channel.
- **onUserLogin** — Firestore `onUpdate` on `users/{userId}` (Discord secret). Detects a login by a
  change in the `lastLogin` timestamp, then writes a login analytics event and sends a Discord
  user-activity notification.

## scraping

- MI **getLinkPreview** — Callable. Fetches and parses a URL's Open Graph / metadata to build a link-tile
  preview (title, description, image, etc.). Validates and normalizes the URL. Requires auth.
- MI **getMusicTrackMetadata** — Callable. Fetches track details and a color palette for a Spotify or Apple
  Music track by scraping embed pages / the iTunes API. Requires auth.
- MI **getYouTubeMetadata** — Callable (YouTube API-key secret). Fetches public metadata for a YouTube
  video, playlist, channel, or short via the YouTube Data API v3. Requires auth.

## storage

- MI **authorizeStorageUpload** — Callable. Authorizes an upload reservation from normalized upload
  metadata (the hash + authorize + archive step that gates the client's actual upload). Requires auth.
- MI **deleteStorageUpload** — Callable. Deletes an archived upload the caller owns and decrements their
  storage usage; refuses deletion of still-referenced files unless `force` is set. Requires auth.
- MI **ensureDocumentItemThumbnail** — Callable (1GB, 120s). Generates a page-1 thumbnail for a PDF item in
  a document tile using a headless Chromium browser + `sharp`, and writes the thumbnail URL back. Requires
  auth.
- MI **getStorageUploadDownloadUrl** — Callable. Returns the download URL for an active, shareable archive
  upload identified by owner + hash. Requires auth.
- MI **prepareGridDuplicateStorage** — Callable. Plans/executes storage-object copies when duplicating a
  grid: for a `full` copy computes the plan (bytes required, copiable/non-copiable counts, replacement
  tile ids) and copies objects; for a `structure`-only copy returns an empty plan. Requires auth.
- MI **setStorageUploadDisplayName** — Callable. Renames an archive upload's `displayName` only (object
  path, hash, and grid references untouched). Requires auth.
- MI **setStorageUploadShareable** — Callable. Toggles an archive upload's `shareable` flag. Requires auth.
- MI **generateThumbnail** — HTTP `onRequest` (2GB, 120s). Puppeteer/Chromium screenshot of a grid page with
  all UI chrome removed, producing a transparent PNG at desktop/tablet/mobile breakpoints (for in-app
  grid cards, share previews, alt OG layouts). Caches results in Storage; `?refresh=1` bypasses cache.
- MI **generateOgImage** — HTTP `onRequest` (2GB, 90s). Puppeteer/Chromium generator for a 1200×630 social
  share card: screenshots each public tile, composes a scattered layout with avatar/name/handle, renders
  to PNG, caches it in Storage, and 302-redirects clients there. `?check=1` is an existence probe;
  `?refresh=1`/`?seed=` bypass cache.
- MI **onFileUploaded** — Storage `object().onFinalize`. On a finalized upload: parses the storage object,
  increments the user's storage usage, hashes the object, and finalizes (or marks failed) its upload
  archive doc / download token.
- **onFileDeleted** — Storage `object().onDelete`. Decrements the user's storage usage when a canonical
  storage object is deleted.
- MI **onGridStorageReferencesCreated / onGridStorageReferencesUpdated / onGridStorageReferencesDeleted** —
  Firestore `onCreate` / `onUpdate` / `onDelete` on `grids/{gridId}`. Reconcile per-hash reference-count
  deltas for storage uploads as a grid's file references change (including owner changes on transfer), so
  upload `refCount`s stay accurate. Three exports from one file over the same document path.

## badges

- **grantSupporterBadgeOnPayment** — Firestore `onWrite` on `customers/{uid}/payments/{paymentId}`
  (written by the firestore-stripe-payments extension). On a succeeded payment, re-sums the user's
  succeeded payments and grants the `supporter` badge in `userBadges/{uid}` if the total meets the
  threshold and they don't already have it. Idempotent; refunds not handled.
