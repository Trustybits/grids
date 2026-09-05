import { onBeforeUnmount, onMounted } from "vue";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import type { AnalyticsServiceInterface } from "@/services/interfaces/AnalyticsServiceInterface";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { AnalyticsEventType } from "@grids/contracts/types";

/**
 * Tracks an in-progress grid view. One per active session — when the user
 * navigates between grids or backgrounds the tab, the previous session is
 * ended and a new one starts on resume.
 *
 * Only created for non-owner viewers. Owner sessions never produce a view
 * session, and therefore never produce a `GRID_VIEW_END` event either.
 */
interface ActiveSession {
  gridId: string;
  sessionId: string;
  /** `performance.now()` timestamp at session start. */
  startedAt: number;
}

const FINGERPRINT_STORAGE_KEY = "grids:analytics:viewerFingerprint";

let activeVisibilityHandler: (() => void) | null = null;
let activePageHideHandler: (() => void) | null = null;

/**
 * Generates or retrieves the persistent viewer fingerprint. Stored in
 * localStorage so the same anonymous visitor is recognised across page
 * loads. This is approximate — clearing storage / using a different browser
 * resets it — but sufficient for the "how many different people saw my grid"
 * use case (see metrics_notes §5).
 */
function getOrCreateViewerFingerprint(): string {
  if (typeof window === "undefined") return "ssr-fingerprint";
  try {
    const existing = window.localStorage.getItem(FINGERPRINT_STORAGE_KEY);
    if (existing) return existing;
    const fingerprint = generateRandomId();
    window.localStorage.setItem(FINGERPRINT_STORAGE_KEY, fingerprint);
    return fingerprint;
  } catch {
    // localStorage may be unavailable (private mode, disabled, etc.) — fall
    // back to a per-session id so the event still has a value, even if it
    // won't dedupe across reloads.
    return generateRandomId();
  }
}

function generateRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Frontend integration point for analytics. Provides:
 *
 * - `trackGridEnter(gridId)` — call once after the grid loads. The
 *   composable reads ownership from the grid store and routes to the right
 *   event: owners get a single `OWNER_GRID_ENTER` log, non-owners start a
 *   view session that emits `GRID_VIEW` immediately and `GRID_VIEW_END` on
 *   tab background / unmount. Owners never produce view-session events.
 *
 * Tile add/remove events are emitted from the grid store at the mutation
 * site, not from this composable.
 *
 * The composable owns the `visibilitychange` listener and the unmount hook
 * for the active view session — consumers don't need to wire those manually.
 *
 * Transport per session-end path:
 * - `visibilitychange → hidden` and `pagehide`: `navigator.sendBeacon` to a
 *   Cloud Function endpoint, since a Firestore client write may not complete
 *   during page teardown. The CF dedupes by `sessionId`.
 * - `onBeforeUnmount` (SPA navigation, page is alive): regular Firestore
 *   write via `analyticsService.logEvent`.
 *
 * Each path clears the active session locally, so duplicate fires are no-ops
 * client-side. See §6 of metrics_notes.md.
 */
export function useAnalytics() {
  let analyticsService: AnalyticsServiceInterface | null = null;
  try {
    analyticsService = getServiceFactory().getAnalyticsService() ?? null;
  } catch {
    analyticsService = null;
  }

  const sessionStore = useGridSessionStore();
  let activeSession: ActiveSession | null = null;
  let lastViewerGridId: string | null = null;

  function logEvent(
    event: Parameters<NonNullable<typeof analyticsService>["logEvent"]>[0],
  ): void {
    void analyticsService?.logEvent(event).catch(() => undefined);
  }

  function logOwnerEnter(gridId: string): void {
    logEvent({
      eventType: AnalyticsEventType.OWNER_GRID_ENTER,
      userId: getAuthProvider().getCurrentUserId(),
      gridId,
      metadata: {},
    });
  }

  function startSession(gridId: string): void {
    const sessionId = generateRandomId();
    const viewerFingerprint = getOrCreateViewerFingerprint();
    const userId = getAuthProvider().getCurrentUserId();
    const viewerType = userId ? "authenticated" : "anonymous";

    activeSession = {
      gridId,
      sessionId,
      startedAt: performance.now(),
    };

    logEvent({
      eventType: AnalyticsEventType.GRID_VIEW,
      userId,
      gridId,
      metadata: { viewerType, sessionId, viewerFingerprint },
    });
  }

  function endSession(useBeacon = false): void {
    if (!activeSession) return;
    const { gridId, sessionId, startedAt } = activeSession;
    const durationMs = Math.round(performance.now() - startedAt);
    activeSession = null;

    if (durationMs <= 0) return;

    const event = {
      eventType: AnalyticsEventType.GRID_VIEW_END as const,
      userId: getAuthProvider().getCurrentUserId(),
      gridId,
      metadata: { sessionId, durationMs },
    };

    if (useBeacon) {
      analyticsService?.logGridViewEndEventBeacon(event);
      return;
    }

    logEvent(event);
  }

  /**
   * Call once from the page after the grid has finished loading. Routes to
   * `OWNER_GRID_ENTER` or `GRID_VIEW` based on ownership pulled from the
   * grid store. Safe to call multiple times — same `gridId` in the same
   * instance is deduped; a different `gridId` ends any prior view session
   * and starts a new one.
   */
  function trackGridEnter(gridId: string): void {
    // Defense-in-depth: contract is "call after the grid loads", but if the
    // store hasn't caught up (or the gridId doesn't match the loaded one)
    // we skip rather than guess at ownership and emit a misattributed event.
    //
    // Compare against the PUBLIC id: when an owner edits a published grid,
    // `currentGrid` is the hidden `draft__…` doc while callers (and analytics)
    // address the grid by its original id.
    const loaded = sessionStore.currentGrid;
    const loadedPublicId = loaded ? sessionStore.publicGridId : null;
    if (!loaded || loadedPublicId !== gridId) {
      console.warn(
        "useAnalytics.trackGridEnter called before grid store is ready — skipping",
        { requested: gridId, loaded: loadedPublicId },
      );
      return;
    }

    if (sessionStore.isOwner) {
      // Owner branch: a single OWNER_GRID_ENTER, no view session. End any
      // prior viewer session in case the user just navigated from a grid
      // they didn't own to one they do.
      if (activeSession) endSession();
      lastViewerGridId = null;
      logOwnerEnter(gridId);
      return;
    }

    // Viewer branch.
    if (activeSession && activeSession.gridId === gridId) return;
    if (activeSession) endSession();
    lastViewerGridId = gridId;
    startSession(gridId);
  }

  // ── Lifecycle: split sessions on tab background, flush on unmount ────
  // These only do anything when there's an active session, so owners (who
  // never start one) are exempt automatically.

  function handleVisibilityChange(): void {
    if (typeof document === "undefined") return;
    if (activeVisibilityHandler !== handleVisibilityChange) return;

    if (document.visibilityState === "hidden") {
      // Beacon path: tab may be backgrounding or actually unloading. We can't
      // tell from here, and a Firestore write isn't reliable during teardown
      // on mobile/bfcache, so always send via beacon. The CF idempotency
      // marker dedupes if pagehide later sends a duplicate for this session.
      endSession(true);
      return;
    }

    if (document.visibilityState !== "visible" || activeSession) return;

    if (
      lastViewerGridId &&
      sessionStore.currentGrid &&
      sessionStore.publicGridId === lastViewerGridId &&
      !sessionStore.isOwner
    ) {
      startSession(lastViewerGridId);
    }
  }

  function handlePageHide(): void {
    // Backstop for the unload path — fires reliably on tab close / hard nav
    // where `onBeforeUnmount` may not, and is the recommended page-lifecycle
    // signal for terminating sessions.
    if (activePageHideHandler !== handlePageHide) return;
    endSession(true);
  }

  onMounted(() => {
    if (typeof document !== "undefined") {
      activeVisibilityHandler = handleVisibilityChange;
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      activePageHideHandler = handlePageHide;
      window.addEventListener("pagehide", handlePageHide);
    }
  });

  onBeforeUnmount(() => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", handlePageHide);
    }
    if (activeVisibilityHandler === handleVisibilityChange) {
      activeVisibilityHandler = null;
    }
    if (activePageHideHandler === handlePageHide) {
      activePageHideHandler = null;
    }
    // SPA navigation case — page is alive, regular Firestore write is fine.
    endSession(false);
  });

  return {
    trackGridEnter,
  };
}
