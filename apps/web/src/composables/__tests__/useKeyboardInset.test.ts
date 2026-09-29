import { describe, expect, it } from "vitest";
import {
  MIN_KEYBOARD_INSET,
  measureKeyboardInset,
} from "@/composables/useKeyboardInset";

describe("measureKeyboardInset", () => {
  it("is the gap under the visual viewport when a keyboard is open", () => {
    expect(measureKeyboardInset(800, { height: 480, offsetTop: 0 })).toBe(320);
  });

  it("accounts for the visual viewport being scrolled", () => {
    expect(measureKeyboardInset(800, { height: 480, offsetTop: 20 })).toBe(300);
  });

  it("ignores sub-keyboard noise", () => {
    expect(
      measureKeyboardInset(800, { height: 800 - MIN_KEYBOARD_INSET + 1, offsetTop: 0 }),
    ).toBe(0);
    expect(measureKeyboardInset(800, { height: 799.6, offsetTop: 0 })).toBe(0);
  });

  it("rounds fractional gaps", () => {
    expect(measureKeyboardInset(800, { height: 479.6, offsetTop: 0 })).toBe(320);
  });

  it("is 0 without a visual viewport", () => {
    expect(measureKeyboardInset(800, null)).toBe(0);
  });
});
