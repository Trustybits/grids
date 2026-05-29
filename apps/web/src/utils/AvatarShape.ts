import type { AvatarShape, ProfileBioContent } from "@grids/contracts/types";

export const DEFAULT_AVATAR_SHAPE: AvatarShape = "square";
export const DEFAULT_AVATAR_RADIUS = 12;
export const DEFAULT_AVATAR_SIDES = 6;
export const PROFILE_TILE_AVATAR_SIZE = 152;

const MIN_POLYGON_SIDES = 3;
const MAX_POLYGON_SIDES = 8;

export interface AvatarShapeSettings {
  avatarShape: AvatarShape;
  avatarRadius: number;
  avatarSides: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PolygonGeometry {
  R: number;
  bboxW: number;
  bboxH: number;
  bleedX: number;
  bleedY: number;
  bboxOffsetX: number;
  bboxOffsetY: number;
  size: number;
  unitCenterX: number;
  unitCenterY: number;
}

export const getAvatarShapeSettings = (
  content?: Partial<ProfileBioContent>,
): AvatarShapeSettings => ({
  avatarShape: content?.avatarShape || DEFAULT_AVATAR_SHAPE,
  avatarRadius: content?.avatarRadius ?? DEFAULT_AVATAR_RADIUS,
  avatarSides: content?.avatarSides ?? DEFAULT_AVATAR_SIDES,
});

export const scaleAvatarRadius = (
  radius: number,
  sourceSize: number,
  targetSize: number,
) => (radius / sourceSize) * targetSize;

export const normalizePolygonSides = (sides: number) =>
  Math.min(MAX_POLYGON_SIDES, Math.max(MIN_POLYGON_SIDES, Math.round(sides)));

const getUnitPolygonPoints = (sides: number): Point[] => {
  const normalizedSides = normalizePolygonSides(sides);
  return Array.from({ length: normalizedSides }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / normalizedSides;
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
  });
};

export const getPolygonGeometry = ({
  sides,
  size,
  fit,
  inset = 0,
}: {
  sides: number;
  size: number;
  fit: "cover" | "contain";
  inset?: number;
}): PolygonGeometry => {
  const unitPoints = getUnitPolygonPoints(sides);
  const minX = Math.min(...unitPoints.map((point) => point.x));
  const maxX = Math.max(...unitPoints.map((point) => point.x));
  const minY = Math.min(...unitPoints.map((point) => point.y));
  const maxY = Math.max(...unitPoints.map((point) => point.y));
  const unitW = maxX - minX;
  const unitH = maxY - minY;
  const unitCenterX = (minX + maxX) / 2;
  const unitCenterY = (minY + maxY) / 2;
  const scaleBase = fit === "cover" ? Math.min(unitW, unitH) : Math.max(unitW, unitH);
  const R = (size - inset * 2) / scaleBase;
  const bboxW = unitW * R;
  const bboxH = unitH * R;
  const bleedX = Math.max(0, (bboxW - size) / 2);
  const bleedY = Math.max(0, (bboxH - size) / 2);
  const bboxOffsetX = unitCenterX * R;
  const bboxOffsetY = unitCenterY * R;

  return {
    R,
    bboxW,
    bboxH,
    bleedX,
    bleedY,
    bboxOffsetX,
    bboxOffsetY,
    size,
    unitCenterX,
    unitCenterY,
  };
};

export const getPolygonVertices = (
  sides: number,
  geometry: PolygonGeometry,
): Point[] => {
  const unitPoints = getUnitPolygonPoints(sides);
  const cx = geometry.size / 2 + geometry.bleedX - geometry.bboxOffsetX;
  const cy = geometry.size / 2 + geometry.bleedY - geometry.bboxOffsetY;

  return unitPoints.map((point) => ({
    x: cx + geometry.R * point.x,
    y: cy + geometry.R * point.y,
  }));
};

export const getRoundedPolygonPath = ({
  vertices,
  radius,
  fixedSegments,
}: {
  vertices: Point[];
  radius: number;
  fixedSegments?: number;
}) => {
  if (vertices.length === 0) return "";

  const points =
    fixedSegments && fixedSegments > vertices.length
      ? getFixedSegmentPoints(vertices, fixedSegments)
      : vertices.map((vertex, index) => ({
          ...vertex,
          isVertex: true,
          vertexIdx: index,
        }));

  let path = "";
  const pointCount = points.length;

  for (let index = 0; index < pointCount; index++) {
    const current = points[index];

    if (current.isVertex) {
      const previous = vertices[
        (current.vertexIdx - 1 + vertices.length) % vertices.length
      ];
      const next = vertices[(current.vertexIdx + 1) % vertices.length];
      const prevVector = {
        x: previous.x - current.x,
        y: previous.y - current.y,
      };
      const nextVector = {
        x: next.x - current.x,
        y: next.y - current.y,
      };
      const prevLength = Math.hypot(prevVector.x, prevVector.y);
      const nextLength = Math.hypot(nextVector.x, nextVector.y);
      const offset = Math.min(radius, prevLength / 2, nextLength / 2);

      if (offset < 0.1 || prevLength === 0 || nextLength === 0) {
        path += `${index === 0 ? "M" : "L"} ${current.x} ${current.y} `;
        path += `Q ${current.x} ${current.y} ${current.x} ${current.y} `;
      } else {
        const start = {
          x: current.x + (prevVector.x / prevLength) * offset,
          y: current.y + (prevVector.y / prevLength) * offset,
        };
        const end = {
          x: current.x + (nextVector.x / nextLength) * offset,
          y: current.y + (nextVector.y / nextLength) * offset,
        };
        path += `${index === 0 ? "M" : "L"} ${start.x} ${start.y} `;
        path += `Q ${current.x} ${current.y} ${end.x} ${end.y} `;
      }
    } else {
      path += `${index === 0 ? "M" : "L"} ${current.x} ${current.y} `;
      path += `Q ${current.x} ${current.y} ${current.x} ${current.y} `;
    }
  }

  return `${path}Z`;
};

const getFixedSegmentPoints = (vertices: Point[], fixedSegments: number) => {
  const points: Array<Point & { isVertex: boolean; vertexIdx: number }> = [];
  const perEdge = Math.floor(fixedSegments / vertices.length);
  let remainder = fixedSegments - perEdge * vertices.length;

  for (let index = 0; index < vertices.length; index++) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const segments = perEdge + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    for (let segment = 0; segment < segments; segment++) {
      const t = segment / segments;
      points.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
        isVertex: segment === 0,
        vertexIdx: index,
      });
    }
  }

  return points;
};
