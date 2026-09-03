import type { OGConfig, OGTilePlacement } from "@/types/og";

export function applyLayoutTemplate(config: OGConfig, templateId: string): OGConfig {
  const tiles = [...config.tiles];
  const count = tiles.length;
  if (!count) return { ...config, layoutTemplate: templateId };

  let updatedPlacements: OGTilePlacement[] = [];

  switch (templateId) {
    case "split": {
      // 2x2 grid on right side
      const positions = [
        { x: 62, y: 32, rot: 0, scale: 0.95 },
        { x: 82, y: 32, rot: 0, scale: 0.95 },
        { x: 62, y: 68, rot: 0, scale: 0.95 },
        { x: 82, y: 68, rot: 0, scale: 0.95 },
        { x: 72, y: 50, rot: -4, scale: 0.9 },
      ];
      updatedPlacements = tiles.map((t, i) => {
        const pos = positions[i % positions.length];
        return {
          ...t,
          x: pos.x,
          y: pos.y,
          rotation: pos.rot,
          scale: pos.scale,
        };
      });
      break;
    }

    case "hero": {
      // Large hero card + smaller side accents
      updatedPlacements = tiles.map((t, i) => {
        if (i === 0) {
          return { ...t, x: 58, y: 50, rotation: 0, scale: 1.35 };
        }
        if (i === 1) {
          return { ...t, x: 86, y: 32, rotation: 4, scale: 0.85 };
        }
        if (i === 2) {
          return { ...t, x: 86, y: 68, rotation: -4, scale: 0.85 };
        }
        return { ...t, x: 16 + (i * 12) % 30, y: 75, rotation: 0, scale: 0.75 };
      });
      break;
    }

    case "gallery": {
      // Horizontal row along center-top, branding at bottom
      const spacing = 70 / Math.max(1, count);
      updatedPlacements = tiles.map((t, i) => ({
        ...t,
        x: 15 + i * spacing + spacing / 2,
        y: 42,
        rotation: 0,
        scale: 0.9,
      }));
      break;
    }

    case "orbits": {
      // Orbiting around center with gentle tilts
      const baseAngles = [-8, 10, -6, 8, -12, 14];
      const positions = [
        { x: 16, y: 28 },
        { x: 84, y: 28 },
        { x: 84, y: 72 },
        { x: 16, y: 72 },
        { x: 50, y: 18 },
        { x: 50, y: 82 },
      ];
      updatedPlacements = tiles.map((t, i) => ({
        ...t,
        x: positions[i % positions.length].x,
        y: positions[i % positions.length].y,
        rotation: baseAngles[i % baseAngles.length],
        scale: 1,
      }));
      break;
    }

    case "center":
    default: {
      // Classic center stage: left and right wings
      const leftPositions = [
        { x: 14, y: 32 },
        { x: 14, y: 68 },
        { x: 22, y: 50 },
      ];
      const rightPositions = [
        { x: 86, y: 32 },
        { x: 86, y: 68 },
        { x: 78, y: 50 },
      ];
      updatedPlacements = tiles.map((t, i) => {
        const isLeft = i % 2 === 0;
        const index = Math.floor(i / 2);
        const pos = isLeft
          ? leftPositions[index % leftPositions.length]
          : rightPositions[index % rightPositions.length];
        return {
          ...t,
          x: pos.x,
          y: pos.y,
          rotation: 0,
          scale: 1,
        };
      });
      break;
    }
  }

  return {
    ...config,
    tiles: updatedPlacements,
    layoutTemplate: templateId,
  };
}
