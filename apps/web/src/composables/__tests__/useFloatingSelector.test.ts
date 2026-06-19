/**
 * Tests for useFloatingSelector — open/close logic for a floating menu, with
 * click-outside dismissal and reposition-on-resize/scroll while open.
 *
 * A host component is mounted so onMounted/onUnmounted register the document
 * listeners and the isActive watcher runs. requestAnimationFrame is stubbed so
 * the scheduled reposition can be invoked synchronously.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { useFloatingSelector } from "@/composables/useFloatingSelector";

interface Harness {
  isActive: Ref<boolean>;
  menuRef: Ref<HTMLElement | null>;
  positionMenu: ReturnType<typeof vi.fn>;
  buttonAction: ReturnType<typeof vi.fn>;
  emitter: ReturnType<typeof vi.fn>;
  handleClick: () => void;
  handleButtonClick: (value: string) => void;
  wrapper: VueWrapper;
  menuEl: HTMLElement;
}

const wrappers: VueWrapper[] = [];

function setup(): Harness {
  const isActive = ref(false);
  const menuEl = document.createElement("div");
  document.body.appendChild(menuEl);
  const menuRef = ref<HTMLElement | null>(menuEl);
  const positionMenu = vi.fn();
  const buttonAction = vi.fn();
  const emitter = vi.fn();

  let handles: ReturnType<typeof useFloatingSelector> | null = null;
  const wrapper = mount(
    defineComponent({
      setup() {
        handles = useFloatingSelector({
          isActive,
          menuRef,
          positionMenu,
          buttonAction,
          emitter,
        });
        return () => h("div");
      },
    }),
  );
  wrappers.push(wrapper);

  return {
    isActive,
    menuRef,
    positionMenu,
    buttonAction,
    emitter,
    handleClick: handles!.handleClick,
    handleButtonClick: handles!.handleButtonClick,
    wrapper,
    menuEl,
  };
}

let rafCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  rafCallbacks = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
  document.body.querySelectorAll("div").forEach((el) => el.remove());
  vi.restoreAllMocks();
});

/** Flush the queued rAF callbacks. */
function flushRaf() {
  const cbs = rafCallbacks;
  rafCallbacks = [];
  cbs.forEach((cb) => cb(0));
}

describe("handleClick", () => {
  it("opens the menu, calls the emitter, and positions it", async () => {
    const h = setup();
    h.handleClick();

    expect(h.isActive.value).toBe(true);
    expect(h.emitter).toHaveBeenCalledTimes(1);
    await nextTick();
    expect(h.positionMenu).toHaveBeenCalled();
  });

  it("closes the menu when already open, without re-emitting", () => {
    const h = setup();
    h.isActive.value = true;
    h.emitter.mockClear();

    h.handleClick();

    expect(h.isActive.value).toBe(false);
    expect(h.emitter).not.toHaveBeenCalled();
  });
});

describe("handleButtonClick", () => {
  it("invokes the action with the value and closes the menu", () => {
    const h = setup();
    h.isActive.value = true;

    h.handleButtonClick("bold");

    expect(h.buttonAction).toHaveBeenCalledWith("bold");
    expect(h.isActive.value).toBe(false);
  });
});

describe("click-outside dismissal", () => {
  it("closes the menu when clicking outside it", () => {
    const h = setup();
    h.isActive.value = true;

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(h.isActive.value).toBe(false);
    outside.remove();
  });

  it("keeps the menu open when clicking inside it", () => {
    const h = setup();
    h.isActive.value = true;

    const inner = document.createElement("span");
    h.menuEl.appendChild(inner);
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(h.isActive.value).toBe(true);
  });

  it("also dismisses on a contextmenu event outside the menu", () => {
    const h = setup();
    h.isActive.value = true;

    document.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true }),
    );

    expect(h.isActive.value).toBe(false);
  });
});

describe("reposition while open", () => {
  it("schedules a reposition on window resize while open", async () => {
    const h = setup();
    h.isActive.value = true;
    await nextTick();
    h.positionMenu.mockClear();

    window.dispatchEvent(new Event("resize"));
    flushRaf();

    expect(h.positionMenu).toHaveBeenCalledTimes(1);
  });

  it("ignores resize events after the menu has closed", async () => {
    const h = setup();
    h.isActive.value = true;
    await nextTick();
    h.isActive.value = false;
    await nextTick();
    h.positionMenu.mockClear();

    window.dispatchEvent(new Event("resize"));
    flushRaf();

    expect(h.positionMenu).not.toHaveBeenCalled();
  });

  it("schedules a reposition on window scroll while open", async () => {
    const h = setup();
    h.isActive.value = true;
    await nextTick();
    h.positionMenu.mockClear();

    // Scroll is registered with capture: true.
    window.dispatchEvent(new Event("scroll"));
    flushRaf();

    expect(h.positionMenu).toHaveBeenCalledTimes(1);
  });

  it("coalesces multiple resize events into a single rAF reposition", async () => {
    const h = setup();
    h.isActive.value = true;
    await nextTick();
    h.positionMenu.mockClear();

    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    flushRaf();

    expect(h.positionMenu).toHaveBeenCalledTimes(1);
  });
});

describe("teardown", () => {
  it("stops dismissing on outside clicks after unmount", () => {
    const h = setup();
    h.isActive.value = true;
    h.wrapper.unmount();

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(h.isActive.value).toBe(true);
    outside.remove();
  });

  it("stops repositioning on resize/scroll after unmount", async () => {
    const h = setup();
    h.isActive.value = true;
    await nextTick();
    h.wrapper.unmount();
    h.positionMenu.mockClear();

    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("scroll"));
    flushRaf();

    expect(h.positionMenu).not.toHaveBeenCalled();
  });
});
