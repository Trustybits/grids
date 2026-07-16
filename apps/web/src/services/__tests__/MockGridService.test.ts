import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  type Grid,
} from "@grids/contracts/types";

vi.mock("@/utils/TileUtils", () => ({
  createTileContent: (type: string, data: Record<string, unknown>) => ({
    type,
    ...data,
  }),
  createTile: (
    type: string,
    i: string,
    x: number,
    y: number,
    w: number,
    h: number,
    content: Record<string, unknown>,
    caption: string,
  ) => ({ i, x, y, w, h, content: { type, ...content }, caption }),
}));

import { MockGridService } from "../mocks/MockGridService";

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
    ...overrides,
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("MockGridService responsive layout normalization", () => {
  it("returns an explicit griddle-v1 fixture", async () => {
    const service = new MockGridService();
    const grid = await service.fetchGrid("mock-grid-id");

    expect(grid.responsiveLayoutVersion).toBe(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );
    expect(grid.responsiveLayoutVersionStatus).toBe("supported");
  });

  it("normalizes an unstamped saved grid to griddle-v1", async () => {
    const service = new MockGridService();
    const grid = await service.saveGrid(
      makeGrid({ responsiveLayoutVersion: undefined }),
    );

    expect(grid.responsiveLayoutVersion).toBe(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );
    expect(grid.responsiveLayoutVersionStatus).toBe("missing");
  });

  it("preserves griddle-v1 when duplicating", async () => {
    const service = new MockGridService();
    const grid = await service.duplicateGrid(
      "user-2",
      makeGrid({
        responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      }),
      [],
      undefined,
    );

    expect(grid.responsiveLayoutVersion).toBe(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );
    expect(grid.responsiveLayoutVersionStatus).toBe("supported");
  });

  it("retains unsupported read status while rendering as griddle-v1", async () => {
    const service = new MockGridService();
    const grid = await service.saveGrid(
      makeGrid({
        responsiveLayoutVersion: "griddle-v2" as never,
      }),
    );

    expect(grid.responsiveLayoutVersion).toBe(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );
    expect(grid.responsiveLayoutVersionStatus).toBe("unsupported");
  });
});
