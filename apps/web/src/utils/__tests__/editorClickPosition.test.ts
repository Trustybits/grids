import { describe, it, expect, vi } from "vitest";
import {
  getShortClickCoords,
  resolveShortClickPosition,
} from "@/utils/editorClickPosition";

function touchEnd(x: number, y: number): TouchEvent {
  return {
    changedTouches: [{ clientX: x, clientY: y }],
  } as unknown as TouchEvent;
}

describe("getShortClickCoords", () => {
  it("reads client coordinates from a mouse/pointer event", () => {
    const event = new MouseEvent("pointerdown", { clientX: 40, clientY: 12 });
    expect(getShortClickCoords(event)).toEqual({ left: 40, top: 12 });
  });

  it("reads the lifted finger from a touchend event", () => {
    expect(getShortClickCoords(touchEnd(7, 9))).toEqual({ left: 7, top: 9 });
  });

  it("returns null for a touch event with no changed touches", () => {
    const event = { changedTouches: [] } as unknown as TouchEvent;
    expect(getShortClickCoords(event)).toBeNull();
  });

  it("returns null when there is no event", () => {
    expect(getShortClickCoords(undefined)).toBeNull();
  });
});

describe("resolveShortClickPosition", () => {
  it("returns the document position under the click", () => {
    const view = { posAtCoords: vi.fn(() => ({ pos: 5, inside: 4 })) };
    const event = new MouseEvent("pointerdown", { clientX: 40, clientY: 12 });

    expect(resolveShortClickPosition(view, event)).toBe(5);
    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 40, top: 12 });
  });

  it("returns null when the click is outside the text", () => {
    const view = { posAtCoords: vi.fn(() => null) };
    expect(
      resolveShortClickPosition(view, new MouseEvent("pointerdown")),
    ).toBeNull();
  });

  it("returns null when the view cannot measure layout", () => {
    const view = {
      posAtCoords: vi.fn(() => {
        throw new Error("detached");
      }),
    };
    expect(resolveShortClickPosition(view, touchEnd(1, 1))).toBeNull();
  });

  it("returns null without a view or event", () => {
    const view = { posAtCoords: vi.fn(() => ({ pos: 1 })) };
    expect(resolveShortClickPosition(null, touchEnd(1, 1))).toBeNull();
    expect(resolveShortClickPosition(view, null)).toBeNull();
    expect(view.posAtCoords).not.toHaveBeenCalled();
  });
});
