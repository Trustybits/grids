import { describe, expect, it } from "vitest";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  LEGACY_RESPONSIVE_LAYOUT_VERSION,
} from "@grids/contracts/types";
import { getGriddleResponsiveReflowStrategy } from "../ResponsiveLayoutStrategy";

describe("getGriddleResponsiveReflowStrategy", () => {
  it("keeps legacy-v1 on the app-owned projection path", () => {
    expect(
      getGriddleResponsiveReflowStrategy(LEGACY_RESPONSIVE_LAYOUT_VERSION),
    ).toBeUndefined();
  });

  it("maps persisted griddle-v1 to its immutable Griddle strategy", () => {
    expect(
      getGriddleResponsiveReflowStrategy(GRIDDLE_RESPONSIVE_LAYOUT_VERSION),
    ).toBe("griddle-v1");
  });
});
