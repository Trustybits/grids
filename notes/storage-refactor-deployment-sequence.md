# Storage Refactor Deployment Sequence

This note captures the intended rollout order for the `rev` gate, new storage paths, Firestore rules, and migration.

## Recommended sequence

1. Deploy the new client first.
   - New sessions start writing `rev` values and new storage paths.
   - Legacy grids that do not have a `rev` field are loaded as `rev = 0`.
   - The first normal content save for a legacy grid writes `rev = 1`, so the field is added opportunistically as users edit.

2. Let the new client bake briefly.
   - This reduces the number of active old-client tabs.
   - It does not eliminate stale tabs entirely; an old tab can stay open indefinitely.

3. Turn on Firestore `rev` rules before migration rewrites old grid URLs.
   - This is the hard safety gate against old or stale clients overwriting migrated URLs with whole-document saves.
   - Rules should allow `lastOpenedAt`-only updates without a `rev` bump.
   - Rules should require grid-content updates to advance `rev` exactly once.

4. Run migration/backfill after rules are enforcing `rev`.
   - Admin SDK migration bypasses Firestore rules, so migration code must bump `rev` itself transactionally when rewriting grids.
   - Do not wait until after migration to enable `rev` rules; the point of `rev` is to protect migration rewrites from stale whole-document saves.

## Stale-tab behavior

New client code without Firestore `rev` rules works for new sessions because `GridService` passes the loaded `expectedRev`, and `FirebaseGridDao` uses a Firestore transaction to reject stale writes.

The remaining risk before rules are enabled is old stale tabs running the pre-`rev` client. Those clients can still write whole grid content without checking or bumping `rev`. If a new client writes `rev = 1`, an old tab can still update tiles/settings and preserve the existing `rev` while overwriting content. Firestore `rev` rules close that window for client SDK writes.
