/**
 * Unit tests for the toast Pinia store (src/stores/toast.ts).
 *
 * Covers:
 *  - addToast: shape of created toast, default type/duration, incrementing ids
 *  - addToast auto-removal after the duration elapses (fake timers)
 *  - removeToast: removes the matching toast, no-op for an unknown id
 *  - independence of multiple toasts
 *
 * setTimeout is controlled with Vitest fake timers so no real time passes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useToastStore } from "../toast";

describe("toast store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no toasts", () => {
    const store = useToastStore();
    expect(store.toasts).toEqual([]);
  });

  it("adds a toast with the provided message, type, and duration", () => {
    const store = useToastStore();

    const id = store.addToast("Saved", "success", 5000);

    expect(id).toBe(0);
    expect(store.toasts).toEqual([
      { id: 0, message: "Saved", type: "success", duration: 5000 },
    ]);
  });

  it("defaults to type 'info' and a 3000ms duration", () => {
    const store = useToastStore();

    store.addToast("Heads up");

    expect(store.toasts[0]).toMatchObject({
      message: "Heads up",
      type: "info",
      duration: 3000,
    });
  });

  it("assigns incrementing ids to successive toasts", () => {
    const store = useToastStore();

    const first = store.addToast("a");
    const second = store.addToast("b");
    const third = store.addToast("c");

    expect([first, second, third]).toEqual([0, 1, 2]);
    expect(store.toasts.map((t) => t.id)).toEqual([0, 1, 2]);
  });

  it("auto-removes a toast once its duration elapses", () => {
    const store = useToastStore();
    store.addToast("temporary", "info", 3000);

    expect(store.toasts).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(store.toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(store.toasts).toHaveLength(0);
  });

  it("removes only the toast whose duration expired, leaving others", () => {
    const store = useToastStore();
    store.addToast("short", "info", 1000);
    store.addToast("long", "info", 5000);

    vi.advanceTimersByTime(1000);

    expect(store.toasts.map((t) => t.message)).toEqual(["long"]);
  });

  it("removeToast removes the toast with the matching id", () => {
    const store = useToastStore();
    const keep = store.addToast("keep");
    const drop = store.addToast("drop");

    store.removeToast(drop);

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].id).toBe(keep);
  });

  it("removeToast is a no-op for an unknown id", () => {
    const store = useToastStore();
    store.addToast("only");

    store.removeToast(999);

    expect(store.toasts).toHaveLength(1);
  });

  it("does not throw when the timer fires after manual removal", () => {
    const store = useToastStore();
    const id = store.addToast("manual", "info", 3000);

    store.removeToast(id);
    expect(store.toasts).toHaveLength(0);

    expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
    expect(store.toasts).toHaveLength(0);
  });
});
