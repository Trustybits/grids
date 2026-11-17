/**
 * The app bar morphing into the Multi edit pill when a tile is picked, and
 * back when editing ends — one surface changing shape rather than one bar
 * fading out while another fades in.
 *
 * The two are separate elements, so a stand-in does the travelling: a copy of
 * the app bar (aria-hidden, inert, untappable) springs from one box to the
 * other while its content fades, then hands over to the real element. The
 * real pill and app bar stay live throughout, so taps are never blocked.
 *
 * Skipped with reduced motion, while previewing (the app bar is off screen),
 * or when either box can't be measured — the plain fade then plays as before.
 */

import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";

const APP_BAR = ".mobile-app-bar";
const APP_BAR_HIDDEN = "mobile-app-bar--hidden";
const APP_BAR_TUCKED = "mobile-app-bar--tucked";
/** The floating app bar's left pill [‹ ☰ name]: the piece that morphs. */
const APP_BAR_LEAD = ".mab-piece--lead";
const PILL_TUCKED = "mtc-pill--tucked";

/** A damped spring (ζ 0.7) for `linear()`, as the bottom bar's morph uses. */
const SPRING_EASING =
  "linear(0, 0.051, 0.171, 0.323, 0.48, 0.626, 0.751, 0.851, 0.927, 0.98, " +
  "1.015, 1.035, 1.044, 1.046, 1.042, 1.036, 1.029, 1.022, 1.015, 1.01, " +
  "1.006, 1.003, 1, 0.999, 1)";
const SNAP_EASING = "cubic-bezier(0.2, 0.9, 0.25, 1.05)";
const DURATION_MS = 320;
/** The overshoot may come this close to the screen edge, no closer. */
const EDGE_MARGIN_PX = 4;
/** The content fades over this share of the travel. */
const CONTENT_FADE = 0.35;
/** The real element takes over over the last share of the travel. */
const HANDOVER = 0.3;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: string;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const springEasing = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("transition-timing-function", "linear(0, 1)")
    ? SPRING_EASING
    : SNAP_EASING;

/**
 * The part of the app bar that turns into the pill: the whole bar, or its
 * left pill when the bar floats as separate pieces.
 */
const surfaceOf = (bar: HTMLElement): HTMLElement =>
  bar.querySelector<HTMLElement>(APP_BAR_LEAD) ?? bar;

/**
 * The resting box of the app bar's surface. The bar is fixed, so its used
 * `left` / `top` place it on screen, and a piece inside it sits at its offset
 * within; neither, nor the layout sizes, include the scale the bar tucks away
 * with (whose origin changes as it tucks and untucks).
 */
function appBarBox(bar: HTMLElement): Box | null {
  const surface = surfaceOf(bar);
  if (!surface.offsetWidth || !surface.offsetHeight) return null;
  const style = getComputedStyle(bar);
  let left = parseFloat(style.left);
  let top = parseFloat(style.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  if (surface !== bar) {
    left += bar.clientLeft + surface.offsetLeft;
    top += bar.clientTop + surface.offsetTop;
  }
  return {
    left,
    top,
    width: surface.offsetWidth,
    height: surface.offsetHeight,
    radius: getComputedStyle(surface).borderRadius,
  };
}

/** The pill's resting box, ignoring the scale it enters and leaves with. */
function pillBox(pill: HTMLElement): Box | null {
  const parent = pill.offsetParent as HTMLElement | null;
  if (!parent || !pill.offsetWidth || !pill.offsetHeight) return null;
  const origin = parent.getBoundingClientRect();
  return {
    left: origin.left + pill.offsetLeft,
    top: origin.top + pill.offsetTop,
    width: pill.offsetWidth,
    height: pill.offsetHeight,
    radius: getComputedStyle(pill).borderRadius,
  };
}

/** A non-interactive copy of the app bar's surface, as it looks at rest. */
function makeStandIn(bar: HTMLElement, box: Box): HTMLElement {
  const copy = surfaceOf(bar).cloneNode(true) as HTMLElement;
  copy.classList.remove(APP_BAR_TUCKED, APP_BAR_HIDDEN);
  copy.removeAttribute("id");
  for (const node of copy.querySelectorAll("[id]")) node.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("inert", "");
  copy.dataset.topBarMorph = "";
  const z = parseInt(getComputedStyle(bar).zIndex, 10);
  Object.assign(copy.style, {
    position: "fixed",
    left: `${box.left}px`,
    top: `${box.top}px`,
    right: "auto",
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: "0",
    opacity: "1",
    transform: "none",
    transition: "none",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: String(Number.isFinite(z) ? z + 1 : 2001),
  });
  return copy;
}

const frame = (box: Box): Keyframe => ({
  left: `${box.left}px`,
  top: `${box.top}px`,
  width: `${box.width}px`,
  height: `${box.height}px`,
  borderRadius: box.radius,
});

export function useTopBarMorph(options: {
  /** Whether the floating top pieces (pill + Undo) are showing. */
  shown: Readonly<Ref<boolean>>;
  pill: Readonly<Ref<HTMLElement | null>>;
}) {
  let finish: (() => void) | null = null;

  const run = async (toPill: boolean) => {
    finish?.();
    if (prefersReducedMotion()) return;
    const bar = document.querySelector<HTMLElement>(APP_BAR);
    const pill = options.pill.value;
    if (!bar || !pill || bar.classList.contains(APP_BAR_HIDDEN)) return;
    if (typeof bar.animate !== "function") return;
    // A tucked pill (typing, a tool mode) is not where the bar goes or
    // comes from.
    const pillTucked = () => pill.classList.contains(PILL_TUCKED);
    if (!toPill && pillTucked()) return;

    // Before the DOM changes: where the outgoing surface is, and a copy of
    // the app bar as it looks at rest.
    const from = toPill ? appBarBox(bar) : pillBox(pill);
    if (!from) return;
    const standIn = makeStandIn(bar, from);

    await nextTick();
    if (toPill && pillTucked()) return;
    const to = toPill ? pillBox(pill) : appBarBox(bar);
    if (!to) return;

    // The incoming element stays invisible until the copy reaches it — by
    // opacity, so it can already be tapped; the outgoing one is gone.
    const incoming = toPill ? pill : surfaceOf(bar);
    const outgoing = toPill ? surfaceOf(bar) : pill;
    outgoing.style.visibility = "hidden";
    incoming.style.opacity = "0";
    // The spring's overshoot stays clear of the screen's right edge.
    standIn.style.maxWidth = `${Math.max(from.width, to.width, window.innerWidth - EDGE_MARGIN_PX - to.left)}px`;
    document.body.appendChild(standIn);

    const easing = springEasing();
    const travel = standIn.animate([frame(from), frame(to)], {
      duration: DURATION_MS,
      easing,
      fill: "forwards",
    });
    // The app bar's content fades out on the way to the pill, in on the way
    // back; the copy's own surface hands over to the real one at the end.
    const contentFade = Array.from(standIn.children).map((child) =>
      (child as HTMLElement).animate(
        toPill ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
        toPill
          ? { duration: DURATION_MS * CONTENT_FADE, fill: "forwards" }
          : {
              duration: DURATION_MS * CONTENT_FADE,
              delay: DURATION_MS * (1 - CONTENT_FADE),
              fill: "both",
            },
      ),
    );
    const handOverAt = DURATION_MS * (1 - HANDOVER);
    const handOver = window.setTimeout(() => {
      incoming.style.opacity = "";
      incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: DURATION_MS * HANDOVER,
        easing: "ease-out",
      });
      standIn.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: DURATION_MS * HANDOVER,
        easing: "ease-in",
        fill: "forwards",
      });
    }, handOverAt);

    const done = () => {
      window.clearTimeout(handOver);
      travel.cancel();
      for (const fade of contentFade) fade.cancel();
      standIn.remove();
      incoming.style.opacity = "";
      outgoing.style.visibility = "";
      finish = null;
    };
    travel.onfinish = () => window.setTimeout(done, DURATION_MS * HANDOVER);
    finish = done;
  };

  watch(
    () => options.shown.value,
    (shown, wasShown) => {
      if (shown !== wasShown) void run(shown);
    },
    { flush: "pre" },
  );

  onBeforeUnmount(() => finish?.());
}
