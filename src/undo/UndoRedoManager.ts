import type { Snapshot } from "./UndoTypes";

const MAX_STACK_SIZE = 20;

export class UndoRedoManager {
  private undoStack: Snapshot[];
  private redoStack: Snapshot[];
  private onChanged: (() => void) | null;

  constructor(onChanged?: () => void) {
    this.undoStack = [];
    this.redoStack = [];
    this.onChanged = onChanged ?? null;
  }

  pushSnapshot(snapshot: Snapshot): void {
    if (this.isDuplicate(snapshot)) return;

    this.undoStack.push(snapshot);
    if (this.undoStack.length > MAX_STACK_SIZE) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.onChanged?.();
  }

  undo(currentSnapshot: Snapshot): Snapshot | null {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return null;

    this.redoStack.push({
      ...currentSnapshot,
      actionLabel: snapshot.actionLabel,
    });
    this.onChanged?.();
    return snapshot;
  }

  redo(currentSnapshot: Snapshot): Snapshot | null {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return null;

    this.undoStack.push({
      ...currentSnapshot,
      actionLabel: snapshot.actionLabel,
    });
    this.onChanged?.();
    return snapshot;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChanged?.();
  }

  getLastActionLabel(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].actionLabel;
  }

  getNextRedoActionLabel(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].actionLabel;
  }

  private isDuplicate(snapshot: Snapshot): boolean {
    const { actionLabel: _a, ...incomingData } = snapshot;
    const { actionLabel: _b, ...topOfStackData } =
      this.undoStack[this.undoStack.length - 1] ?? {};

    return JSON.stringify(incomingData) === JSON.stringify(topOfStackData);
  }
}
