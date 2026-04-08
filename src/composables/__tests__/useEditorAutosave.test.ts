/**
 * Tests for useEditorAutosave composable.
 *
 * Covers the debounced persist / flush behaviour used by SmartTextContent
 * to auto-save editor changes after a 1.5 s pause.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return { ...actual, onUnmounted: vi.fn((cb) => cb) };
});

import { onUnmounted } from "vue";
import { useEditorAutosave } from "@/composables/useEditorAutosave";

const DEBOUNCE_MS = 1500;

describe("useEditorAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(onUnmounted).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call persist immediately on schedulePersist", () => {
    const persist = vi.fn();
    const { schedulePersist } = useEditorAutosave(persist);

    schedulePersist();
    expect(persist).not.toHaveBeenCalled();
  });

  it("calls persist after the debounce interval", () => {
    const persist = vi.fn();
    const { schedulePersist } = useEditorAutosave(persist);

    schedulePersist();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on successive schedulePersist calls", () => {
    const persist = vi.fn();
    const { schedulePersist } = useEditorAutosave(persist);

    schedulePersist();
    vi.advanceTimersByTime(1000);
    schedulePersist();
    vi.advanceTimersByTime(1000);
    expect(persist).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("flushPersist calls persist immediately", () => {
    const persist = vi.fn();
    const { flushPersist } = useEditorAutosave(persist);

    flushPersist();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("flushPersist cancels a pending scheduled persist", () => {
    const persist = vi.fn();
    const { schedulePersist, flushPersist } = useEditorAutosave(persist);

    schedulePersist();
    flushPersist();
    expect(persist).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("calls persist on unmount if a timer is pending", () => {
    const persist = vi.fn();
    let unmountCb: (() => void) | undefined;
    vi.mocked(onUnmounted).mockImplementation((cb: any) => {
      unmountCb = cb;
    });

    const { schedulePersist } = useEditorAutosave(persist);
    schedulePersist();

    expect(persist).not.toHaveBeenCalled();
    unmountCb!();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not call persist on unmount if no timer is pending", () => {
    const persist = vi.fn();
    let unmountCb: (() => void) | undefined;
    vi.mocked(onUnmounted).mockImplementation((cb: any) => {
      unmountCb = cb;
    });

    useEditorAutosave(persist);
    unmountCb!();
    expect(persist).not.toHaveBeenCalled();
  });
});
