import { describe, expect, it } from "vitest";
import { breakpointRank } from "../BreakpointUtils";

describe("breakpointRank", () => {
  it.each([
    ["sm", 0],
    ["md", 1],
    ["lg", 2],
  ] as const)("orders %s at rank %s", (breakpoint, expected) => {
    expect(breakpointRank(breakpoint)).toBe(expected);
  });

  it("orders mobile below tablet below desktop", () => {
    expect(breakpointRank("sm")).toBeLessThan(breakpointRank("md"));
    expect(breakpointRank("md")).toBeLessThan(breakpointRank("lg"));
  });
});
