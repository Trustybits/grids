/**
 * The phone editor's housekeeping, mounted once with the floating chrome:
 *
 *  1. Empty-space taps peel one layer — popover, sheet, arrange, then the
 *     selection itself. Scrolls never count: a tap is a quick, still touch,
 *     and one that only stops a momentum scroll is ignored. Taps on tiles
 *     (they select themselves), on our bars and on overlays are never
 *     "outside".
 *  2. State that points at tiles that are gone (deleted, undone, resynced) is
 *     pruned, so nothing can stay selected off screen.
 *  3. Entering Preview clears everything.
 *  4. The blur behind the edited tile falls back to dim-only on phones that
 *     ask for less (reduced motion / transparency), report little memory, or
 *     visibly drop frames once it is on.
 */

import { onBeforeUnmount, onMounted, watch, type Ref } from "vue";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridController } from "@/controllers/useGridController";
import { useGridPreview } from "@/composables/useGridPreview";
import {
  stopTileTyping,
  useMobileTileEdit,
} from "@/composables/useMobileTileEdit";
import type { MobileEditorView } from "@/utils/mobileEditorView";

const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 420;
/** A touch that lands this soon after a scroll is stopping momentum. */
const MOMENTUM_STOP_MS = 120;

/** Never "outside": tiles, our chrome, and overlays above the grid. */
const NOT_OUTSIDE = [
  "[data-griddle-tile]",
  "[data-tile-edit-surface]",
  ".mobile-grid-bar",
  ".mobile-top-chrome",
  ".mobile-app-bar",
  ".mmd-backdrop",
  ".modal-overlay",
  ".toast-container",
  ".rt-docked-bar",
  "[data-widget-controls-menu]",
  '[role="dialog"]',
].join(", ");

const NO_BLUR_CLASS = "no-focus-blur";
/** Average frame time (ms) above which the blur is dropped (~40fps). */
const SLOW_FRAME_MS = 25;
const PROBE_FRAMES = 30;

export function useMobileEditorLifecycle(view: Readonly<Ref<MobileEditorView>>) {
  const ui = useGridUiStore();
  const session = useGridSessionStore();
  const controller = useGridController();
  const { isPreviewActive } = useGridPreview();
  const { handle } = useMobileTileEdit();

  // ── 1. Peel on empty-space taps ──────────────────────────────────────────
  const peel = () => {
    if (ui.mobileOpenToolId) return controller.setMobileOpenTool(null);
    if (ui.mobileSheetExpanded) return controller.setMobileSheetExpanded(false);
    if (ui.mobileArrangeTileId) return controller.finishMobileArrange();
    // Multi-edit keeps its picks; it ends with its ✕ so nothing is lost by
    // accident.
    if (ui.mobileMultiSelectIds) return;
    // A tool mode is a layer of its own: the tap ends it, the tile stays.
    if (view.value.kind === "mode") return handle.value?.exitToolMode?.();
    // So is typing: the tap stops it (each tile's exit is idempotent, so its
    // own outside handling may run too) and the tile stays selected.
    if (view.value.kind === "typing") return stopTileTyping(handle.value);
    controller.clearMobileEditor();
  };

  let start: { x: number; y: number; at: number; outside: boolean } | null =
    null;
  let lastScrollAt = 0;

  const onScroll = () => {
    lastScrollAt = performance.now();
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch || event.touches.length > 1) {
      start = null;
      return;
    }
    const target = event.target as Element | null;
    const stoppingMomentum =
      performance.now() - lastScrollAt < MOMENTUM_STOP_MS;
    start = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now(),
      outside: !stoppingMomentum && !target?.closest(NOT_OUTSIDE),
    };
  };

  const onTouchEnd = (event: TouchEvent) => {
    const began = start;
    start = null;
    if (!began?.outside || view.value.kind === "home") return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const moved = Math.hypot(touch.clientX - began.x, touch.clientY - began.y);
    if (moved > TAP_SLOP_PX) return;
    if (performance.now() - began.at > TAP_MAX_MS) return;
    peel();
  };

  // A mouse click on empty space peels the same way (a narrow desktop window
  // gets the phone editor too). Mouse only: touches already went through above.
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const target = event.target as Element | null;
    start = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      outside: !target?.closest(NOT_OUTSIDE),
    };
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const began = start;
    start = null;
    if (!began?.outside || view.value.kind === "home") return;
    const moved = Math.hypot(event.clientX - began.x, event.clientY - began.y);
    if (moved > TAP_SLOP_PX) return;
    peel();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && view.value.kind !== "home") peel();
  };

  // ── 2. Prune state for tiles that are gone ───────────────────────────────
  watch(
    () => session.currentGrid?.tiles.map((tile) => tile.i).join("|") ?? "",
    () => {
      const ids = new Set(session.currentGrid?.tiles.map((tile) => tile.i));
      controller.pruneMobileEditor(ids);
    },
  );

  // ── 3. Preview clears everything ─────────────────────────────────────────
  watch(isPreviewActive, (previewing) => {
    if (previewing) controller.clearMobileEditor();
  });

  // ── 4. Blur budget ───────────────────────────────────────────────────────
  const root = () => document.documentElement;
  const dropBlur = () => root().classList.add(NO_BLUR_CLASS);

  const asksForLess = () => {
    const query = (q: string) =>
      typeof window !== "undefined" && !!window.matchMedia?.(q).matches;
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    return (
      query("(prefers-reduced-motion: reduce)") ||
      query("(prefers-reduced-transparency: reduce)") ||
      (typeof memory === "number" && memory <= 4)
    );
  };

  let probed = false;
  /** Time the first frames after the blur turns on; drop it if they lag. */
  const probeFrames = () => {
    if (probed || root().classList.contains(NO_BLUR_CLASS)) return;
    probed = true;
    let frames = 0;
    let first = 0;
    const tick = (now: number) => {
      if (frames === 0) first = now;
      frames += 1;
      if (frames <= PROBE_FRAMES) {
        requestAnimationFrame(tick);
        return;
      }
      const average = (now - first) / PROBE_FRAMES;
      if (average > SLOW_FRAME_MS) dropBlur();
    };
    requestAnimationFrame(tick);
  };

  watch(
    () => view.value.kind,
    (kind) => {
      if (kind !== "home" && kind !== "arrange") probeFrames();
    },
  );

  onMounted(() => {
    if (asksForLess()) dropBlur();
    document.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchend", onTouchEnd, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("keydown", onKeydown);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("touchstart", onTouchStart, true);
    document.removeEventListener("touchend", onTouchEnd, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("keydown", onKeydown);
  });

  return { peel };
}
