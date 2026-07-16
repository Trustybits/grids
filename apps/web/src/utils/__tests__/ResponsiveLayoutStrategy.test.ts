import { describe, expect, it } from "vitest";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
} from "@grids/contracts/types";
import { getGriddleResponsiveReflowStrategy } from "../ResponsiveLayoutStrategy";

describe("getGriddleResponsiveReflowStrategy", () => {
  it("maps the sole supported version to its immutable Griddle strategy", () => {
    expect(
      getGriddleResponsiveReflowStrategy(GRIDDLE_RESPONSIVE_LAYOUT_VERSION),
    ).toBe("griddle-v1");
  });
});
