import { getActivePinia, type Pinia } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { measureViewportGridRow } from "@/composables/useResponsiveGridLayout";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridHistoryStore } from "@/stores/grid/gridHistory";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridUploadsStore } from "@/stores/grid/gridUploads";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useThemeStore } from "@/stores/theme";
import { useToastStore } from "@/stores/toast";
import { GridSnapshotCodec } from "@/undo/GridSnapshotCodec";
import {
  GridController,
  type GridControllerDependencies,
} from "./GridController";

const controllerByPinia = new WeakMap<Pinia, GridController>();

function readCookie(name: string): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return cookie ? cookie.split("=")[1] : null;
}

export function createDefaultGridControllerDependencies(): GridControllerDependencies {
  return {
    getGridService: () => getServiceFactory().getGridService(),
    getAuthProvider: () => getAuthProvider(),
    getAnalyticsService: () =>
      getServiceFactory().getAnalyticsService(),
    generateUuid: () => uuidv4(),
    delay: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now: () => new Date(),
    measureViewportGridRow: () => measureViewportGridRow(),
    waitForLayoutReady: async () => undefined,
    readMetadataPreferences: () => ({
      showMetaData: readCookie("showMetaData") === "true",
      showMetaDataVerbose:
        readCookie("showMetaDataVerbose") === "true",
    }),
    snapshotCodec: new GridSnapshotCodec(),
  };
}

export function useGridController(pinia?: Pinia): GridController {
  const resolvedPinia = pinia ?? getActivePinia();
  if (!resolvedPinia) {
    throw new Error(
      "GridController requires an explicit or active Pinia instance.",
    );
  }

  const existing = controllerByPinia.get(resolvedPinia);
  if (existing) return existing;

  const controller = new GridController(
    {
      collection: useGridCollectionStore(resolvedPinia),
      history: useGridHistoryStore(resolvedPinia),
      session: useGridSessionStore(resolvedPinia),
      ui: useGridUiStore(resolvedPinia),
      uploads: useGridUploadsStore(resolvedPinia),
      viewport: useGridViewportStore(resolvedPinia),
      theme: useThemeStore(resolvedPinia),
      toast: useToastStore(resolvedPinia),
    },
    createDefaultGridControllerDependencies(),
  );
  controllerByPinia.set(resolvedPinia, controller);
  return controller;
}
