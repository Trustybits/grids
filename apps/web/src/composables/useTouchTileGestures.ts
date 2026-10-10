/**
 * Hold to arrange — phone-home-screen move/resize for the floating toolbars.
 *
 *   1. Press a tile: after a moment it dips (pressing feedback).
 *   2. Keep holding: it lifts with a haptic tick and becomes the arranged
 *      tile (selected, 4 corner handles, quick menu). Keep the finger down
 *      and move to drag it straight away.
 *   3. While arranged: drag the body to move, drag a corner dot to resize from
 *      that corner (the other three fade). Taps and empty-space taps leave
 *      arrange through the tile / the editor lifecycle.
 *
 * Griddle does the actual arranging, unchanged. Its drag only arms from a
 * pointerdown on a tile whose caps say draggable, so a hold (a) makes the
 * tile the arranged one — which Grid.vue turns into draggable caps with four
 * resize handles — then (b) hands Griddle a pointerdown for the *same live
 * finger*. Griddle's threshold, capture, reflow, drop slot and settle
 * animation then run as for a mouse.
 *
 * The browser would turn the post-hold finger movement into a page scroll and
 * cancel the pointer, so a non-passive `touchmove` on the grid cancels
 * scrolling — only while a gesture is owned. Every other swipe scrolls.
 *
 * Ported from the `mobile-controls-try` experiment, extended to all four
 * corners and wired to the shared editor state.
 */

import { nextTick, onUnmounted, readonly, ref, watch, type Ref } from "vue";
import type { Corner } from "@griddle/core";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";

/** How long a finger must rest on a tile before it lifts. */
export const ARRANGE_HOLD_MS = 420;
/** Delay before the "being pressed" dip, so taps never flash it. */
const PRESS_FEEDBACK_MS = 200;
/** Travel allowed during the hold before it reads as a scroll. */
const PRESS_SLOP_PX = 10;
/** Swallow the click that trails a hold for this long. */
const CLICK_SUPPRESS_MS = 450;

/** The arranged tile resizes from every corner. */
export const ARRANGE_RESIZE_HANDLES: Corner[] = ["nw", "ne", "sw", "se"];

/** Marker on the quick menu, so presses on it never start a gesture. */
export const ARRANGE_MENU_ATTR = "data-arrange-menu";

/**
 * The size a corner drag is previewing, in cells — set by Grid.vue while a
 * resize runs, null otherwise. The toolbar header shows it live ("2×2" →
 * "4×2") before Griddle commits anything.
 */
export const arrangeLiveSize = ref<{ w: number; h: number } | null>(null);

type Press = {
  pointerId: number;
  tileId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** The hold completed, or the press began on the arranged tile. */
  owned: boolean;
  feedbackTimer: ReturnType<typeof setTimeout> | null;
  liftTimer: ReturnType<typeof setTimeout> | null;
};

export interface TouchTileGesturesOptions {
  /** Floating toolbars on + touch + owner editing. */
  active: Readonly<Ref<boolean>>;
  /** Element wrapping the Griddle grid (receives the gesture listeners). */
  rootRef: Readonly<Ref<HTMLElement | null>>;
  /** Whether Griddle currently sees `id` as draggable (caps settled). */
  isEngineDraggable: (id: string) => boolean;
}

function isFocusedEditable(target: HTMLElement): boolean {
  const editable = target.closest<HTMLElement>(
    'input, textarea, select, [contenteditable="true"]',
  );
  if (!editable) return false;
  const focused = document.activeElement;
  return !!focused && (focused === editable || editable.contains(focused));
}

function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Unsupported (iOS) or blocked — haptics are a nicety.
  }
}

export function useTouchTileGestures(options: TouchTileGesturesOptions) {
  const { active, rootRef, isEngineDraggable } = options;
  const ui = useGridUiStore();
  const controller = useGridController();

  /** The tile a finger is pressing (for the dip feedback). */
  const pressingId = ref<string | null>(null);
  /** The arranged tile is being dragged (lift look, quick menu hidden). */
  const lifted = ref(false);
  /** A corner of the arranged tile is being dragged. */
  const resizing = ref(false);

  let press: Press | null = null;
  let dispatchingHandOff = false;

  const arrangedId = () => ui.mobileArrangeTileId;

  // ── Press lifecycle ─────────────────────────────────────────────────────
  const clearTimers = (p: Press): void => {
    if (p.feedbackTimer) clearTimeout(p.feedbackTimer);
    if (p.liftTimer) clearTimeout(p.liftTimer);
    p.feedbackTimer = null;
    p.liftTimer = null;
  };

  const endPress = (): void => {
    if (press) clearTimers(press);
    press = null;
    pressingId.value = null;
    rootRef.value?.removeAttribute("data-arrange-corner");
    window.removeEventListener("pointermove", onPressMove, true);
    window.removeEventListener("pointerup", onPressUp, true);
    window.removeEventListener("pointercancel", onPressCancel, true);
  };

  const griddleTileElement = (id: string): HTMLElement | null =>
    rootRef.value?.querySelector<HTMLElement>(
      `[data-griddle-tile="${CSS.escape(id)}"]`,
    ) ?? null;

  /**
   * Give Griddle a pointerdown for the finger that is already down, on the
   * tile (or one of its handles) — what it would have received had the tile
   * been draggable when the finger landed.
   */
  const handOffToGriddle = (
    p: Press,
    target: HTMLElement | null = griddleTileElement(p.tileId),
  ): void => {
    if (!target) return;
    dispatchingHandOff = true;
    try {
      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: p.pointerId,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: p.x,
          clientY: p.y,
        }),
      );
    } finally {
      dispatchingHandOff = false;
    }
  };

  /**
   * The arranged tile's corner handle under the finger, nearest centre first:
   * on a small tile the four hit areas overlap, and a touch must never be
   * ambiguous. Matched by position, because the browser's touch adjustment
   * retargets fingertips to nearby tappable content instead.
   */
  const handleAt = (x: number, y: number): HTMLElement | null => {
    const id = arrangedId();
    if (!id) return null;
    const handles = griddleTileElement(id)?.querySelectorAll<HTMLElement>(
      "[data-griddle-handle]",
    );
    let nearest: HTMLElement | null = null;
    let nearestDistance = Infinity;
    handles?.forEach((handle) => {
      const rect = handle.getBoundingClientRect();
      const inside =
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (!inside) return;
      const distance = Math.hypot(
        x - (rect.left + rect.width / 2),
        y - (rect.top + rect.height / 2),
      );
      if (distance < nearestDistance) {
        nearest = handle;
        nearestDistance = distance;
      }
    });
    return nearest;
  };

  const lift = async (p: Press): Promise<void> => {
    if (press !== p) return;
    clearTimers(p);
    p.owned = true;
    pressingId.value = null;
    vibrate(12);

    // Arranging selects the tile; Grid.vue unlocks it through the caps.
    controller.setMobileArrangeTile(p.tileId);
    lifted.value = true;

    // Wait for the caps → engine sync so Griddle sees `draggable: true`.
    await nextTick();
    if (!isEngineDraggable(p.tileId)) await nextTick();
    if (press !== p || !isEngineDraggable(p.tileId)) return;
    handOffToGriddle(p);
  };

  // Window capture listeners run before Griddle's own window listeners.
  function onPressMove(event: PointerEvent): void {
    const p = press;
    if (!p || event.pointerId !== p.pointerId) return;
    p.x = event.clientX;
    p.y = event.clientY;
    if (p.owned) return;
    if (Math.hypot(p.x - p.startX, p.y - p.startY) > PRESS_SLOP_PX) {
      // Moved before the hold completed: a scroll, not a hold.
      endPress();
    }
  }

  function onPressUp(event: PointerEvent): void {
    const p = press;
    if (!p || event.pointerId !== p.pointerId) return;
    const wasLiftedByHold = p.owned && lifted.value;
    endPress();
    if (wasLiftedByHold) {
      // Released in place after the hold: stay arranged, menu shows.
      lifted.value = false;
      suppressNextClick();
    }
  }

  function onPressCancel(event: PointerEvent): void {
    const p = press;
    if (!p || event.pointerId !== p.pointerId) return;
    endPress();
    lifted.value = false;
  }

  /** The tap that ends a hold must not also tap something in the tile. */
  const suppressNextClick = (): void => {
    const swallow = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("click", swallow, true);
    setTimeout(
      () => window.removeEventListener("click", swallow, true),
      CLICK_SUPPRESS_MS,
    );
  };

  /** Call from the grid's capture-phase pointerdown. */
  const onPointerDown = (event: PointerEvent): void => {
    if (dispatchingHandOff) return;
    if (!active.value || event.pointerType !== "touch" || !event.isPrimary) {
      return;
    }
    // Multi-edit taps pick tiles; nothing is arranged there.
    if (ui.mobileMultiSelectIds) return;
    const target = event.target as HTMLElement | null;
    if (!target || target.closest(`[${ARRANGE_MENU_ATTR}]`)) return;

    const newPress = (id: string): Press => ({
      pointerId: event.pointerId,
      tileId: id,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      owned: false,
      feedbackTimer: null,
      liftTimer: null,
    });
    const track = (p: Press): void => {
      endPress();
      press = p;
      window.addEventListener("pointermove", onPressMove, true);
      window.addEventListener("pointerup", onPressUp, true);
      window.addEventListener("pointercancel", onPressCancel, true);
    };

    // A corner handle of the arranged tile: hand the finger to that handle.
    const handle = handleAt(event.clientX, event.clientY);
    const arranged = arrangedId();
    if (handle && arranged) {
      event.stopPropagation();
      const p = newPress(arranged);
      p.owned = true;
      track(p);
      // CSS hides the other three dots while this corner is dragged.
      rootRef.value?.setAttribute(
        "data-arrange-corner",
        handle.dataset.griddleHandle ?? "",
      );
      handOffToGriddle(p, handle);
      return;
    }

    const id = target.closest<HTMLElement>("[data-griddle-tile]")?.dataset
      .griddleTile;
    // Engine placeholders (the drag-to-add slot) start with `__`.
    if (!id || id.startsWith("__")) return;
    if (isFocusedEditable(target)) return;

    const p = newPress(id);
    track(p);

    if (arranged === id) {
      // The arranged tile is already unlocked, so Griddle armed a drag from
      // this very pointerdown: a move drags straight away, a tap is handled by
      // the tile (back to its toolbar). Griddle skips presses that land on a
      // link or button, so re-hand the pointer once this event has finished.
      p.owned = true;
      queueMicrotask(() => {
        if (press === p) handOffToGriddle(p);
      });
      return;
    }

    p.feedbackTimer = setTimeout(() => {
      if (press === p) pressingId.value = id;
    }, PRESS_FEEDBACK_MS);
    p.liftTimer = setTimeout(() => void lift(p), ARRANGE_HOLD_MS);
  };

  // ── Griddle gesture hooks (forwarded from Grid.vue) ─────────────────────
  const onDragStart = (id: string): void => {
    if (arrangedId() === id) lifted.value = true;
  };

  const onDragEnd = (id: string): void => {
    if (arrangedId() !== id) return;
    lifted.value = false;
    vibrate(6);
  };

  const onResizeStart = (id: string): void => {
    if (arrangedId() === id) resizing.value = true;
  };

  const onResizeEnd = (): void => {
    resizing.value = false;
  };

  // ── Grid-level listeners ────────────────────────────────────────────────
  // Cancel scrolling only while a gesture owns the finger. Registered
  // (non-passive) before any gesture: browsers decide at touchstart whether
  // touchmove may block scrolling.
  const onTouchMove = (event: TouchEvent): void => {
    if (press?.owned && event.cancelable) event.preventDefault();
  };

  // Android raises the long-press context menu (and link/image callouts)
  // around 500ms — right as the tile lifts. Capture phase, so it also beats
  // tiles with their own context menu (the Link tile's).
  const onContextMenu = (event: Event): void => {
    if (press || arrangedId()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  let boundRoot: HTMLElement | null = null;
  const bind = (root: HTMLElement | null): void => {
    if (boundRoot === root) return;
    if (boundRoot) {
      boundRoot.removeEventListener("touchmove", onTouchMove);
      boundRoot.removeEventListener("contextmenu", onContextMenu, true);
    }
    boundRoot = root;
    if (root) {
      root.addEventListener("touchmove", onTouchMove, { passive: false });
      root.addEventListener("contextmenu", onContextMenu, true);
    }
  };

  watch(
    [active, rootRef],
    ([isActive, root]) => {
      if (!isActive) {
        endPress();
        lifted.value = false;
      }
      bind(isActive ? root : null);
    },
    { immediate: true, flush: "post" },
  );

  // Leaving arrange from anywhere (a tap, a tool, Done) ends any lift state.
  watch(arrangedId, (id) => {
    if (!id) {
      lifted.value = false;
      resizing.value = false;
    }
  });

  onUnmounted(() => {
    endPress();
    bind(null);
  });

  return {
    pressingId: readonly(pressingId),
    lifted: readonly(lifted),
    resizing: readonly(resizing),
    onPointerDown,
    onDragStart,
    onDragEnd,
    onResizeStart,
    onResizeEnd,
  };
}
