import { vi } from "vitest";
import {
  createPinia,
  setActivePinia,
  type Pinia,
} from "pinia";
import type { AuthProvider } from "@grids/contracts/auth";
import {
  ContentType,
  type Grid,
  type ImageContent,
  type LinkContent,
  type DocumentsContent,
  type Tile,
} from "@grids/contracts/types";
import type { AnalyticsServiceInterface } from "@/services/interfaces/AnalyticsServiceInterface";
import type { ChatServiceInterface } from "@/services/interfaces/ChatServiceInterface";
import type { GridServiceInterface } from "@/services/interfaces/GridServiceInterface";
import type { GridPersistenceSchedulerInterface } from "@/services/interfaces/GridPersistenceSchedulerInterface";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import type { Snapshot } from "@/undo/UndoTypes";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridUploadsStore } from "@/stores/grid/gridUploads";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useThemeStore } from "@/stores/theme";
import { useToastStore } from "@/stores/toast";
import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../../GridControllerTypes";

/**
 * Shared fixtures and a fresh-Pinia harness for the internal grid controllers.
 *
 * The internal controllers are state machines over the focused grid stores, so
 * — matching the existing GridController suite — these tests run against real
 * Pinia stores and mock only the injected service/auth/scheduler boundary and
 * the collaborator callbacks each controller is wired with.
 */

export function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    themeId: "theme-a",
    tiles: [],
    overrides: {},
    ...overrides,
  };
}

export function makeImageTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    content: {
      type: ContentType.IMAGE,
      src: "blob:media",
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    } as ImageContent,
    ...overrides,
  };
}

export function makeLinkTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-link",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    content: {
      type: ContentType.LINK,
      link: "https://example.com",
    } as LinkContent,
    ...overrides,
  };
}

export function makeDocumentTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-doc",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    content: {
      type: ContentType.DOCUMENT,
      items: [
        { id: "item-1", fileName: "a.pdf", url: "blob:doc-1" },
      ],
    } as DocumentsContent,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<Snapshot> = {},
): Snapshot {
  return {
    tiles: [],
    overrides: {},
    verticalCompact: true,
    themeId: "theme-a",
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    forcedBreakpoint: "lg",
    actionLabel: "",
    ...overrides,
  };
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function createStores(pinia: Pinia): GridControllerStores {
  return {
    collection: useGridCollectionStore(pinia),
    history: useGridHistoryStore(pinia),
    session: useGridSessionStore(pinia),
    ui: useGridUiStore(pinia),
    uploads: useGridUploadsStore(pinia),
    viewport: useGridViewportStore(pinia),
    theme: useThemeStore(pinia),
    toast: useToastStore(pinia),
  };
}

export function createGridServiceMock(): GridServiceInterface {
  return {
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
  };
}

export interface InternalHarness {
  pinia: Pinia;
  stores: GridControllerStores;
  gridService: GridServiceInterface;
  analyticsService: AnalyticsServiceInterface;
  logEvent: ReturnType<typeof vi.fn>;
  persistenceScheduler: GridPersistenceSchedulerInterface;
  authProvider: AuthProvider;
  getCurrentUserId: ReturnType<typeof vi.fn>;
  chatService: ChatServiceInterface;
  deleteAllMessages: ReturnType<typeof vi.fn>;
  dependencies: GridControllerDependencies;
}

export function createHarness(): InternalHarness {
  const pinia = createPinia();
  setActivePinia(pinia);
  const stores = createStores(pinia);
  const gridService = createGridServiceMock();

  const logEvent = vi.fn(async () => undefined);
  const analyticsService = {
    logEvent,
  } as unknown as AnalyticsServiceInterface;

  const getCurrentUserId = vi.fn<() => string | null>(() => "user-1");
  const authProvider = {
    getCurrentUserId,
  } as unknown as AuthProvider;

  const persistenceScheduler: GridPersistenceSchedulerInterface = {
    schedule: vi.fn(),
    flush: vi.fn(async () => null),
  };

  const deleteAllMessages = vi.fn(async () => undefined);
  const chatService = {
    deleteAllMessages,
  } as unknown as ChatServiceInterface;

  const dependencies: GridControllerDependencies = {
    getGridService: vi.fn(() => gridService),
    persistenceScheduler,
    getAuthProvider: vi.fn(() => authProvider),
    getAnalyticsService: vi.fn(() => analyticsService),
    getChatService: vi.fn(() => chatService),
    generateUuid: vi.fn(() => "uuid"),
    delay: vi.fn(async () => undefined),
    now: vi.fn(() => new Date("2026-06-22T12:00:00Z")),
    measureViewportGridRow: vi.fn(() => 0),
    readMetadataPreferences: vi.fn(() => ({
      showMetaData: true,
      showMetaDataVerbose: false,
    })),
    getCookieValue: vi.fn(() => null),
    setCookieValue: vi.fn(),
    snapshotCodec: new GridSnapshotCodec(),
  };

  return {
    pinia,
    stores,
    gridService,
    analyticsService,
    logEvent,
    persistenceScheduler,
    authProvider,
    getCurrentUserId,
    chatService,
    deleteAllMessages,
    dependencies,
  };
}
