/**
 * Tests for useVideoFocus — a module-level singleton that tracks visible video
 * tiles via IntersectionObserver and chooses one "active" video, round-robin
 * rotating across multiple visible videos and honoring hover.
 *
 * IntersectionObserver is stubbed (jsdom has none) so visibility can be driven
 * manually; requestAnimationFrame is stubbed to run synchronously and fake
 * timers drive rotation. Because the composable's state is a shared singleton,
 * every registered tile is unregistered in afterEach to reset it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── IntersectionObserver stub ──────────────────────────────────────────────
let ioCallback: IntersectionObserverCallback | null = null;
const observedEls = new Set<Element>();

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe(el: Element) {
    observedEls.add(el);
  }
  unobserve(el: Element) {
    observedEls.delete(el);
  }
  disconnect() {
    observedEls.clear();
  }
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

import { useVideoFocus } from "@/composables/useVideoFocus";

/** Drive the observer: mark elements visible/hidden and run its callback. */
function setVisibility(...entries: Array<[HTMLElement, boolean]>) {
  ioCallback?.(
    entries.map(([target, isIntersecting]) => ({
      target,
      isIntersecting,
    })) as unknown as IntersectionObserverEntry[],
    {} as IntersectionObserver,
  );
}

const registeredIds: string[] = [];

function makeTile(
  api: ReturnType<typeof useVideoFocus>,
  id: string,
  x: number,
  y: number,
): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  api.register(id, x, y, el);
  registeredIds.push(id);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  // Run rAF callbacks synchronously so deferred pickActive() resolves at once.
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 1;
  });
});

afterEach(() => {
  // Reset the singleton: unregister everything and clear hover/active.
  const api = useVideoFocus();
  api.setHovered(null);
  for (const id of registeredIds.splice(0)) api.unregister(id);
  document.body.querySelectorAll("div").forEach((el) => el.remove());
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("registration + visibility", () => {
  it("observes the element on register", () => {
    const api = useVideoFocus();
    const el = makeTile(api, "a", 0, 0);
    expect(observedEls.has(el)).toBe(true);
  });

  it("activates a single video once it becomes visible", () => {
    const api = useVideoFocus();
    const el = makeTile(api, "a", 0, 0);
    expect(api.activeVideoId.value).toBeNull();

    setVisibility([el, true]);
    expect(api.activeVideoId.value).toBe("a");
  });

  it("clears the active video when the only visible tile goes hidden", () => {
    const api = useVideoFocus();
    const el = makeTile(api, "a", 0, 0);
    setVisibility([el, true]);
    expect(api.activeVideoId.value).toBe("a");

    setVisibility([el, false]);
    expect(api.activeVideoId.value).toBeNull();
  });
});

describe("ordering + rotation", () => {
  it("activates the top-left visible video first", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 1); // lower (y=1)
    const b = makeTile(api, "b", 0, 0); // upper (y=0)
    setVisibility([a, true], [b, true]);
    expect(api.activeVideoId.value).toBe("b");
  });

  it("rotates to the next visible video after the rotation interval", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0);
    const b = makeTile(api, "b", 0, 1);
    setVisibility([a, true], [b, true]);
    expect(api.activeVideoId.value).toBe("a");

    vi.advanceTimersByTime(3000);
    expect(api.activeVideoId.value).toBe("b");

    vi.advanceTimersByTime(3000);
    expect(api.activeVideoId.value).toBe("a");
  });

  it("does not rotate when only one video is visible", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0);
    setVisibility([a, true]);

    vi.advanceTimersByTime(6000);
    expect(api.activeVideoId.value).toBe("a");
  });
});

describe("hover priority", () => {
  it("activates the hovered video and pauses rotation", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0);
    const b = makeTile(api, "b", 0, 1);
    setVisibility([a, true], [b, true]);
    expect(api.activeVideoId.value).toBe("a");

    api.setHovered("b");
    expect(api.activeVideoId.value).toBe("b");

    // Rotation is paused while hovering — stays on b.
    vi.advanceTimersByTime(3000);
    expect(api.activeVideoId.value).toBe("b");
  });

  it("does not activate a hovered tile that is not visible", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0);
    const b = makeTile(api, "b", 0, 1);
    setVisibility([a, true], [b, false]);
    expect(api.activeVideoId.value).toBe("a");

    api.setHovered("b"); // b is not visible
    // Falls through to the visible-set logic, which keeps a active.
    expect(api.activeVideoId.value).toBe("a");
  });
});

describe("unregister", () => {
  it("stops observing and re-picks the active video", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0);
    const b = makeTile(api, "b", 0, 1);
    setVisibility([a, true], [b, true]);
    expect(api.activeVideoId.value).toBe("a");

    api.unregister("a");
    registeredIds.splice(registeredIds.indexOf("a"), 1);

    expect(observedEls.has(a)).toBe(false);
    expect(api.activeVideoId.value).toBe("b");
  });

  it("clears the hovered id when the hovered tile is unregistered", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0);
    const b = makeTile(api, "b", 0, 1);
    setVisibility([a, true], [b, true]);
    api.setHovered("a");
    expect(api.activeVideoId.value).toBe("a");

    api.unregister("a");
    registeredIds.splice(registeredIds.indexOf("a"), 1);

    // With a gone and hover cleared, b becomes the active visible video.
    expect(api.activeVideoId.value).toBe("b");
  });
});

describe("updatePosition", () => {
  it("is a no-op for an unknown id", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0);
    setVisibility([a, true]);
    expect(() => api.updatePosition("ghost", 9, 9)).not.toThrow();
    expect(api.activeVideoId.value).toBe("a");
  });

  it("re-orders the rotation group when a tile's position changes", () => {
    const api = useVideoFocus();
    const a = makeTile(api, "a", 0, 0); // top
    const b = makeTile(api, "b", 0, 1); // below a
    setVisibility([a, true], [b, true]);
    // a is top-left → active first; rotation would advance to b after 3s.
    expect(api.activeVideoId.value).toBe("a");

    // Move b above a. The rotation group reorders to [b, a]; the active tile
    // (a) is kept, now at index 1, so the next tick rotates to b's successor —
    // i.e. wraps back to b. Assert the reorder took effect via the next tick.
    api.updatePosition("b", 0, -1);
    vi.advanceTimersByTime(3000);
    // From index 1 (a) → (1+1)%2 = 0 → group[0] = b (the new top tile).
    expect(api.activeVideoId.value).toBe("b");
  });
});
