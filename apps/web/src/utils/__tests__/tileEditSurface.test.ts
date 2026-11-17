import { describe, expect, it } from "vitest";
import { isOnTileEditSurface } from "../tileEditSurface";

describe("isOnTileEditSurface", () => {
  it("is true inside the phone editor's floating chrome", () => {
    const bar = document.createElement("div");
    bar.setAttribute("data-tile-edit-surface", "");
    const button = document.createElement("button");
    bar.appendChild(button);
    expect(isOnTileEditSurface(button)).toBe(true);
    expect(isOnTileEditSurface(bar)).toBe(true);
  });

  it("is false elsewhere and for non-elements", () => {
    expect(isOnTileEditSurface(document.createElement("div"))).toBe(false);
    expect(isOnTileEditSurface(null)).toBe(false);
    expect(isOnTileEditSurface(window)).toBe(false);
  });
});
