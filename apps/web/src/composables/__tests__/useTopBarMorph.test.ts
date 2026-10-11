import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { useTopBarMorph } from "../useTopBarMorph";

const sized = (el: HTMLElement, width: number, height: number) => {
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: width });
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: height });
  return el;
};

function setup() {
  const bar = sized(document.createElement("div"), 344, 50);
  bar.className = "mobile-app-bar";
  bar.style.left = "8px";
  bar.style.top = "45px";
  bar.innerHTML = '<button id="grid-name">Grid</button>';
  document.body.appendChild(bar);

  const chrome = document.createElement("div");
  document.body.appendChild(chrome);
  const pill = sized(document.createElement("button"), 148, 48);
  pill.className = "mtc-pill";
  chrome.appendChild(pill);
  Object.defineProperty(pill, "offsetParent", { configurable: true, value: chrome });
  Object.defineProperty(pill, "offsetLeft", { configurable: true, value: 0 });
  Object.defineProperty(pill, "offsetTop", { configurable: true, value: 0 });

  const shown = ref(false);
  const pillRef = ref<HTMLElement | null>(pill);
  const wrapper = mount(
    defineComponent({
      setup() {
        useTopBarMorph({ shown, pill: pillRef });
        return () => h("div");
      },
    }),
  );
  return { bar, pill, shown, wrapper };
}

const standIn = () => document.querySelector<HTMLElement>("[data-top-bar-morph]");

describe("useTopBarMorph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    HTMLElement.prototype.animate = vi.fn(() => ({
      onfinish: null,
      cancel: vi.fn(),
    })) as unknown as HTMLElement["animate"];
    window.matchMedia = vi.fn(() => ({ matches: false })) as never;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("morphs a copy of the app bar into the pill that can't be tapped or read", async () => {
    const { bar, pill, shown, wrapper } = setup();
    shown.value = true;
    await nextTick();
    await nextTick();

    const copy = standIn();
    expect(copy).not.toBeNull();
    expect(copy!.getAttribute("aria-hidden")).toBe("true");
    expect(copy!.hasAttribute("inert")).toBe(true);
    expect(copy!.style.pointerEvents).toBe("none");
    expect(copy!.querySelector("[id]")).toBeNull();
    // The real pill stays tappable (only see-through) while the copy travels.
    expect(pill.style.opacity).toBe("0");
    expect(pill.style.visibility).toBe("");
    expect(bar.style.visibility).toBe("hidden");

    wrapper.unmount();
    expect(standIn()).toBeNull();
    expect(pill.style.opacity).toBe("");
    expect(bar.style.visibility).toBe("");
  });

  it("with the floating bar, morphs only its left pill", async () => {
    const { bar, pill, shown } = setup();
    bar.innerHTML = "";
    const lead = sized(document.createElement("div"), 242, 48);
    lead.className = "mobile-app-bar__left mab-piece mab-piece--lead";
    lead.textContent = "Untitled Grid";
    const undo = document.createElement("button");
    bar.append(lead, undo);
    Object.defineProperty(lead, "offsetLeft", { configurable: true, value: 0 });
    Object.defineProperty(lead, "offsetTop", { configurable: true, value: 0 });

    shown.value = true;
    await nextTick();
    await nextTick();

    const copy = standIn();
    expect(copy?.classList.contains("mab-piece--lead")).toBe(true);
    expect(copy?.style.width).toBe("242px");
    // Only the pill hides; the circles tuck away as usual.
    expect(lead.style.visibility).toBe("hidden");
    expect(bar.style.visibility).toBe("");
    expect(pill.style.opacity).toBe("0");
  });

  it("does nothing with reduced motion", async () => {
    window.matchMedia = vi.fn(() => ({ matches: true })) as never;
    const { shown } = setup();
    shown.value = true;
    await nextTick();
    await nextTick();
    expect(standIn()).toBeNull();
  });

  it("does nothing while previewing (the app bar is off screen)", async () => {
    const { bar, shown } = setup();
    bar.classList.add("mobile-app-bar--hidden");
    shown.value = true;
    await nextTick();
    await nextTick();
    expect(standIn()).toBeNull();
  });

  it("never reveals a tucked pill", async () => {
    const { pill, shown } = setup();
    pill.classList.add("mtc-pill--tucked");
    shown.value = true;
    await nextTick();
    await nextTick();
    expect(standIn()).toBeNull();
    expect(pill.style.opacity).toBe("");
  });
});
