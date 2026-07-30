import { describe, expect, it } from "vitest";
import type { Breakpoint } from "@grids/contracts/types";
import {
  breakpointToColumnCount,
  calculateViewportColumnCount,
  columnCountToBreakpoint,
} from "../GridLayoutUtils";

describe("breakpoint and viewport column mapping", () => {
  it.each([
    ["sm", 12, 4],
    ["md", 12, 8],
    ["lg", 12, 12],
    ["md", 6, 6],
  ] satisfies Array<[Breakpoint, number, number]>)(
    "maps %s against a %i-column grid to %i columns",
    (breakpoint, baseColumnCount, expected) => {
      expect(
        breakpointToColumnCount(breakpoint, baseColumnCount),
      ).toBe(expected);
    },
  );

  it.each([
    [1, "sm"],
    [4, "sm"],
    [5, "md"],
    [8, "md"],
    [9, "lg"],
    [12, "lg"],
  ] satisfies Array<[number, Breakpoint]>)(
    "maps %i columns to %s",
    (columns, expected) => {
      expect(columnCountToBreakpoint(columns)).toBe(expected);
    },
  );

  it("selects the largest supported column count that fits the viewport", () => {
    expect(
      calculateViewportColumnCount({
        baseColumnCount: 12,
        viewportWidth: 1052,
        rowHeight: 75,
        margin: 48,
      }),
    ).toBe(8);
  });

  it("falls back to the smallest supported count when none fit", () => {
    expect(
      calculateViewportColumnCount({
        baseColumnCount: 12,
        viewportWidth: 100,
        rowHeight: 75,
        margin: 48,
      }),
    ).toBe(4);
  });

  it("does not exceed a grid's base column count", () => {
    expect(
      calculateViewportColumnCount({
        baseColumnCount: 3,
        viewportWidth: 2000,
        rowHeight: 75,
        margin: 48,
      }),
    ).toBe(3);
  });
});
