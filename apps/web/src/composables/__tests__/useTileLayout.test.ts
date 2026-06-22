/**
 * Tests for useTileLayout — maps a tile's injected w/h dimensions onto a
 * structural layout config (tier, orientation, element visibility flags).
 *
 * The composable reads gridTileW / gridTileH via inject, so each case mounts a
 * tiny component that provides those computed refs, then reads the returned
 * computed layout. Covers tier boundaries, orientation, the row-layout shape
 * rules, and the inject-missing default (2×2).
 */

import { describe, it, expect } from "vitest";
import { computed, defineComponent, h as createElement } from "vue";
import { mount } from "@vue/test-utils";
import {
  useTileLayout,
  type TileLayoutConfig,
} from "@/composables/useTileLayout";

/** Mount the composable with provided w/h and return its resolved config. */
function layoutFor(
  w: number | undefined,
  h: number | undefined,
): TileLayoutConfig {
  let captured: { value: TileLayoutConfig } | null = null;

  const provides: Record<string, unknown> = {};
  if (w !== undefined) provides.gridTileW = computed(() => w);
  if (h !== undefined) provides.gridTileH = computed(() => h);

  mount(
    defineComponent({
      setup() {
        captured = useTileLayout();
        return () => createElement("div");
      },
    }),
    { global: { provide: provides } },
  );

  return captured!.value;
}

describe("tier resolution", () => {
  it("1×1 (area 1) is mini", () => {
    expect(layoutFor(1, 1).tier).toBe("mini");
  });

  it("2×2 (area 4) is compact", () => {
    expect(layoutFor(2, 2).tier).toBe("compact");
  });

  it("3×3 (area 9) is medium", () => {
    expect(layoutFor(3, 3).tier).toBe("medium");
  });

  it("area > 9 is large", () => {
    expect(layoutFor(4, 4).tier).toBe("large");
  });

  it("treats area 4 as the compact/medium boundary", () => {
    expect(layoutFor(1, 4).tier).toBe("compact");
    expect(layoutFor(1, 5).tier).toBe("medium");
  });
});

describe("orientation", () => {
  it("equal dimensions are square", () => {
    expect(layoutFor(3, 3).orientation).toBe("square");
  });

  it("wider than tall is landscape", () => {
    expect(layoutFor(4, 2).orientation).toBe("landscape");
  });

  it("taller than wide is portrait", () => {
    expect(layoutFor(2, 4).orientation).toBe("portrait");
  });
});

describe("mini tier (1×1)", () => {
  it("shows only the thumbnail at default quality", () => {
    const c = layoutFor(1, 1);
    expect(c.showThumbnail).toBe(true);
    expect(c.showTitle).toBe(false);
    expect(c.thumbnailQuality).toBe("default");
    expect(c.useRowLayout).toBe(false);
  });
});

describe("compact tier", () => {
  it("shows the title when tall enough (h ≥ 2)", () => {
    expect(layoutFor(2, 2).showTitle).toBe(true);
  });

  it("shows the title when wide enough (w ≥ 3)", () => {
    expect(layoutFor(3, 1).showTitle).toBe(true);
  });

  it("hides the title for a small 2×1 tile", () => {
    expect(layoutFor(2, 1).showTitle).toBe(false);
  });

  it("uses a row layout for wide banner shapes (w ≥ 3, h = 1)", () => {
    expect(layoutFor(3, 1).useRowLayout).toBe(true);
  });

  it("uses default thumbnail quality", () => {
    expect(layoutFor(2, 2).thumbnailQuality).toBe("default");
  });
});

describe("medium tier", () => {
  it("shows title, channel, and duration at medium quality", () => {
    const c = layoutFor(3, 3);
    expect(c.showTitle).toBe(true);
    expect(c.showChannel).toBe(true);
    expect(c.showDuration).toBe(true);
    expect(c.thumbnailQuality).toBe("medium");
    expect(c.titleLineClamp).toBe(2);
  });

  it("uses a row layout with single-line title for wide medium tiles (w ≥ 3, h ≤ 2)", () => {
    const c = layoutFor(4, 2);
    expect(c.useRowLayout).toBe(true);
    expect(c.titleLineClamp).toBe(1);
  });

  it("does not show the channel avatar (reserved for large)", () => {
    expect(layoutFor(3, 3).showChannelAvatar).toBe(false);
  });
});

describe("large tier", () => {
  it("shows channel avatar and high-quality thumbnail", () => {
    const c = layoutFor(4, 4);
    expect(c.showChannelAvatar).toBe(true);
    expect(c.thumbnailQuality).toBe("high");
  });

  it("shows stats only when h ≥ 4", () => {
    expect(layoutFor(5, 3).showStats).toBe(false);
    expect(layoutFor(4, 4).showStats).toBe(true);
  });

  it("shows description only when h ≥ 5", () => {
    expect(layoutFor(4, 4).showDescription).toBe(false);
    expect(layoutFor(4, 5).showDescription).toBe(true);
  });
});

describe("inject defaults", () => {
  it("defaults to a 2×2 compact layout when w/h are not provided", () => {
    const c = layoutFor(undefined, undefined);
    expect(c.w).toBe(2);
    expect(c.h).toBe(2);
    expect(c.tier).toBe("compact");
  });
});
