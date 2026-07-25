/**
 * Unit tests for FirebaseUtils — mapFirestoreToGrid
 *
 * Covers:
 *  - full document mapping including the snapshot id
 *  - defaults: userId "", name "Untitled", colNum 12, verticalCompact true,
 *    tiles [], background fields, timestamps → null
 *  - validation: non-array tiles coerced to [], non-object overrides dropped,
 *    boolean coercion of backgroundEmbed/duplicatable, explicit
 *    verticalCompact=false preserved
 */

import { describe, it, expect } from "vitest";
import { mapFirestoreToGrid } from "../FirebaseUtils.js";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
} from "@grids/contracts/types";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

/** Build a minimal QueryDocumentSnapshot stand-in. */
function fakeDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  } as unknown as QueryDocumentSnapshot<DocumentData, DocumentData>;
}

describe("mapFirestoreToGrid", () => {
  it("maps a fully-populated document, using the snapshot id", () => {
    const createdAt = { seconds: 1 };
    const overrides = { theme: "dark" };
    const tiles = [{ id: "t1" }];

    const grid = mapFirestoreToGrid(
      fakeDoc("grid-1", {
        userId: "user-1",
        rev: 3,
        name: "My Grid",
        colNum: 6,
        responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
        verticalCompact: false,
        tiles,
        backgroundImageSrc: "https://img.png",
        backgroundImageHash: "hash-1",
        backgroundEmbed: true,
        backgroundColor: "#fff",
        ogImageSrc: "https://og.png",
        themeId: "midnight",
        overrides,
        duplicatable: true,
        createdAt,
        updatedAt: "ts2",
        lastOpenedAt: "ts3",
      }),
    );

    expect(grid).toEqual({
      id: "grid-1",
      userId: "user-1",
      rev: 3,
      name: "My Grid",
      colNum: 6,
      responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      responsiveLayoutVersionStatus: "supported",
      verticalCompact: false,
      tiles,
      backgroundImageSrc: "https://img.png",
      backgroundImageHash: "hash-1",
      backgroundEmbed: true,
      backgroundColor: "#fff",
      ogImageSrc: "https://og.png",
      themeId: "midnight",
      overrides,
      duplicatable: true,
      createdAt,
      updatedAt: "ts2",
      lastOpenedAt: "ts3",
    });
  });

  it("applies defaults for an empty document", () => {
    const grid = mapFirestoreToGrid(fakeDoc("grid-empty", {}));

    expect(grid).toEqual({
      id: "grid-empty",
      userId: "",
      rev: 0,
      name: "Untitled",
      colNum: 12,
      responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      responsiveLayoutVersionStatus: "missing",
      verticalCompact: true,
      tiles: [],
      backgroundImageSrc: "",
      backgroundImageHash: undefined,
      backgroundEmbed: false,
      backgroundColor: "",
      ogImageSrc: "",
      themeId: undefined,
      overrides: undefined,
      duplicatable: false,
      createdAt: null,
      updatedAt: null,
      lastOpenedAt: null,
    });
  });

  it("coerces non-array tiles to an empty array", () => {
    const grid = mapFirestoreToGrid(fakeDoc("g", { tiles: "corrupted" }));
    expect(grid.tiles).toEqual([]);
  });

  it("preserves an explicit verticalCompact=false (does not fall back to true)", () => {
    const grid = mapFirestoreToGrid(fakeDoc("g", { verticalCompact: false }));
    expect(grid.verticalCompact).toBe(false);
  });

  it("drops overrides that are not an object", () => {
    const grid = mapFirestoreToGrid(fakeDoc("g", { overrides: "nope" }));
    expect(grid.overrides).toBeUndefined();
  });

  it("coerces truthy backgroundEmbed and duplicatable values to booleans", () => {
    const grid = mapFirestoreToGrid(
      fakeDoc("g", { backgroundEmbed: "yes", duplicatable: 1 }),
    );
    expect(grid.backgroundEmbed).toBe(true);
    expect(grid.duplicatable).toBe(true);
  });

  it("preserves timestamp 0 / falsy-but-present createdAt via ?? semantics", () => {
    const grid = mapFirestoreToGrid(fakeDoc("g", { createdAt: 0 }));
    expect(grid.createdAt).toBe(0);
  });

  it("treats an empty-string themeId as absent", () => {
    const grid = mapFirestoreToGrid(fakeDoc("g", { themeId: "" }));
    expect(grid.themeId).toBeUndefined();
  });

  it("defaults a missing rev to 0 for legacy grids", () => {
    const grid = mapFirestoreToGrid(fakeDoc("legacy", { name: "Legacy" }));
    expect(grid.rev).toBe(0);
  });

  it("renders an unsupported responsive layout version through griddle-v1", () => {
    const grid = mapFirestoreToGrid(
      fakeDoc("future", { responsiveLayoutVersion: "griddle-v2" }),
    );
    expect(grid.responsiveLayoutVersion).toBe(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );
    expect(grid.responsiveLayoutVersionStatus).toBe("unsupported");
  });
});
