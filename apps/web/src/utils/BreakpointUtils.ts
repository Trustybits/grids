import type { Breakpoint } from "@grids/contracts/types";

const BREAKPOINT_RANK: Record<Breakpoint, number> = {
  sm: 0,
  md: 1,
  lg: 2,
};

export function breakpointRank(breakpoint: Breakpoint): number {
  return BREAKPOINT_RANK[breakpoint];
}
