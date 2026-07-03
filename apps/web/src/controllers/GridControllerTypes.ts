import type { AuthProvider } from "@grids/contracts/auth";
import type { Breakpoint } from "@grids/contracts/types";
import type { AnalyticsServiceInterface } from "@/services/interfaces/AnalyticsServiceInterface";
import type { ChatServiceInterface } from "@/services/interfaces/ChatServiceInterface";
import type { GridServiceInterface } from "@/services/interfaces/GridServiceInterface";
import type { GridPersistenceSchedulerInterface } from "@/services/interfaces/GridPersistenceSchedulerInterface";
import type { useGridCollectionStore } from "@/stores/grid/gridCollection";
import type { useGridHistoryStore } from "@/stores/grid/gridHistory";
import type { useGridSessionStore } from "@/stores/grid/gridSession";
import type { useGridUiStore } from "@/stores/grid/gridUi";
import type { useGridUploadsStore } from "@/stores/grid/gridUploads";
import type { useGridViewportStore } from "@/stores/grid/gridViewport";
import type { useThemeStore } from "@/stores/theme";
import type { useToastStore } from "@/stores/toast";
import type { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";

export interface GridControllerStores {
  collection: ReturnType<typeof useGridCollectionStore>;
  history: ReturnType<typeof useGridHistoryStore>;
  session: ReturnType<typeof useGridSessionStore>;
  ui: ReturnType<typeof useGridUiStore>;
  uploads: ReturnType<typeof useGridUploadsStore>;
  viewport: ReturnType<typeof useGridViewportStore>;
  theme: ReturnType<typeof useThemeStore>;
  toast: ReturnType<typeof useToastStore>;
}

export interface GridMetadataPreferences {
  showMetaData: boolean;
  showMetaDataVerbose: boolean;
}

export interface GridControllerDependencies {
  getGridService(): GridServiceInterface;
  persistenceScheduler: GridPersistenceSchedulerInterface;
  getAuthProvider(): AuthProvider;
  getAnalyticsService(): AnalyticsServiceInterface;
  getChatService(): ChatServiceInterface;
  generateUuid(): string;
  delay(milliseconds: number): Promise<void>;
  now(): Date;
  measureViewportGridRow(): number;
  readMetadataPreferences(): GridMetadataPreferences;
  getCookieValue(name: string): string | null;
  setCookieValue(name: string, value: string, days?: number): void;
  snapshotCodec: GridSnapshotCodec;
}

export interface GridLayoutReadinessAdapter {
  waitForLayoutReady(breakpoint: Breakpoint): Promise<void>;
}

export interface GridEditPermissionInput {
  isOwner: boolean;
  forcedBreakpoint: Breakpoint | null;
  viewportBreakpoint: Breakpoint;
}

export interface GridHistoryUrlMaps {
  resolvedUrls: Record<string, string>;
  resolvedDocumentItemUrls: Record<string, Record<string, string>>;
}

export const BREAKPOINT_HISTORY_TRANSITION_MS = 500;
