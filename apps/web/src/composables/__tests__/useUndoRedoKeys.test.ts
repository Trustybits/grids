/**
 * Tests for useUndoRedoKeys — global keydown handler that maps
 * Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y to controller undo/redo,
 * but only while editing and not when focus is in a text field/editor.
 *
 * The session/viewport stores and controller are mocked. A host component is
 * mounted so onMounted registers
 * the window listener and onUnmounted removes it; keydown events are dispatched
 * to drive the handler.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";

const mockSession = vi.hoisted(() => ({
  canEditAtBreakpoint: vi.fn(() => true),
}));
const mockViewport = vi.hoisted(() => ({
  forcedBreakpoint: null as string | null,
  viewportBreakpoint: "lg",
}));
const mockController = vi.hoisted(() => ({
  canEditCurrentGrid: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => mockSession,
}));
vi.mock("@/stores/grid/gridViewport", () => ({
  useGridViewportStore: () => mockViewport,
}));
vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => mockController,
}));

import { useUndoRedoKeys } from "@/composables/useUndoRedoKeys";

// Track mounts so their window listeners are torn down between tests —
// window is shared across the whole file, so an un-unmounted component would
// leave a live keydown listener that pollutes later assertions.
const wrappers: VueWrapper[] = [];

function mountKeys() {
  const wrapper = mount(
    defineComponent({
      setup() {
        useUndoRedoKeys();
        return () => h("div");
      },
    }),
  );
  wrappers.push(wrapper);
  return wrapper;
}

function dispatchKey(
  init: KeyboardEventInit,
  target: EventTarget = window,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  mockSession.canEditAtBreakpoint.mockReset();
  mockSession.canEditAtBreakpoint.mockReturnValue(true);
  mockController.canEditCurrentGrid.mockReset();
  mockController.canEditCurrentGrid.mockImplementation(() =>
    mockSession.canEditAtBreakpoint(),
  );
  mockController.undo.mockReset();
  mockController.redo.mockReset();
});

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount();
});

describe("undo", () => {
  it("calls undo on Cmd+Z and prevents default", () => {
    mountKeys();
    const event = dispatchKey({ key: "z", metaKey: true });
    expect(mockController.undo).toHaveBeenCalledTimes(1);
    expect(mockController.redo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("calls undo on Ctrl+Z", () => {
    mountKeys();
    dispatchKey({ key: "z", ctrlKey: true });
    expect(mockController.undo).toHaveBeenCalledTimes(1);
  });
});

describe("redo", () => {
  it("calls redo on Cmd+Shift+Z", () => {
    mountKeys();
    const event = dispatchKey({ key: "z", metaKey: true, shiftKey: true });
    expect(mockController.redo).toHaveBeenCalledTimes(1);
    expect(mockController.undo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("calls redo on Cmd+Y", () => {
    mountKeys();
    dispatchKey({ key: "y", metaKey: true });
    expect(mockController.redo).toHaveBeenCalledTimes(1);
  });
});

describe("guards", () => {
  it("does nothing when the modifier key is absent", () => {
    mountKeys();
    dispatchKey({ key: "z" });
    expect(mockController.undo).not.toHaveBeenCalled();
    expect(mockController.redo).not.toHaveBeenCalled();
  });

  it("does nothing when the grid is not editable", () => {
    mockSession.canEditAtBreakpoint.mockReturnValue(false);
    mountKeys();
    dispatchKey({ key: "z", metaKey: true });
    expect(mockController.undo).not.toHaveBeenCalled();
  });

  it("ignores an unrelated key with the modifier held", () => {
    mountKeys();
    dispatchKey({ key: "a", metaKey: true });
    expect(mockController.undo).not.toHaveBeenCalled();
    expect(mockController.redo).not.toHaveBeenCalled();
  });

  it("ignores keystrokes originating from an input field", () => {
    mountKeys();
    const input = document.createElement("input");
    document.body.appendChild(input);
    dispatchKey({ key: "z", metaKey: true }, input);
    expect(mockController.undo).not.toHaveBeenCalled();
    input.remove();
  });

  it("ignores keystrokes originating from a contentEditable element", () => {
    mountKeys();
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    // jsdom doesn't compute isContentEditable from the attribute; force it.
    Object.defineProperty(div, "isContentEditable", { value: true });
    document.body.appendChild(div);
    dispatchKey({ key: "z", metaKey: true }, div);
    expect(mockController.undo).not.toHaveBeenCalled();
    div.remove();
  });

  it("ignores keystrokes from a textarea", () => {
    mountKeys();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    dispatchKey({ key: "z", metaKey: true }, textarea);
    expect(mockController.undo).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("ignores keystrokes from a select", () => {
    mountKeys();
    const select = document.createElement("select");
    document.body.appendChild(select);
    dispatchKey({ key: "z", metaKey: true }, select);
    expect(mockController.undo).not.toHaveBeenCalled();
    select.remove();
  });
});

describe("listener lifecycle", () => {
  it("removes the keydown listener on unmount", () => {
    const wrapper = mountKeys();
    wrapper.unmount();
    dispatchKey({ key: "z", metaKey: true });
    expect(mockController.undo).not.toHaveBeenCalled();
  });
});
