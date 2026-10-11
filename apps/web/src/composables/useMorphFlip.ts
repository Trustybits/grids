/**
 * Morph one element between two layouts (FLIP) instead of swapping it.
 *
 * Call `morph(change)` around anything that changes the element's content:
 * it measures the box before, lets `change` run and the DOM settle, measures
 * after, then animates width and height (and corner radius, when it differs)
 * from the old box to the new one. The element never unmounts, so a bar
 * reads as one surface growing into the next — the home pill into a tile
 * toolbar, a toolbar into the format bar.
 *
 * Options for the floating phone toolbars:
 *  - `spring`: a gentle spring (≈5% overshoot) instead of the snappy curve,
 *    never growing wider than the screen less a small margin;
 *  - `crossfade`: the old content fades out (80ms) where it was while the
 *    new content fades in (120ms) — a copy of the old content stands in for
 *    it, so taps always reach the new content.
 *
 * Generalises `MobileGridBar`'s earlier width-only pill morph. With
 * `prefers-reduced-motion` the box doesn't animate; a cross-fade still plays
 * when asked for, as a plain fade.
 */

import { nextTick, type Ref } from "vue";

export interface MorphOptions {
  /** CSS duration; defaults to the snappy morph token. */
  duration?: string;
  /** CSS easing; defaults to the snappy morph token. */
  easing?: string;
  /** Spring the size change (overrides `duration` / `easing`). */
  spring?: boolean;
  /** Fade the old content out and the new content in. */
  crossfade?: boolean;
}

/** A damped spring (ζ 0.7) sampled for `linear()`: peaks ~4.6% past. */
const SPRING_EASING =
  "linear(0, 0.051, 0.171, 0.323, 0.48, 0.626, 0.751, 0.851, 0.927, 0.98, " +
  "1.015, 1.035, 1.044, 1.046, 1.042, 1.036, 1.029, 1.022, 1.015, 1.01, " +
  "1.006, 1.003, 1, 0.999, 1)";
const SPRING_DURATION = "320ms";
/** A springing surface may overshoot to within this of the screen edges. */
const EDGE_MARGIN_PX = 4;

const FADE_OUT_MS = 80;
const FADE_IN_MS = 120;
const FADE_IN_DELAY_MS = 40;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let springSupported: boolean | null = null;
const supportsSpring = (): boolean => {
  if (springSupported === null) {
    springSupported =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("transition-timing-function", "linear(0, 1)");
  }
  return springSupported;
};

/** Where an edge of the old box sat, so its copy stays put as the box moves. */
interface Snapshot {
  ghost: HTMLElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * A copy of the element's content as it is now, ready to stand in for the
 * old content while it fades out. Nothing in it can be focused or tapped.
 */
function snapshotContent(el: HTMLElement, box: DOMRect): Snapshot | null {
  const content = el.firstElementChild as HTMLElement | null;
  if (!content) return null;
  const rect = content.getBoundingClientRect();
  const ghost = content.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("id");
  for (const node of ghost.querySelectorAll("[id]")) node.removeAttribute("id");
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.dataset.morphGhost = "";
  Object.assign(ghost.style, {
    position: "absolute",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "1",
  });
  // Offsets from the padding box, which absolute positioning measures from.
  const borderX = el.clientLeft;
  const borderY = el.clientTop;
  return {
    ghost,
    left: rect.left - box.left - borderX,
    right: box.right - rect.right - borderX,
    top: rect.top - box.top - borderY,
    bottom: box.bottom - rect.bottom - borderY,
  };
}

/** Pin the copy to whichever edges of the box hold still during the morph. */
function placeGhost(snap: Snapshot, start: DOMRect, end: DOMRect) {
  const { ghost } = snap;
  const still = (a: number, b: number) => Math.abs(a - b) < 1;
  if (still(start.left, end.left)) ghost.style.left = `${snap.left}px`;
  else if (still(start.right, end.right)) ghost.style.right = `${snap.right}px`;
  else {
    ghost.style.left = "50%";
    ghost.style.marginLeft = `${(snap.left - snap.right) / 2 - parseFloat(ghost.style.width) / 2}px`;
  }
  if (still(start.bottom, end.bottom)) ghost.style.bottom = `${snap.bottom}px`;
  else if (still(start.top, end.top)) ghost.style.top = `${snap.top}px`;
  else {
    ghost.style.top = "50%";
    ghost.style.marginTop = `${(snap.top - snap.bottom) / 2 - parseFloat(ghost.style.height) / 2}px`;
  }
}

export function useMorphFlip(target: Ref<HTMLElement | null | undefined>) {
  let cleanup: (() => void) | null = null;
  let ghostCleanup: (() => void) | null = null;

  /** Fade the copy of the old content out, and the new content in. */
  const crossfade = (el: HTMLElement, snap: Snapshot | null) => {
    ghostCleanup?.();
    const content = el.firstElementChild as HTMLElement | null;
    if (typeof content?.animate === "function") {
      content.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: FADE_IN_MS,
        delay: FADE_IN_DELAY_MS,
        easing: "ease-out",
        fill: "backwards",
      });
    }
    if (!snap || typeof snap.ghost.animate !== "function") return;
    el.appendChild(snap.ghost);
    const fade = snap.ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_OUT_MS,
      easing: "ease-in",
      fill: "forwards",
    });
    const remove = () => {
      snap.ghost.remove();
      ghostCleanup = null;
    };
    fade.onfinish = remove;
    fade.oncancel = remove;
    ghostCleanup = () => {
      fade.cancel();
      remove();
    };
  };

  const morph = async (
    change?: () => void | Promise<void>,
    options: MorphOptions = {},
  ): Promise<void> => {
    const el = target.value;
    // Settle any morph still running so this one starts from a real box.
    cleanup?.();
    ghostCleanup?.();

    const start = el?.getBoundingClientRect();
    const startRadius = el ? getComputedStyle(el).borderRadius : "";
    const snap =
      el && start && options.crossfade ? snapshotContent(el, start) : null;
    await change?.();
    await nextTick();
    if (!el || !start) return;

    const reduced = prefersReducedMotion();
    el.style.width = "";
    el.style.height = "";
    const end = el.getBoundingClientRect();
    if (options.crossfade) {
      if (snap) placeGhost(snap, start, end);
      crossfade(el, snap);
    }
    if (reduced) return;

    const endRadius = getComputedStyle(el).borderRadius;
    const sameSize =
      Math.abs(start.width - end.width) < 1 &&
      Math.abs(start.height - end.height) < 1;
    if (sameSize && startRadius === endRadius) return;

    const spring = options.spring && supportsSpring();
    const duration = spring
      ? SPRING_DURATION
      : (options.duration ?? "var(--duration-morph)");
    const easing = spring
      ? SPRING_EASING
      : (options.easing ?? "var(--easing-snap)");

    el.style.width = `${start.width}px`;
    el.style.height = `${start.height}px`;
    el.style.borderRadius = startRadius;
    el.style.overflow = "hidden"; // clip only while morphing
    if (spring) {
      // The overshoot never pushes the surface past the screen edges.
      el.style.maxWidth = `${Math.max(end.width, window.innerWidth - EDGE_MARGIN_PX * 2)}px`;
    }
    void el.offsetWidth; // commit the start box before transitioning
    el.style.transition = [
      `width ${duration} ${easing}`,
      `height ${duration} ${easing}`,
      `border-radius ${duration} ${easing}`,
    ].join(", ");
    el.style.width = `${end.width}px`;
    el.style.height = `${end.height}px`;
    el.style.borderRadius = endRadius;

    const done = () => {
      el.removeEventListener("transitionend", onEnd);
      clearTimeout(fallback);
      el.style.transition = "";
      el.style.width = "";
      el.style.height = "";
      el.style.borderRadius = "";
      el.style.overflow = "";
      el.style.maxWidth = "";
      cleanup = null;
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === "width") done();
    };
    el.addEventListener("transitionend", onEnd);
    // transitionend never fires when nothing actually transitions.
    const fallback = setTimeout(done, 600);
    cleanup = done;
  };

  return { morph };
}
