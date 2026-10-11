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
 *    never growing wider than the screen less a small margin.
 *
 * Generalises `MobileGridBar`'s earlier width-only pill morph. Respects
 * `prefers-reduced-motion` by skipping the animation.
 */

import { nextTick, type Ref } from "vue";

export interface MorphOptions {
  /** CSS duration; defaults to the snappy morph token. */
  duration?: string;
  /** CSS easing; defaults to the snappy morph token. */
  easing?: string;
  /** Spring the size change (overrides `duration` / `easing`). */
  spring?: boolean;
}

/** A damped spring (ζ 0.7) sampled for `linear()`: peaks ~4.6% past. */
const SPRING_EASING =
  "linear(0, 0.051, 0.171, 0.323, 0.48, 0.626, 0.751, 0.851, 0.927, 0.98, " +
  "1.015, 1.035, 1.044, 1.046, 1.042, 1.036, 1.029, 1.022, 1.015, 1.01, " +
  "1.006, 1.003, 1, 0.999, 1)";
const SPRING_DURATION = "320ms";
/** A springing surface may overshoot to within this of the screen edges. */
const EDGE_MARGIN_PX = 4;

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

export function useMorphFlip(target: Ref<HTMLElement | null | undefined>) {
  let cleanup: (() => void) | null = null;

  const morph = async (
    change?: () => void | Promise<void>,
    options: MorphOptions = {},
  ): Promise<void> => {
    const el = target.value;
    // Settle any morph still running so this one starts from a real box.
    cleanup?.();

    const start = el?.getBoundingClientRect();
    const startRadius = el ? getComputedStyle(el).borderRadius : "";
    await change?.();
    await nextTick();
    if (!el || !start || prefersReducedMotion()) return;

    el.style.width = "";
    el.style.height = "";
    const end = el.getBoundingClientRect();
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
