# Undo/Redo Architecture Notes

## Summary

Snapshot-based undo/redo, scoped per grid per breakpoint. 20-entry limit, in-memory only (no persistence). Covers: tile CRUD, resize, move, duplicate, image crop, background images, tile color, gravity toggle, light/dark mode, tile borders, and tile links.

---

## Recommended Architecture: Plain TypeScript Class (`UndoRedoManager`)

**Not a Pinia store. Not a composable. A standalone class.**

### Why a class, not a Pinia store?

- The undo/redo stacks are **per grid per breakpoint** — you'd need a dynamically keyed map inside a store, which fights Pinia's flat-state model.
- The stacks are ephemeral (session-only, no persistence), so they don't benefit from Pinia devtools, `$subscribe`, or any of the store ecosystem.
- A plain class is simpler to instantiate, dispose, and test. No global singleton to clean up when the user navigates away from a grid.

### Why not a composable?

- Composables are great for reactive logic tied to a component's lifecycle, but undo/redo state needs to survive component remounts (e.g., switching tabs or panels inside the grid editor). A class instance held by the layout store or a parent component is more stable.

---

## Proposed File Structure

```
src/undo/
  UndoRedoManager.ts      # The core class — one instance per grid
  types.ts                 # Snapshot type, action label enum
```

Two files. That's it. Resist the urge to add a DAO, service interface, or factory — this is session-only in-memory state with no persistence and no external dependencies.

---

## `UndoRedoManager` Design

### Ownership

- **One `UndoRedoManager` instance per loaded grid.** Created when a grid is loaded, discarded when the user navigates away (`clearCurrentLayout`).
- Internally, the manager holds **three independent stacks** — one per breakpoint (`lg`, `md`, `sm`).

### Snapshot Shape

A snapshot is a serialized picture of the grid state at a point in time. Since undo targets are breakpoint-scoped, each snapshot should capture what's relevant to that breakpoint:

```
Snapshot {
  tiles: Tile[]                                      // deep clone of currentLayout.tiles
  overrides: Partial<Record<Breakpoint, Record<string, TilePosition>>>  // deep clone
  verticalCompact: boolean
  themeId: string
  backgroundImageSrc: string
  backgroundEmbed: boolean
  actionLabel: string                                // human-readable label, e.g. "Move tile", "Toggle dark mode"
}
```

**Why snapshot the whole layout, not just diffs?**

- The undoable actions span tiles, overrides, theme, gravity, and background — a diff system would need to know the shape of every possible change. Snapshots are simpler, and with a cap of 20 entries times 3 breakpoints, memory is negligible (a grid with 50 tiles serializes to ~10-20 KB).
- Restoring state is a single assignment, no patch logic, no ordering bugs.

### Stack Structure (per breakpoint)

```
undoStack: Snapshot[]    // max 20
redoStack: Snapshot[]    // cleared on any new push
```

### Core API

```
pushSnapshot(breakpoint, snapshot)   // called BEFORE the mutation happens
undo(breakpoint) → Snapshot | null   // pops from undo, pushes current state to redo, returns the snapshot to restore
redo(breakpoint) → Snapshot | null   // pops from redo, pushes current state to undo, returns the snapshot to restore
canUndo(breakpoint) → boolean
canRedo(breakpoint) → boolean
clear()                              // wipe all stacks (called on grid unload)
clearBreakpoint(breakpoint)          // wipe stacks for one breakpoint
```

---

## Integration with the Layout Store

### Where to capture snapshots

The layout store is the single source of truth for mutations. Every undoable action already flows through a store action (`addTile`, `removeTile`, `resizeTile`, `duplicateTile`, `toggleVerticalCompact`, `patchTileContent`, `toggleTileBorder`, `addBackgroundImage`, etc.).

**The pattern:** at the top of each undoable store action, before mutating state, call `undoRedoManager.pushSnapshot(activeBreakpoint, currentSnapshot())`.

This keeps capture logic centralized in the store — components don't need to know about undo.

### Where to hold the manager instance

Add a non-reactive field to the layout store (or a module-level variable next to the store):

```
let undoRedoManager: UndoRedoManager | null = null;
```

- `loadLayout` → create a new `UndoRedoManager`
- `clearCurrentLayout` → call `manager.clear()`, set to null

Non-reactive because the stacks themselves don't need to drive Vue reactivity — only `canUndo`/`canRedo` booleans need to be reactive, and those can be exposed as store getters that delegate to the manager.

### Restoring state on undo/redo

Add `undo()` and `redo()` actions to the layout store:

1. Call `manager.undo(activeBreakpoint)` to get the previous snapshot.
2. Apply the snapshot fields back onto `currentLayout` (deep-assign tiles, overrides, verticalCompact, themeId, backgroundImageSrc, backgroundEmbed).
3. Call `saveLayout()` to persist the restored state.
4. If themeId changed, also call `themeStore.setTheme(snapshot.themeId)`.

### Reactive canUndo / canRedo

Because the manager is non-reactive, the store needs a lightweight signal to tell Vue when undo/redo availability changes. Options:

- **Option A (simplest):** Add a `undoRedoVersion: number` counter to store state. Increment it every time `pushSnapshot`, `undo`, or `redo` is called. Then `canUndo` and `canRedo` getters read the version (to trigger reactivity) and delegate to the manager.
- **Option B:** Use `ref()` wrappers for canUndo/canRedo booleans, updated by the manager via a callback.

Option A is recommended — it's one extra number field and zero coupling between the manager and Vue.

---

## Breakpoint Scoping Details

### Why per-breakpoint stacks?

At `md` and `sm`, tile positions come from `overrides[bp]`, not the base tile coords. If a user rearranges tiles at `md` and hits undo, they expect the `md` layout to revert — not the `lg` layout. Separate stacks make this natural.

### Cross-breakpoint actions

Some actions affect all breakpoints (e.g., deleting a tile removes it everywhere, toggling dark mode is global). For these:

- Push a snapshot to the **currently active** breakpoint's stack only. The snapshot captures the full layout including overrides for all breakpoints, so restoring it will revert the cross-breakpoint effect.
- This means if you delete a tile while viewing `md`, then switch to `lg` and hit undo, it won't undo the delete — you'd have to switch back to `md`. This is the expected behavior: undo history follows the breakpoint you were working in.

---

## Keyboard Shortcut

Wire `Ctrl+Z` / `Cmd+Z` for undo and `Ctrl+Shift+Z` / `Cmd+Shift+Z` for redo at the grid editor level. Gate behind `canEdit` so viewers can't trigger it.

---

## Edge Cases to Handle

1. **Uploading tiles:** If a tile is mid-upload (blob URL) and the user undoes, the snapshot will restore the blob URL. The resolved URL in `resolvedUrls` may not match. Consider skipping undo capture for in-progress uploads, or clearing `resolvedUrls` entries for tiles whose `src` changed during restore.

2. **Autosave race:** `saveLayout()` is debounced/queued via `queueSave`. Undo triggers a save — make sure the queue doesn't coalesce the undo-save with a stale pending save.

3. **Chat content:** Chat tiles (`ChatContent`) have live messages from other users. Snapshots will capture chat state, but restoring old chat state could lose messages. Consider excluding chat tile content from snapshots (or marking chat tiles as non-restorable for content).

4. **Campfire / Clicker / RPG tiles:** These have live game state. Same concern as chat — snapshot capture is fine, but restoring old game state may be confusing. Consider only snapshotting their position/size, not their content.

---

## What NOT to Build

- **Command pattern / action objects:** Overkill for this use case. Snapshot-based is simpler and covers all actions uniformly without writing inverse logic for each mutation.
- **Persistence:** Stacks are session-only. Don't store in localStorage, IndexedDB, or Firestore.
- **Global undo across grids:** Each grid owns its manager. Navigating away discards history.
- **Granular text undo:** Text editing within TipTap/contenteditable already has its own undo. Don't try to capture every keystroke — only capture the text state when the user commits (blur, save, etc.).
