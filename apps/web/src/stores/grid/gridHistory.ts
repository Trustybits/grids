import { computed, markRaw, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import { UndoRedoManager } from "@/undo/UndoRedoManager";
import type { Snapshot } from "@/undo/UndoTypes";

export const useGridHistoryStore = defineStore("gridHistory", () => {
  const stackVersion = ref(0);
  const snapshotCodec = new GridSnapshotCodec();

  const createManager = () =>
    markRaw(
      new UndoRedoManager(() => {
        stackVersion.value++;
      }),
    );

  const manager = shallowRef<UndoRedoManager | null>(null);
  const stableSnapshot = shallowRef<Snapshot | null>(null);
  const pendingEditSnapshot = shallowRef<Snapshot | null>(null);
  const pendingMoveSnapshot = shallowRef<Snapshot | null>(null);
  const pendingResizeSnapshot = shallowRef<Snapshot | null>(null);
  const editingTileId = ref<string | null>(null);

  const canUndo = computed(() => {
    void stackVersion.value;
    return manager.value?.canUndo() ?? false;
  });

  const canRedo = computed(() => {
    void stackVersion.value;
    return manager.value?.canRedo() ?? false;
  });

  const undoActionLabel = computed(() => {
    void stackVersion.value;
    return manager.value?.getLastActionLabel() ?? null;
  });

  const redoActionLabel = computed(() => {
    void stackVersion.value;
    return manager.value?.getNextRedoActionLabel() ?? null;
  });

  const undoRedoStacks = computed(() => {
    void stackVersion.value;
    return (
      manager.value?.getStacks() ?? { undoStack: [], redoStack: [] }
    );
  });

  function initializeManager(): void {
    reset();
    manager.value = createManager();
  }

  function pushSnapshot(snapshot: Snapshot): void {
    manager.value?.pushSnapshot(snapshot);
  }

  function undo(currentSnapshot: Snapshot): Snapshot | null {
    return manager.value?.undo(currentSnapshot) ?? null;
  }

  function redo(currentSnapshot: Snapshot): Snapshot | null {
    return manager.value?.redo(currentSnapshot) ?? null;
  }

  function undoRedoUntil(
    snapshotId: number,
    currentSnapshot: Snapshot,
  ): Snapshot | null {
    return (
      manager.value?.undoRedoUntil(snapshotId, currentSnapshot) ?? null
    );
  }

  function replaceBlobUrl(
    tileId: string,
    permanentUrl: string,
    documentItemId?: string,
  ): void {
    const replaceInSnapshot = (snapshot: Snapshot | null) => {
      if (documentItemId) {
        snapshotCodec.replaceBlobUrl(
          snapshot,
          tileId,
          permanentUrl,
          documentItemId,
        );
      } else {
        snapshotCodec.replaceBlobUrl(snapshot, tileId, permanentUrl);
      }
    };

    if (documentItemId) {
      manager.value?.replaceBlobUrl(
        tileId,
        permanentUrl,
        documentItemId,
      );
    } else {
      manager.value?.replaceBlobUrl(tileId, permanentUrl);
    }

    replaceInSnapshot(stableSnapshot.value);
    replaceInSnapshot(pendingEditSnapshot.value);
    replaceInSnapshot(pendingMoveSnapshot.value);
    replaceInSnapshot(pendingResizeSnapshot.value);
  }

  function setStableSnapshot(snapshot: Snapshot | null): void {
    stableSnapshot.value = snapshot;
  }

  function bumpVersion(): void {
    stackVersion.value++;
  }

  function beginEdit(
    tileId: string,
    snapshot: Snapshot | null,
  ): boolean {
    if (editingTileId.value) return false;
    editingTileId.value = tileId;
    pendingEditSnapshot.value = snapshot;
    return true;
  }

  function isEditing(tileId: string): boolean {
    return editingTileId.value === tileId;
  }

  function takeEditSnapshot(): Snapshot | null {
    const snapshot = pendingEditSnapshot.value;
    editingTileId.value = null;
    pendingEditSnapshot.value = null;
    return snapshot;
  }

  function beginMove(snapshot: Snapshot | null): boolean {
    if (pendingMoveSnapshot.value) return false;
    pendingMoveSnapshot.value = snapshot;
    return true;
  }

  function takeMoveSnapshot(): Snapshot | null {
    const snapshot = pendingMoveSnapshot.value;
    pendingMoveSnapshot.value = null;
    return snapshot;
  }

  function beginResize(snapshot: Snapshot | null): boolean {
    if (pendingResizeSnapshot.value) return false;
    pendingResizeSnapshot.value = snapshot;
    return true;
  }

  function takeResizeSnapshot(): Snapshot | null {
    const snapshot = pendingResizeSnapshot.value;
    pendingResizeSnapshot.value = null;
    return snapshot;
  }

  function clearTransactions(): void {
    editingTileId.value = null;
    pendingEditSnapshot.value = null;
    pendingMoveSnapshot.value = null;
    pendingResizeSnapshot.value = null;
  }

  function reset(): void {
    manager.value?.clear();
    manager.value = null;
    stackVersion.value = 0;
    stableSnapshot.value = null;
    clearTransactions();
  }

  return {
    manager,
    stackVersion,
    stableSnapshot,
    pendingEditSnapshot,
    pendingMoveSnapshot,
    pendingResizeSnapshot,
    editingTileId,
    canUndo,
    canRedo,
    undoActionLabel,
    redoActionLabel,
    undoRedoStacks,
    initializeManager,
    pushSnapshot,
    undo,
    redo,
    undoRedoUntil,
    replaceBlobUrl,
    setStableSnapshot,
    bumpVersion,
    beginEdit,
    isEditing,
    takeEditSnapshot,
    beginMove,
    takeMoveSnapshot,
    beginResize,
    takeResizeSnapshot,
    clearTransactions,
    reset,
  };
});
