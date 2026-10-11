import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

/** A box that reports `start` until `grow()` is called, then `end`. */
function makeBar(start: Partial<DOMRect>, end: Partial<DOMRect>) {
  const el = document.createElement("div");
  const content = document.createElement("div");
  content.innerHTML = '<button id="old-id">Old</button>';
  el.appendChild(content);
  document.body.appendChild(el);
  let box = { ...start };
  const rect = (b: Partial<DOMRect>) =>
    ({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      right: (b.left ?? 0) + (b.width ?? 0),
      bottom: (b.top ?? 0) + (b.height ?? 0),
      ...b,
    }) as DOMRect;
  el.getBoundingClientRect = () => rect(box);
  content.getBoundingClientRect = () => rect(box);
  return {
    el,
    content,
    grow: () => {
      box = { ...end };
      content.innerHTML = "<span>New</span>";
    },
  };
}

interface FakeAnimation {
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
  cancel: () => void;
  keyframes: Keyframe[];
}

describe("useMorphFlip", () => {
  let animations: FakeAnimation[];

  beforeEach(() => {
    vi.resetModules();
    animations = [];
    HTMLElement.prototype.animate = vi.fn(function (
      this: HTMLElement,
      keyframes: Keyframe[],
    ) {
      const animation: FakeAnimation = {
        onfinish: null,
        oncancel: null,
        cancel: () => animation.oncancel?.(),
        keyframes,
      };
      animations.push(animation);
      return animation as unknown as Animation;
    }) as unknown as HTMLElement["animate"];
    window.matchMedia = vi.fn(() => ({ matches: false })) as never;
    vi.stubGlobal("CSS", { supports: () => true });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  const load = async () => (await import("../useMorphFlip")).useMorphFlip;

  it("animates from the old box to the new one", async () => {
    const useMorphFlip = await load();
    const bar = makeBar({ width: 200, height: 50 }, { width: 340, height: 120 });
    const { morph } = useMorphFlip(ref(bar.el));
    await morph(bar.grow);
    expect(bar.el.style.transition).toContain("var(--duration-morph)");
    expect(bar.el.style.width).toBe("340px");
    expect(bar.el.style.height).toBe("120px");
  });

  it("springs, and never wider than the screen less a small margin", async () => {
    const useMorphFlip = await load();
    const bar = makeBar({ width: 200, height: 50 }, { width: 340, height: 120 });
    const { morph } = useMorphFlip(ref(bar.el));
    await morph(bar.grow, { spring: true });
    expect(bar.el.style.transition).toContain("linear(");
    expect(bar.el.style.transition).toContain("320ms");
    expect(bar.el.style.maxWidth).toBe(`${window.innerWidth - 8}px`);
  });

  it("falls back to the snappy curve where linear() isn't supported", async () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const useMorphFlip = await load();
    const bar = makeBar({ width: 200, height: 50 }, { width: 340, height: 120 });
    const { morph } = useMorphFlip(ref(bar.el));
    await morph(bar.grow, { spring: true });
    expect(bar.el.style.transition).toContain("var(--easing-snap)");
  });

});
