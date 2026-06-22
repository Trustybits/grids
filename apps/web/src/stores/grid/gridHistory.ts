import { computed, markRaw, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { UndoRedoManager } from "@/undo/UndoRedoManager";
import type { Snapshot } from "@/undo/UndoTypes";

export const useGridHistoryStore = defineStore("gridHistory", () => {
  const stackVersion = ref(0);

  const createManager = () =>
    markRaw(
      new UndoRedoManager(() => {
        stackVersion.value++;
      }),
    );

  const manager = shallowRef(createManager());
  const stableSnapshot = ref<Snapshot | null>(null);
  const pendingEditSnapshot = ref<Snapshot | null>(null);
  const pendingMoveSnapshot = ref<Snapshot | null>(null);
  const pendingResizeSnapshot = ref<Snapshot | null>(null);
  const editingTileId = ref<string | null>(null);

  const canUndo = computed(() => {
    void stackVersion.value;
    return manager.value.canUndo();
  });

  const canRedo = computed(() => {
    void stackVersion.value;
    return manager.value.canRedo();
  });

  const undoActionLabel = computed(() => {
    void stackVersion.value;
    return manager.value.getLastActionLabel();
  });

  const redoActionLabel = computed(() => {
    void stackVersion.value;
    return manager.value.getNextRedoActionLabel();
  });

  const undoRedoStacks = computed(() => {
    void stackVersion.value;
    return manager.value.getStacks();
  });

  function pushSnapshot(snapshot: Snapshot): void {
    manager.value.pushSnapshot(snapshot);
  }

  function undo(currentSnapshot: Snapshot): Snapshot | null {
    return manager.value.undo(currentSnapshot);
  }

  function redo(currentSnapshot: Snapshot): Snapshot | null {
    return manager.value.redo(currentSnapshot);
  }

  function undoRedoUntil(
    snapshotId: number,
    currentSnapshot: Snapshot,
  ): Snapshot | null {
    return manager.value.undoRedoUntil(snapshotId, currentSnapshot);
  }

  function replaceStackBlobUrl(
    tileId: string,
    permanentUrl: string,
    documentItemId?: string,
  ): void {
    manager.value.replaceBlobUrl(tileId, permanentUrl, documentItemId);
  }

  function setStableSnapshot(snapshot: Snapshot | null): void {
    stableSnapshot.value = snapshot;
  }

  function beginEdit(tileId: string, snapshot: Snapshot | null): void {
    if (editingTileId.value) return;
    editingTileId.value = tileId;
    pendingEditSnapshot.value = snapshot;
  }

  function clearEdit(): void {
    editingTileId.value = null;
    pendingEditSnapshot.value = null;
  }

  function setPendingMoveSnapshot(snapshot: Snapshot | null): void {
    pendingMoveSnapshot.value = snapshot;
  }

  function setPendingResizeSnapshot(snapshot: Snapshot | null): void {
    pendingResizeSnapshot.value = snapshot;
  }

  function clearTransactions(): void {
    clearEdit();
    pendingMoveSnapshot.value = null;
    pendingResizeSnapshot.value = null;
  }

  function reset(): void {
    manager.value = createManager();
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
    pushSnapshot,
    undo,
    redo,
    undoRedoUntil,
    replaceStackBlobUrl,
    setStableSnapshot,
    beginEdit,
    clearEdit,
    setPendingMoveSnapshot,
    setPendingResizeSnapshot,
    clearTransactions,
    reset,
  };
});
