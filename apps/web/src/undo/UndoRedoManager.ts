import type { Snapshot } from "./UndoTypes";
import { GridSnapshotCodec } from "./GridSnapshotCodec";

const MAX_STACK_SIZE = 20;

interface InternalSnapshot extends Snapshot {
  snapshotId: number;
  timestamp: number;
}

export class UndoRedoManager {
  private undoStack: InternalSnapshot[];
  private redoStack: InternalSnapshot[];
  private onChanged: (() => void) | null;
  private snapshotCodec: GridSnapshotCodec;
  private nextSnapshotId = 1;

  constructor(
    onChanged?: () => void,
    snapshotCodec = new GridSnapshotCodec(),
  ) {
    this.undoStack = [];
    this.redoStack = [];
    this.onChanged = onChanged ?? null;
    this.snapshotCodec = snapshotCodec;
  }

  private stamp(snapshot: Snapshot): InternalSnapshot {
    return {
      ...this.snapshotCodec.clone(snapshot),
      snapshotId: this.nextSnapshotId++,
      timestamp: Date.now(),
    };
  }

  private strip(snapshot: InternalSnapshot): Snapshot {
    const { snapshotId: _, timestamp: _ts, ...rest } = snapshot;
    return this.snapshotCodec.clone(rest);
  }

  pushSnapshot(snapshot: Snapshot): void {
    if (this.isDuplicate(snapshot)) return;

    this.undoStack.push(this.stamp(snapshot));
    if (this.undoStack.length > MAX_STACK_SIZE) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.onChanged?.();
  }

  undo(currentSnapshot: Snapshot): Snapshot | null {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return null;

    this.handleDifferingBreakpoints(currentSnapshot, snapshot);

    this.redoStack.push({
      ...currentSnapshot,
      actionLabel: snapshot.actionLabel,
      snapshotId: snapshot.snapshotId,
      timestamp: snapshot.timestamp,
    });
    this.onChanged?.();
    return this.strip(snapshot);
  }

  redo(currentSnapshot: Snapshot): Snapshot | null {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return null;

    this.handleDifferingBreakpoints(currentSnapshot, snapshot);

    this.undoStack.push({
      ...currentSnapshot,
      actionLabel: snapshot.actionLabel,
      snapshotId: snapshot.snapshotId,
      timestamp: snapshot.timestamp,
    });
    this.onChanged?.();
    return this.strip(snapshot);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getStacks(): {
    undoStack: { actionLabel: string; timestamp: number; snapshotId: number }[];
    redoStack: { actionLabel: string; timestamp: number; snapshotId: number }[];
  } {
    const pick = (s: InternalSnapshot) => ({
      actionLabel: s.actionLabel,
      timestamp: s.timestamp,
      snapshotId: s.snapshotId,
    });
    return {
      undoStack: this.undoStack.map(pick),
      redoStack: this.redoStack.map(pick),
    };
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChanged?.();
  }

  /**
   * Union of every tile id referenced by any snapshot in either stack. Used by
   * deferred chat-tile cleanup to tell whether a removed tile is still
   * restorable via undo/redo (and therefore must not have its messages deleted
   * yet). Reports reachability only — it has no knowledge of Firestore.
   */
  getReferencedTileIds(): Set<string> {
    const ids = new Set<string>();
    for (const stack of [this.undoStack, this.redoStack]) {
      for (const snapshot of stack) {
        for (const tile of snapshot.tiles) {
          ids.add(tile.i);
        }
      }
    }
    return ids;
  }

  getLastActionLabel(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].actionLabel;
  }

  getNextRedoActionLabel(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].actionLabel;
  }

  peekAtUndo(): Snapshot | null {
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  peekAtRedo(): Snapshot | null {
    return this.redoStack[this.redoStack.length - 1] ?? null;
  }

  undoRedoUntil(snapshotId: number, currentSnapshot: Snapshot): Snapshot | null {
    const undoIndex = this.undoStack.findIndex(s => s.snapshotId === snapshotId);
    if (undoIndex !== -1) {
      const count = this.undoStack.length - undoIndex;
      let rolling: Snapshot = currentSnapshot;
      for (let i = 0; i < count; i++) {
        const result = this.undo(rolling);
        if (!result) break;
        rolling = result;
      }
      return rolling;
    }

    const redoIndex = this.redoStack.findIndex(s => s.snapshotId === snapshotId);
    if (redoIndex !== -1) {
      const count = this.redoStack.length - redoIndex;
      let rolling: Snapshot = currentSnapshot;
      for (let i = 0; i < count; i++) {
        const result = this.redo(rolling);
        if (!result) break;
        rolling = result;
      }
      return rolling;
    }

    return null;
  }

  replaceBlobUrl(
    tileId: string,
    permanentUrl: string,
    documentItemId?: string,
  ): void {
    for (const stack of [this.undoStack, this.redoStack]) {
      for (const snapshot of stack) {
        this.snapshotCodec.replaceBlobUrl(
          snapshot,
          tileId,
          permanentUrl,
          documentItemId,
        );
      }
    }
  }

  private isDuplicate(snapshot: Snapshot): boolean {
    const top = this.undoStack[this.undoStack.length - 1];
    if (!top) return false;

    return this.snapshotCodec.equals(snapshot, top);
  }

  private handleDifferingBreakpoints(
    currentSnapshot: Snapshot,
    newSnapshot: Snapshot,
  ) {
    const newBreakpoint = newSnapshot.forcedBreakpoint ?? currentSnapshot.forcedBreakpoint;

    if (newBreakpoint !== currentSnapshot.forcedBreakpoint) {
      currentSnapshot.forcedBreakpoint = newBreakpoint;
    }
  }
}
