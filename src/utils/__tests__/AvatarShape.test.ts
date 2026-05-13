import { describe, expect, it } from "vitest";
import type { ProfileBioContent } from "@/types/TileContent";
import {
  DEFAULT_AVATAR_RADIUS,
  DEFAULT_AVATAR_SHAPE,
  DEFAULT_AVATAR_SIDES,
  PROFILE_TILE_AVATAR_SIZE,
  getAvatarShapeSettings,
  getPolygonGeometry,
  getPolygonVertices,
  getRoundedPolygonPath,
  normalizePolygonSides,
  scaleAvatarRadius,
} from "@/utils/AvatarShape";

describe("getAvatarShapeSettings", () => {
  it("returns profile avatar defaults when content is missing", () => {
    expect(getAvatarShapeSettings()).toEqual({
      avatarShape: DEFAULT_AVATAR_SHAPE,
      avatarRadius: DEFAULT_AVATAR_RADIUS,
      avatarSides: DEFAULT_AVATAR_SIDES,
    });
  });

  it("preserves provided profile avatar settings", () => {
    const content = {
      avatarShape: "polygon",
      avatarRadius: 28,
      avatarSides: 5,
    } satisfies Partial<ProfileBioContent>;

    expect(getAvatarShapeSettings(content)).toEqual({
      avatarShape: "polygon",
      avatarRadius: 28,
      avatarSides: 5,
    });
  });

  it("uses defaults only for missing fields and preserves explicit zero radius", () => {
    expect(getAvatarShapeSettings({ avatarRadius: 0 })).toEqual({
      avatarShape: DEFAULT_AVATAR_SHAPE,
      avatarRadius: 0,
      avatarSides: DEFAULT_AVATAR_SIDES,
    });
  });
});

describe("scaleAvatarRadius", () => {
  it("scales a radius proportionally between avatar sizes", () => {
    expect(scaleAvatarRadius(12, PROFILE_TILE_AVATAR_SIZE, 24)).toBeCloseTo(
      1.8947,
      4,
    );
  });

  it("preserves zero and negative values without clamping", () => {
    expect(scaleAvatarRadius(0, 152, 24)).toBe(0);
    expect(scaleAvatarRadius(-4, 16, 8)).toBe(-2);
  });
});

describe("normalizePolygonSides", () => {
  it("rounds polygon side counts to whole numbers", () => {
    expect(normalizePolygonSides(4.4)).toBe(4);
    expect(normalizePolygonSides(4.5)).toBe(5);
  });

  it("clamps polygon side counts to the supported 3-8 range", () => {
    expect(normalizePolygonSides(-10)).toBe(3);
    expect(normalizePolygonSides(2)).toBe(3);
    expect(normalizePolygonSides(9)).toBe(8);
    expect(normalizePolygonSides(99)).toBe(8);
  });
});

describe("getPolygonGeometry", () => {
  it("uses cover geometry that fills the smaller polygon dimension and creates bleed", () => {
    const geometry = getPolygonGeometry({
      sides: 6,
      size: 24,
      fit: "cover",
    });

    expect(geometry.R).toBeCloseTo(13.8564, 4);
    expect(geometry.bboxW).toBeCloseTo(24, 4);
    expect(geometry.bboxH).toBeCloseTo(27.7128, 4);
    expect(geometry.bleedX).toBeCloseTo(0, 4);
    expect(geometry.bleedY).toBeCloseTo(1.8564, 4);
    expect(geometry.size).toBe(24);
  });

  it("uses contain geometry with inset so polygon vertices stay inside the box", () => {
    const geometry = getPolygonGeometry({
      sides: 6,
      size: 24,
      fit: "contain",
      inset: 0.5,
    });

    expect(geometry.R).toBeCloseTo(11.5, 4);
    expect(geometry.bboxW).toBeCloseTo(19.9186, 4);
    expect(geometry.bboxH).toBeCloseTo(23, 4);
    expect(geometry.bleedX).toBeCloseTo(0, 4);
    expect(geometry.bleedY).toBeCloseTo(0, 4);
  });

  it("normalizes side counts before computing geometry", () => {
    const triangleGeometry = getPolygonGeometry({
      sides: 2,
      size: 24,
      fit: "contain",
    });
    const eightSideGeometry = getPolygonGeometry({
      sides: 12,
      size: 24,
      fit: "contain",
    });

    expect(triangleGeometry).toEqual(
      getPolygonGeometry({ sides: 3, size: 24, fit: "contain" }),
    );
    expect(eightSideGeometry).toEqual(
      getPolygonGeometry({ sides: 8, size: 24, fit: "contain" }),
    );
  });
});

describe("getPolygonVertices", () => {
  it("returns normalized polygon vertices centered in contain geometry", () => {
    const geometry = getPolygonGeometry({
      sides: 6,
      size: 24,
      fit: "contain",
      inset: 0.5,
    });
    const vertices = getPolygonVertices(6, geometry);

    expect(vertices).toHaveLength(6);
    expect(vertices[0]).toEqual({ x: 12, y: 0.5 });
    expect(vertices[3]).toEqual({ x: 12, y: 23.5 });

    for (const vertex of vertices) {
      expect(vertex.x).toBeGreaterThanOrEqual(0.5);
      expect(vertex.x).toBeLessThanOrEqual(23.5);
      expect(vertex.y).toBeGreaterThanOrEqual(0.5);
      expect(vertex.y).toBeLessThanOrEqual(23.5);
    }
  });

  it("returns cover vertices in the expanded media box", () => {
    const geometry = getPolygonGeometry({
      sides: 6,
      size: 24,
      fit: "cover",
    });
    const vertices = getPolygonVertices(6, geometry);

    expect(vertices[0].y).toBeCloseTo(0, 4);
    expect(vertices[3].y).toBeCloseTo(27.7128, 4);
    expect(vertices[0].y - geometry.bleedY).toBeCloseTo(-1.8564, 4);
    expect(vertices[3].y - geometry.bleedY).toBeCloseTo(25.8564, 4);
  });
});

describe("getRoundedPolygonPath", () => {
  const squareVertices = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("returns an empty path for empty vertices", () => {
    expect(getRoundedPolygonPath({ vertices: [], radius: 4 })).toBe("");
  });

  it("generates a sharp-corner path when radius is effectively zero", () => {
    expect(getRoundedPolygonPath({ vertices: squareVertices, radius: 0 })).toBe(
      "M 0 0 Q 0 0 0 0 L 10 0 Q 10 0 10 0 L 10 10 Q 10 10 10 10 L 0 10 Q 0 10 0 10 Z",
    );
  });

  it("generates rounded corners and clamps radius to half the edge length", () => {
    expect(getRoundedPolygonPath({ vertices: squareVertices, radius: 99 })).toBe(
      "M 0 5 Q 0 0 5 0 L 5 0 Q 10 0 10 5 L 10 5 Q 10 10 5 10 L 5 10 Q 0 10 0 5 Z",
    );
  });

  it("can upsample a path to a fixed segment count for stable path interpolation", () => {
    const path = getRoundedPolygonPath({
      vertices: squareVertices,
      radius: 0,
      fixedSegments: 8,
    });

    expect(path.match(/[ML]/g)).toHaveLength(8);
    expect(path.match(/Q/g)).toHaveLength(8);
  });
});
