import type { Breakpoint, Snapshot, BreakpointStacks } from './UndoTypes';

const MAX_STACK_SIZE = 20;
const BREAKPOINTS: Breakpoint[] = ['lg', 'md', 'sm'];

export class UndoRedoManager {
  private stacks: Record<Breakpoint, BreakpointStacks>;
  private onChanged: (() => void) | null;

  constructor(onChanged?: () => void) {
    this.onChanged = onChanged ?? null;
    this.stacks = UndoRedoManager.createEmptyStacks();
  }

  private static createEmptyStacks(): Record<Breakpoint, BreakpointStacks> {
    return {
      lg: { undoStack: [], redoStack: [] },
      md: { undoStack: [], redoStack: [] },
      sm: { undoStack: [], redoStack: [] },
    };
  }

  pushSnapshot(breakpoint: Breakpoint, snapshot: Snapshot): void {
    const { undoStack } = this.stacks[breakpoint];

    undoStack.push(snapshot);
    if (undoStack.length > MAX_STACK_SIZE) {
      undoStack.shift();
    }

    this.stacks[breakpoint].redoStack = [];
    this.onChanged?.();
  }

  undo(breakpoint: Breakpoint, currentSnapshot: Snapshot): Snapshot | null {
    const { undoStack, redoStack } = this.stacks[breakpoint];
    const snapshot = undoStack.pop();
    if (!snapshot) return null;

    redoStack.push({ ...currentSnapshot, actionLabel: snapshot.actionLabel });
    this.onChanged?.();
    return snapshot;
  }

  redo(breakpoint: Breakpoint, currentSnapshot: Snapshot): Snapshot | null {
    const { undoStack, redoStack } = this.stacks[breakpoint];
    const snapshot = redoStack.pop();
    if (!snapshot) return null;

    undoStack.push({ ...currentSnapshot, actionLabel: snapshot.actionLabel });
    this.onChanged?.();
    return snapshot;
  }

  canUndo(breakpoint: Breakpoint): boolean {
    return this.stacks[breakpoint].undoStack.length > 0;
  }

  canRedo(breakpoint: Breakpoint): boolean {
    return this.stacks[breakpoint].redoStack.length > 0;
  }

  clear(): void {
    for (const bp of BREAKPOINTS) {
      this.clearBreakpoint(bp);
    }
  }

  clearBreakpoint(breakpoint: Breakpoint): void {
    this.stacks[breakpoint].undoStack = [];
    this.stacks[breakpoint].redoStack = [];
    this.onChanged?.();
  }

  getLastActionLabel(breakpoint: Breakpoint): string | null {
    const { undoStack } = this.stacks[breakpoint];
    if (undoStack.length === 0) return null;
    return undoStack[undoStack.length - 1].actionLabel;
  }

  getNextRedoActionLabel(breakpoint: Breakpoint): string | null {
    const { redoStack } = this.stacks[breakpoint];
    if (redoStack.length === 0) return null;
    return redoStack[redoStack.length - 1].actionLabel;
  }
}
