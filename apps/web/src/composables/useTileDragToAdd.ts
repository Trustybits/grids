import { onBeforeUnmount, reactive } from "vue";
import {
  getTileDropTarget,
  type ViewportRect,
} from "@/composables/useTileDropTarget";
import type { TilePlacement } from "@/types/GridLayout";

/**
 * The floating card of the Add-a-Tile drag: a tile type pulled up out of the
 * carousel, carried over the grid and dropped into a cell.
 *
 * While dragging, nothing about the card animates: it is pinned to the finger
 * at the point it was grabbed, and over the grid it takes the held cell's size
 * and radius outright. Motion only starts once it is let go — one loop then
 * eases the whole rect towards the held cell, or back to the carousel card
 * when abandoned, following that target if it moves mid-flight (the page
 * scrolling under a held cell).
 */

type Phase =
  /** Following the finger. */
  | "drag"
  /** Flying into, then sitting on, the held cell. */
  | "dock"
  /** Flying back to the carousel card, then gone. */
  | "return"
  /** Fading out where it is, then gone. */
  | "fade";

export interface TileDragGhost {
  visible: boolean;
  typeId: string;
  /** On the finger: drawn still, with no artwork loop. */
  carried: boolean;
  x: number;
  y: number;
  size: number;
  radius: number;
  opacity: number;
  /** Over a cell: drawn as the tile it is about to become. */
  overGrid: boolean;
}

export interface TileDragToAddOptions {
  /**
   * Viewport rect of the command bar under the grid. Letting go on it
   * abandons the drag, so the card has somewhere to be put back. Only the bar
   * itself — the grid either side of it, down to the window's bottom edge,
   * still takes a drop.
   */
  barRect: () => DOMRect | null;
}

/** Fraction of the remaining distance covered per 60fps frame when flying. */
const FLY = 0.3;
/** Within this many px of its target on every edge, a flight has arrived. */
const ARRIVED = 0.6;
/** Distance from a scroll edge (px) at which the page starts scrolling. */
const SCROLL_EDGE = 72;
/** Fastest auto-scroll, px per 60fps frame, reached at the very edge. */
const MAX_SCROLL_STEP = 16;
/** Opacity lost per 60fps frame while fading. */
const FADE_STEP = 0.12;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A tile's corner radius as rendered — the grid scales it with the mobile fit. */
const measureTileRadius = (): number | null => {
  const grid = document.querySelector<HTMLElement>(".grid-container");
  if (!grid?.offsetWidth) return null;
  const radius = parseFloat(
    getComputedStyle(grid).getPropertyValue("--tile-border-radius"),
  );
  return Number.isFinite(radius)
    ? radius * (grid.getBoundingClientRect().width / grid.offsetWidth)
    : null;
};

export const useTileDragToAdd = ({ barRect }: TileDragToAddOptions) => {
  const ghost = reactive<TileDragGhost>({
    visible: false,
    typeId: "",
    carried: false,
    x: 0,
    y: 0,
    size: 0,
    radius: 0,
    opacity: 1,
    overGrid: false,
  });

  let phase: Phase = "drag";
  /** Cell footprint the dropped tile will take. */
  let cells = { w: 2, h: 2 };
  /** Resting size and radius of the carousel card it was lifted from. */
  let cardSize = 0;
  let cardRadius = 0;
  let tileRadius: number | null = null;
  /** Where on the card the finger took hold, as fractions of its size. */
  let grab = { x: 0.5, y: 0.5 };
  let pointer = { x: 0, y: 0 };
  let bottomScrollArmed = false;
  let returnRect: (() => DOMRect | null) | null = null;
  let onArrive: (() => void) | null = null;
  let raf = 0;
  let lastFrame = 0;
  let reducedMotion = false;

  /** Advance `from` towards `to` by `rate` per 60fps frame, frame-rate independent. */
  const ease = (from: number, to: number, rate: number, frames: number) =>
    reducedMotion ? to : from + (to - from) * (1 - Math.pow(1 - rate, frames));

  const scrollEdges = (frames: number) => {
    const scroller = document.scrollingElement;
    if (!scroller) return;
    const bottomEdge = window.innerHeight;
    // A card is lifted from just above the bar, so the finger can start in
    // the bottom scroll zone. That zone only arms once the finger has risen
    // out of it — otherwise lifting a card would scroll the page away.
    if (pointer.y < bottomEdge - SCROLL_EDGE) bottomScrollArmed = true;
    let step = 0;
    if (pointer.y < SCROLL_EDGE) {
      step = -((SCROLL_EDGE - pointer.y) / SCROLL_EDGE);
    } else if (
      bottomScrollArmed &&
      pointer.y > bottomEdge - SCROLL_EDGE &&
      pointer.y < bottomEdge
    ) {
      step = (pointer.y - (bottomEdge - SCROLL_EDGE)) / SCROLL_EDGE;
    }
    if (step) scroller.scrollTop += step * MAX_SCROLL_STEP * frames;
  };

  /** Where the card should be this frame while it is on the finger. */
  const dragTarget = (): ViewportRect & { radius: number } => {
    const bar = barRect();
    const overBar =
      !!bar &&
      pointer.x >= bar.left &&
      pointer.x <= bar.right &&
      pointer.y >= bar.top &&
      pointer.y <= bar.bottom;
    // Probe the grid with the centre of the card as it is drawn over the grid
    // — at tile size, held at the grab point. Measuring from the carousel-size
    // card instead put the probe up to a quarter-tile off whenever the card
    // was not held dead centre, so the landing spot opened a cell away.
    const target = getTileDropTarget();
    const probeSize = target ? target.tileSize(cells) : cardSize;
    const probe = {
      x: pointer.x + (0.5 - grab.x) * probeSize,
      y: pointer.y + (0.5 - grab.y) * probeSize,
    };
    const slot = overBar || !target ? null : target.preview(probe, cells);
    ghost.overGrid = !!slot;
    if (slot && tileRadius === null) tileRadius = measureTileRadius();

    const size = slot ? slot.width : cardSize;
    return {
      left: pointer.x - grab.x * size,
      top: pointer.y - grab.y * size,
      width: size,
      height: size,
      radius: slot ? (tileRadius ?? cardRadius) : cardRadius,
    };
  };

  const frame = (now: number) => {
    const frames = Math.min(4, (now - lastFrame) / (1000 / 60) || 1);
    lastFrame = now;
    raf = 0;

    if (phase === "fade") {
      ghost.opacity = reducedMotion ? 0 : ghost.opacity - FADE_STEP * frames;
      if (ghost.opacity <= 0) {
        finish();
        return;
      }
      raf = requestAnimationFrame(frame);
      return;
    }

    if (phase === "drag") {
      scrollEdges(frames);
      const held = dragTarget();
      ghost.size = held.width;
      ghost.radius = held.radius;
      ghost.x = held.left;
      ghost.y = held.top;
      raf = requestAnimationFrame(frame);
      return;
    }

    let target: (ViewportRect & { radius: number }) | null = null;
    if (phase === "dock") {
      const slot = getTileDropTarget()?.slotRect();
      target = slot ? { ...slot, radius: tileRadius ?? cardRadius } : null;
    } else if (phase === "return") {
      const rect = returnRect?.();
      target = rect
        ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            radius: cardRadius,
          }
        : null;
    }

    if (target) {
      ghost.x = ease(ghost.x, target.left, FLY, frames);
      ghost.y = ease(ghost.y, target.top, FLY, frames);
      ghost.size = ease(ghost.size, target.width, FLY, frames);
      ghost.radius = ease(ghost.radius, target.radius, FLY, frames);
    }

    const arrived =
      !target ||
      (Math.abs(ghost.x - target.left) < ARRIVED &&
        Math.abs(ghost.y - target.top) < ARRIVED &&
        Math.abs(ghost.size - target.width) < ARRIVED);
    if (arrived && onArrive) {
      const callback = onArrive;
      onArrive = null;
      callback();
      if (!ghost.visible) return;
    }
    raf = requestAnimationFrame(frame);
  };

  const run = () => {
    if (raf) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const finish = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    onArrive = null;
    returnRect = null;
    ghost.visible = false;
    ghost.overGrid = false;
    ghost.opacity = 1;
  };

  /** Lift a card off the carousel. `rect` is the card as it sits in the fan. */
  const begin = (
    typeId: string,
    point: { x: number; y: number },
    rect: DOMRect,
    footprint: { w: number; h: number },
    radius: number,
    grabAt: { x: number; y: number },
  ) => {
    reducedMotion = prefersReducedMotion();
    phase = "drag";
    cells = footprint;
    cardSize = rect.width;
    cardRadius = radius;
    tileRadius = null;
    grab = { ...grabAt };
    pointer = { ...point };
    bottomScrollArmed = false;
    Object.assign(ghost, {
      visible: true,
      typeId,
      carried: true,
      x: point.x - grab.x * rect.width,
      y: point.y - grab.y * rect.width,
      size: rect.width,
      radius,
      opacity: 1,
      overGrid: false,
    });
    run();
  };

  const move = (point: { x: number; y: number }) => {
    pointer = { ...point };
    // Placed straight away rather than on the next frame, so the card never
    // sits a frame behind the finger.
    if (phase === "drag" && ghost.visible) {
      ghost.x = pointer.x - grab.x * ghost.size;
      ghost.y = pointer.y - grab.y * ghost.size;
    }
  };

  /**
   * Let go. Pins the cell under the card and returns where the tile goes, or
   * null when it was not over the grid. `hadTarget` is false when there is no
   * grid to drop onto at all (an empty grid renders none).
   */
  const drop = (): { placement: TilePlacement | null; hadTarget: boolean } => {
    const target = getTileDropTarget();
    if (!target) return { placement: null, hadTarget: false };
    // Resolve the cell from the final pointer position, not the last frame.
    if (phase === "drag") dragTarget();
    const placement = ghost.overGrid ? target.hold() : null;
    if (!placement) target.release();
    return { placement, hadTarget: true };
  };

  /** Settle into the held cell, then stay on it; `arrived` fires on landing. */
  const dock = (arrived?: () => void) => {
    phase = "dock";
    ghost.carried = false;
    onArrive = arrived ?? null;
    run();
  };

  /** Fly back into the carousel card and disappear there. */
  const returnHome = (rect: () => DOMRect | null, arrived?: () => void) => {
    phase = "return";
    ghost.carried = false;
    returnRect = rect;
    getTileDropTarget()?.release();
    onArrive = () => {
      finish();
      arrived?.();
    };
    run();
  };

  /** Fade out where it is — the tile it became is now on the grid. */
  const dismiss = () => {
    if (!ghost.visible) return;
    phase = "fade";
    ghost.carried = false;
    run();
  };

  onBeforeUnmount(finish);

  return { ghost, begin, move, drop, dock, returnHome, dismiss };
};
