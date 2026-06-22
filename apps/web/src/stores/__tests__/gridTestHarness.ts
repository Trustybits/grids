import { vi } from "vitest";
import {
  ContentType,
  type Grid,
  type Tile,
  type TileContent,
} from "@grids/contracts/types";

type SnapshotLike = {
  tiles: Tile[];
  actionLabel: string;
  forcedBreakpoint: "lg" | "md" | "sm";
  [key: string]: unknown;
};

export interface MockUndoManager {
  undoStack: SnapshotLike[];
  redoStack: SnapshotLike[];
  pushSnapshot: ReturnType<typeof vi.fn>;
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  undoRedoUntil: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  replaceBlobUrl: ReturnType<typeof vi.fn>;
}

const gridHarness = vi.hoisted(() => {
  const gridService = {
    fetchGrid: vi.fn(),
    saveGrid: vi.fn(),
    updateGrid: vi.fn(),
    deleteGrid: vi.fn(),
    fetchGridsByUserId: vi.fn(),
    generateId: vi.fn(),
    createGrid: vi.fn(),
    duplicateGrid: vi.fn(),
    touchLastOpenedAt: vi.fn(),
    loadRecentGridIds: vi.fn(),
    saveRecentGridIds: vi.fn(),
    createGridWithStarterTiles: vi.fn(),
    cloneAndPersistGrid: vi.fn(),
    queueSave: vi.fn(),
  };

  return {
    events: [] as string[],
    gridService,
    analyticsService: {
      logEvent: vi.fn(),
    },
    authProvider: {
      getCurrentUserId: vi.fn(),
    },
    toastStore: {
      addToast: vi.fn(),
    },
    themeStore: {
      setTheme: vi.fn(),
    },
    getTileDefinition: vi.fn(),
    createTile: vi.fn(),
    adjustTilePosition: vi.fn(),
    findBestXAtRow: vi.fn(),
    findFirstAvailableSpot: vi.fn(),
    pushTilesForNewItem: vi.fn(),
    measureViewportGridRow: vi.fn<() => number | null>(),
    uuid: vi.fn(),
    undoManagers: [] as MockUndoManager[],
  };
});

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getGridService: () => gridHarness.gridService,
    getAnalyticsService: () => gridHarness.analyticsService,
  }),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => gridHarness.authProvider,
}));

vi.mock("uuid", () => ({
  v4: () => gridHarness.uuid(),
}));

vi.mock("@/utils/TileUtils", () => ({
  createTile: (
    type: ContentType,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    content: TileContent,
    caption: string,
  ) => gridHarness.createTile(type, id, x, y, w, h, content, caption),
}));

vi.mock("@/registries/tileRegistry", () => ({
  getTileDefinition: (type: ContentType) =>
    gridHarness.getTileDefinition(type),
}));

vi.mock("@/utils/GridPlacementUtils", () => ({
  adjustTilePosition: (...args: unknown[]) =>
    gridHarness.adjustTilePosition(...args),
  findBestXAtRow: (...args: unknown[]) =>
    gridHarness.findBestXAtRow(...args),
  findFirstAvailableSpot: (...args: unknown[]) =>
    gridHarness.findFirstAvailableSpot(...args),
  pushTilesForNewItem: (...args: unknown[]) =>
    gridHarness.pushTilesForNewItem(...args),
}));

vi.mock(
  "@/composables/useResponsiveGridLayout",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/composables/useResponsiveGridLayout")
      >();
    return {
      ...actual,
      measureViewportGridRow: () =>
        gridHarness.measureViewportGridRow() ??
        actual.measureViewportGridRow(),
    };
  },
);

vi.mock("@/stores/toast", () => ({
  useToastStore: () => gridHarness.toastStore,
}));

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => gridHarness.themeStore,
}));

vi.mock("@/undo/UndoRedoManager", () => ({
  UndoRedoManager: class {
    undoStack: SnapshotLike[] = [];
    redoStack: SnapshotLike[] = [];
    private onChanged?: () => void;

    pushSnapshot = vi.fn((snapshot: SnapshotLike) => {
      this.undoStack.push(structuredClone(snapshot));
      this.redoStack = [];
      this.onChanged?.();
    });

    undo = vi.fn((current: SnapshotLike) => {
      const snapshot = this.undoStack.pop() ?? null;
      if (!snapshot) return null;
      this.redoStack.push({
        ...structuredClone(current),
        actionLabel: snapshot.actionLabel,
      });
      this.onChanged?.();
      return structuredClone(snapshot);
    });

    redo = vi.fn((current: SnapshotLike) => {
      const snapshot = this.redoStack.pop() ?? null;
      if (!snapshot) return null;
      this.undoStack.push({
        ...structuredClone(current),
        actionLabel: snapshot.actionLabel,
      });
      this.onChanged?.();
      return structuredClone(snapshot);
    });

    undoRedoUntil = vi.fn(
      (snapshotId: number, current: SnapshotLike): SnapshotLike | null => {
        const undoIndex = snapshotId - 1;
        if (undoIndex < 0 || undoIndex >= this.undoStack.length) return null;
        let result = structuredClone(current);
        while (this.undoStack.length > undoIndex) {
          result = this.undo(result) ?? result;
        }
        return result;
      },
    );

    clear = vi.fn(() => {
      this.undoStack = [];
      this.redoStack = [];
      this.onChanged?.();
    });

    replaceBlobUrl = vi.fn(
      (tileId: string, permanentUrl: string, documentItemId?: string) => {
        for (const stack of [this.undoStack, this.redoStack]) {
          for (const snapshot of stack) {
            const tile = snapshot.tiles.find((candidate) => candidate.i === tileId);
            if (!tile) continue;
            if (
              documentItemId &&
              tile.content.type === ContentType.DOCUMENT
            ) {
              const content = tile.content as unknown as {
                items: Array<{ id: string; url: string }>;
              };
              const item = content.items.find(
                (candidate) => candidate.id === documentItemId,
              );
              if (item?.url.startsWith("blob:")) item.url = permanentUrl;
            } else if (
              !documentItemId &&
              "src" in tile.content &&
              typeof tile.content.src === "string" &&
              tile.content.src.startsWith("blob:")
            ) {
              tile.content.src = permanentUrl;
            }
          }
        }
      },
    );

    canUndo = () => this.undoStack.length > 0;
    canRedo = () => this.redoStack.length > 0;
    getLastActionLabel = () =>
      this.undoStack[this.undoStack.length - 1]?.actionLabel ?? null;
    getNextRedoActionLabel = () =>
      this.redoStack[this.redoStack.length - 1]?.actionLabel ?? null;
    getStacks = () => ({
      undoStack: this.undoStack.map((snapshot, index) => ({
        actionLabel: snapshot.actionLabel,
        timestamp: index + 1,
        snapshotId: index + 1,
      })),
      redoStack: this.redoStack.map((snapshot, index) => ({
        actionLabel: snapshot.actionLabel,
        timestamp: index + 1,
        snapshotId: index + 1,
      })),
    });

    constructor(onChanged?: () => void) {
      this.onChanged = onChanged;
      gridHarness.undoManagers.push(this as unknown as MockUndoManager);
    }
  },
}));

export function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: "",
    content: {
      type: ContentType.TEXT,
      text: "Hello",
      font: "Inter",
      fontSize: 16,
      isBold: false,
      isItalic: false,
      textType: "paragraph",
      color: "#000000",
    },
    ...overrides,
  } as Tile;
}

export function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Test Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    themeId: "theme-a",
    duplicatable: false,
    tiles: [makeTile()],
    overrides: {},
    ...overrides,
  };
}

export function resetGridHarness(): void {
  vi.clearAllMocks();
  gridHarness.events.length = 0;
  gridHarness.undoManagers.length = 0;

  gridHarness.authProvider.getCurrentUserId.mockReturnValue("user-1");
  gridHarness.uuid.mockReturnValue("generated-tile");
  gridHarness.getTileDefinition.mockReturnValue(undefined);
  gridHarness.findBestXAtRow.mockReturnValue({ x: 2, y: 4 });
  gridHarness.measureViewportGridRow.mockReturnValue(null);
  gridHarness.findFirstAvailableSpot.mockReturnValue({ x: 0, y: 0 });
  gridHarness.createTile.mockImplementation(
    (
      type: ContentType,
      id: string,
      x: number,
      y: number,
      w: number,
      h: number,
      content: TileContent,
      caption: string,
    ): Tile => ({
      i: id,
      x,
      y,
      w,
      h,
      borderEnabled: true,
      caption,
      content: { ...content, type },
    }),
  );

  for (const mock of Object.values(gridHarness.gridService)) {
    mock.mockReset();
  }
  gridHarness.gridService.fetchGridsByUserId.mockResolvedValue([]);
  gridHarness.gridService.fetchGrid.mockResolvedValue(makeGrid());
  gridHarness.gridService.createGridWithStarterTiles.mockResolvedValue(
    makeGrid({ id: "created-grid" }),
  );
  gridHarness.gridService.cloneAndPersistGrid.mockResolvedValue(
    makeGrid({ id: "cloned-grid" }),
  );
  gridHarness.gridService.loadRecentGridIds.mockResolvedValue([]);
  gridHarness.gridService.saveRecentGridIds.mockResolvedValue(undefined);
  gridHarness.gridService.touchLastOpenedAt.mockResolvedValue(undefined);
  gridHarness.gridService.queueSave.mockImplementation(async () => {
    gridHarness.events.push("save");
  });
  gridHarness.gridService.deleteGrid.mockResolvedValue(undefined);
  gridHarness.gridService.updateGrid.mockResolvedValue(undefined);

  gridHarness.analyticsService.logEvent.mockReset();
  gridHarness.analyticsService.logEvent.mockImplementation(async () => {
    gridHarness.events.push("analytics");
  });
}

export async function createGridStore() {
  const { createPinia, setActivePinia } = await import("pinia");
  setActivePinia(createPinia());
  const { useGridStore } = await import("@/stores/grid");
  return useGridStore();
}

export async function createLoadedGridStore(grid = makeGrid()) {
  gridHarness.gridService.fetchGrid.mockResolvedValueOnce(grid);
  const store = await createGridStore();
  await store.loadGrid(grid.id);
  gridHarness.gridService.queueSave.mockClear();
  gridHarness.analyticsService.logEvent.mockClear();
  gridHarness.events.length = 0;
  return store;
}

export { gridHarness };
