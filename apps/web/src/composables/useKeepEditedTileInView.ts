/**
 * Keeps the tile being edited on screen, in the clear space between the top
 * chrome (status banners, Multi edit pill, Undo circle) and whatever covers
 * the bottom (the toolbar and its dark band, a tool's card, All settings).
 *
 * On short phones that space is small, so:
 *  - the space is measured from the real chrome every time, never assumed;
 *  - a tile that fits is moved just enough to sit inside it; a taller one
 *    shows its top;
 *  - a tile near the end of the grid can't scroll high enough on its own, so
 *    a spacer is added below the page for as long as it is needed. When
 *    editing ends the page glides back before the spacer goes, so nothing
 *    jumps.
 *
 * It runs when what's open changes (a tile is picked, a card opens or swaps,
 * All settings grows, a mode starts) and when those surfaces change size —
 * never while the person is scrolling, so it doesn't fight them. Typing (the
 * browser keeps the caret in view) and Arrange (the person is placing the
 * tile) are left alone.
 *
 * Experimental (branch mobile-ui/10-keep-tile-visible). MobileGridBar turns
 * it on with one call.
 */

import { onBeforeUnmount, watch, type Ref } from "vue";
import type { MobileEditorView } from "@/utils/mobileEditorView";
import { getGridEngineBridge } from "@/composables/useGridEngineBridge";

/** Breathing room between the tile and the chrome around it. */
const GAP_PX = 12;
/** Ignore moves smaller than this — not worth a scroll. */
const MIN_SCROLL_PX = 4;
/** Let size changes (a morph, a card growing) settle before measuring. */
const SETTLE_MS = 90;

/** Chrome along the top while a tile is being edited. */
const TOP_CHROME = [
  ".app-status-banners",
  ".mobile-top-chrome--shown .mtc-pill:not(.mtc-pill--tucked)",
  ".mobile-top-chrome--shown .mtc-circle",
].join(", ");

/** What covers the bottom: the toolbar, its band and any card above it. */
const BOTTOM_CHROME = [".mgb-pill", ".mgb-popover"].join(", ");
/** The dark band behind the toolbar; its top fades in over this many px. */
const SCRIM = ".mgb-scrim";
const SCRIM_FADE_PX = 16;

/** The tile to keep in view, or null to leave the page alone. */
export function keptTileId(view: MobileEditorView): string | null {
  switch (view.kind) {
    case "tile":
    case "popover":
    case "sheet":
    case "mode":
      return view.tileId;
    // Multi-edit: the pick made last, while a card or the sheet is open.
    case "multi-popover":
    case "multi-sheet":
      return view.tileIds[view.tileIds.length - 1] ?? null;
    default:
      return null;
  }
}

export interface Band {
  top: number;
  bottom: number;
}

/**
 * How far to scroll (+ down, − up) so a tile spanning `tileTop`–`tileBottom`
 * sits inside `band`: the least move that fits it, or its top at the band's
 * top when it is taller than the band.
 */
export function scrollToFit(
  tileTop: number,
  tileBottom: number,
  band: Band,
): number {
  const room = band.bottom - band.top;
  if (tileBottom - tileTop > room) return tileTop - band.top;
  if (tileTop < band.top) return tileTop - band.top;
  if (tileBottom > band.bottom) return tileBottom - band.bottom;
  return 0;
}

const visibleRects = (selector: string): DOMRect[] =>
  Array.from(document.querySelectorAll<HTMLElement>(selector))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

/** The clear space on screen right now. */
function measureBand(): Band {
  const viewportHeight =
    window.visualViewport?.height ?? window.innerHeight;
  let top = 0;
  for (const rect of visibleRects(TOP_CHROME)) {
    // Only chrome actually along the top edge counts.
    if (rect.top < viewportHeight / 3) top = Math.max(top, rect.bottom);
  }
  let bottom = viewportHeight;
  for (const rect of visibleRects(BOTTOM_CHROME)) {
    if (rect.bottom > viewportHeight / 3) bottom = Math.min(bottom, rect.top);
  }
  for (const rect of visibleRects(SCRIM)) {
    bottom = Math.min(bottom, rect.top + SCRIM_FADE_PX);
  }
  return { top: top + GAP_PX, bottom: bottom - GAP_PX };
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useKeepEditedTileInView(options: {
  enabled: Readonly<Ref<boolean>>;
  view: Readonly<Ref<MobileEditorView>>;
}) {
  // ── Spacer below the page ─────────────────────────────────────────────────
  let spacer: HTMLElement | null = null;
  let spacerPx = 0;
  let releaseTimer = 0;

  const setSpacer = (px: number) => {
    spacerPx = Math.max(0, Math.ceil(px));
    if (spacerPx === 0) {
      spacer?.remove();
      spacer = null;
      return;
    }
    if (!spacer) {
      spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      spacer.dataset.mobileEditSpacer = "";
      document.body.appendChild(spacer);
    }
    spacer.style.height = `${spacerPx}px`;
  };

  const scrollBehavior = (): ScrollBehavior =>
    prefersReducedMotion() ? "auto" : "smooth";

  /** Glide back off the spacer, then drop it. */
  const releaseSpacer = () => {
    if (!spacerPx) return;
    const scroller = document.scrollingElement ?? document.documentElement;
    const contentEnd = scroller.scrollHeight - spacerPx;
    const overshoot = scroller.scrollTop + window.innerHeight - contentEnd;
    window.clearTimeout(releaseTimer);
    if (overshoot <= 0) {
      setSpacer(0);
      return;
    }
    window.scrollBy({ top: -overshoot, behavior: scrollBehavior() });
    // `scrollend` isn't everywhere; the glide is well under this.
    releaseTimer = window.setTimeout(() => setSpacer(0), 450);
  };

  // ── Keeping the tile in view ──────────────────────────────────────────────
  const reveal = () => {
    const tileId = options.enabled.value ? keptTileId(options.view.value) : null;
    if (!tileId) return;
    const rect = getGridEngineBridge()?.tileRect(tileId);
    if (!rect) return;
    const by = scrollToFit(rect.top, rect.top + rect.height, measureBand());
    if (Math.abs(by) < MIN_SCROLL_PX) return;

    const scroller = document.scrollingElement ?? document.documentElement;
    const target = scroller.scrollTop + by;
    const maxScroll =
      scroller.scrollHeight - spacerPx - window.innerHeight;
    // Room to scroll a tile near the end of the grid up above the bottom.
    window.clearTimeout(releaseTimer);
    setSpacer(Math.max(spacerPx, target - maxScroll));
    window.scrollTo({ top: Math.max(0, target), behavior: scrollBehavior() });
  };

  let settleTimer = 0;
  const scheduleReveal = () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(reveal, SETTLE_MS);
  };

  // The surfaces that cover the screen change size as they morph, as a card
  // swaps its body, as All settings grows, as the keyboard comes and goes.
  let surfaces: ResizeObserver | null = null;
  const observeSurfaces = () => {
    surfaces?.disconnect();
    if (typeof ResizeObserver === "undefined") return;
    surfaces = new ResizeObserver(scheduleReveal);
    for (const element of document.querySelectorAll<HTMLElement>(
      BOTTOM_CHROME,
    )) {
      surfaces.observe(element);
    }
  };

  const viewKey = (view: MobileEditorView) =>
    view.kind === "popover" || view.kind === "multi-popover"
      ? `${view.kind}:${keptTileId(view)}:${view.toolId}`
      : `${view.kind}:${keptTileId(view)}`;

  watch(
    () => (options.enabled.value ? viewKey(options.view.value) : "off"),
    () => {
      const tileId = options.enabled.value
        ? keptTileId(options.view.value)
        : null;
      if (!tileId) {
        window.clearTimeout(settleTimer);
        surfaces?.disconnect();
        surfaces = null;
        // Back to the grid (or typing / arranging): let the page settle.
        if (options.view.value.kind === "home" || !options.enabled.value) {
          releaseSpacer();
        }
        return;
      }
      // After the bars have rendered for the new state.
      requestAnimationFrame(() => {
        observeSurfaces();
        scheduleReveal();
      });
    },
    { flush: "post" },
  );

  const onViewportResize = () => {
    if (options.enabled.value && keptTileId(options.view.value)) {
      scheduleReveal();
    }
  };
  window.visualViewport?.addEventListener("resize", onViewportResize);

  onBeforeUnmount(() => {
    window.clearTimeout(settleTimer);
    window.clearTimeout(releaseTimer);
    surfaces?.disconnect();
    window.visualViewport?.removeEventListener("resize", onViewportResize);
    setSpacer(0);
  });
}
