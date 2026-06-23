import { describe, expect, it } from "vitest";
import {
  getMeaningfulGridChanges,
  hasMeaningfulGridChanges,
  hasUserGridContentEdit,
} from "../utils_gridChanges.js";

describe("getMeaningfulGridChanges", () => {
  it("detects tile, name, and privacy changes", () => {
    const before = {
      name: "Old",
      tiles: [{ i: "1" }],
      isPublic: false,
    };
    const after = {
      name: "New",
      tiles: [{ i: "1" }, { i: "2" }],
      isPublic: true,
    };

    expect(getMeaningfulGridChanges(before, after)).toEqual({
      nameChanged: true,
      tilesChanged: true,
      privacyChanged: true,
    });
  });
});

describe("hasMeaningfulGridChanges", () => {
  it("returns false when nothing changed", () => {
    const data = { name: "Grid", tiles: [], isPublic: false };
    const changes = getMeaningfulGridChanges(data, data);
    expect(hasMeaningfulGridChanges(changes)).toBe(false);
  });
});

describe("hasUserGridContentEdit", () => {
  it("ignores privacy-only changes", () => {
    const before = { name: "Grid", tiles: [], isPublic: false };
    const after = { name: "Grid", tiles: [], isPublic: true };
    const changes = getMeaningfulGridChanges(before, after);

    expect(hasUserGridContentEdit(changes)).toBe(false);
    expect(hasMeaningfulGridChanges(changes)).toBe(true);
  });
});
