import type { OGConfig, OGTilePlacement } from "@/types/og";

/**
 * Applies a layout template to the OpenGraph canvas.
 *
 * For grids with many tiles (e.g. 14+), templates intentionally curate and position
 * an ideal subset of tiles (3 to 5 cards) so the social share card remains crisp,
 * legible, and never overcrowded with overlapping tiles. Remaining cards remain
 * accessible in the left "Cards & Tiles" sidebar for the user to add or swap.
 */
export function applyLayoutTemplate(
  config: OGConfig,
  templateId: string,
  availableTiles?: Array<any>,
): OGConfig {
  // Maximum capacity per template for optimal social image aesthetics
  const maxCapacity: Record<string, number> = {
    split: 4,
    hero: 3,
    center: 4,
    gallery: 5,
    orbits: 5,
  };

  const capacity = maxCapacity[templateId] ?? 4;

  let baseTiles: OGTilePlacement[] = [...config.tiles];

  // If no tiles are placed yet on canvas, automatically take the top N tiles from the grid:
  if (baseTiles.length === 0 && availableTiles && availableTiles.length > 0) {
    baseTiles = availableTiles.slice(0, capacity).map((t) => ({
      tileId: t.i ?? t.id ?? "",
      x: 50,
      y: 50,
      rotation: 0,
      scale: 1,
      opacity: 1,
    }));
  }

  // Ensure we curate only up to capacity to prevent stacking & overcrowding with 14+ tiles
  const selectedTiles = baseTiles.slice(0, capacity);
  const count = selectedTiles.length;
  if (!count) return { ...config, layoutTemplate: templateId };

  let updatedPlacements: OGTilePlacement[] = [];

  switch (templateId) {
    case "split": {
      // 2x2 grid on right half (x: 63% & 85%, y: 32% & 68%) with safe margins
      const positions = [
        { x: 65, y: 32, rot: 0, scale: 0.95 },
        { x: 85, y: 32, rot: 0, scale: 0.95 },
        { x: 65, y: 68, rot: 0, scale: 0.95 },
        { x: 85, y: 68, rot: 0, scale: 0.95 },
      ];
      if (count === 1) {
        updatedPlacements = [{ ...selectedTiles[0], x: 75, y: 50, rotation: 0, scale: 1.05 }];
      } else if (count === 2) {
        updatedPlacements = [
          { ...selectedTiles[0], x: 75, y: 33, rotation: 0, scale: 0.98 },
          { ...selectedTiles[1], x: 75, y: 67, rotation: 0, scale: 0.98 },
        ];
      } else if (count === 3) {
        updatedPlacements = [
          { ...selectedTiles[0], x: 65, y: 50, rotation: 0, scale: 0.98 },
          { ...selectedTiles[1], x: 85, y: 33, rotation: 0, scale: 0.92 },
          { ...selectedTiles[2], x: 85, y: 67, rotation: 0, scale: 0.92 },
        ];
      } else {
        updatedPlacements = selectedTiles.slice(0, 4).map((t, i) => {
          const pos = positions[i];
          return {
            ...t,
            x: pos.x,
            y: pos.y,
            rotation: pos.rot,
            scale: pos.scale,
          };
        });
      }
      break;
    }

    case "hero": {
      // 1 prominent hero card + up to 2 secondary accents
      if (count === 1) {
        updatedPlacements = [{ ...selectedTiles[0], x: 68, y: 50, rotation: 0, scale: 1.15 }];
      } else if (count === 2) {
        updatedPlacements = [
          { ...selectedTiles[0], x: 60, y: 50, rotation: 0, scale: 1.15 },
          { ...selectedTiles[1], x: 85, y: 50, rotation: 2, scale: 0.88 },
        ];
      } else {
        updatedPlacements = [
          { ...selectedTiles[0], x: 58, y: 50, rotation: 0, scale: 1.15 },
          { ...selectedTiles[1], x: 85, y: 32, rotation: 2, scale: 0.85 },
          { ...selectedTiles[2], x: 85, y: 68, rotation: -2, scale: 0.85 },
        ];
      }
      break;
    }

    case "gallery": {
      // Horizontal showcase row along upper-mid (y: 35%), keeping cards comfortably inside bounds
      const step = Math.min(18, 68 / Math.max(1, count));
      const startX = 50 - ((count - 1) * step) / 2;
      updatedPlacements = selectedTiles.slice(0, 5).map((t, i) => ({
        ...t,
        x: Number((startX + i * step).toFixed(1)),
        y: 35,
        rotation: 0,
        scale: 0.92,
      }));
      break;
    }

    case "orbits": {
      // Orbiting around center safezone with gentle, natural tilts
      const baseAngles = [-5, 6, -4, 5, -6];
      const positions = [
        { x: 17, y: 30 },
        { x: 83, y: 30 },
        { x: 83, y: 70 },
        { x: 17, y: 70 },
        { x: 50, y: 84 },
      ];
      updatedPlacements = selectedTiles.slice(0, 5).map((t, i) => ({
        ...t,
        x: positions[i].x,
        y: positions[i].y,
        rotation: baseAngles[i],
        scale: 0.92,
      }));
      break;
    }

    case "center":
    default: {
      // Classic center stage: cards symmetrically proportioned in left and right wings
      if (count === 1) {
        updatedPlacements = [{ ...selectedTiles[0], x: 15, y: 50, rotation: 0, scale: 1.05 }];
      } else if (count === 2) {
        updatedPlacements = [
          { ...selectedTiles[0], x: 15, y: 50, rotation: 0, scale: 0.98 },
          { ...selectedTiles[1], x: 85, y: 50, rotation: 0, scale: 0.98 },
        ];
      } else if (count === 3) {
        updatedPlacements = [
          { ...selectedTiles[0], x: 15, y: 34, rotation: 0, scale: 0.92 },
          { ...selectedTiles[1], x: 15, y: 66, rotation: 0, scale: 0.92 },
          { ...selectedTiles[2], x: 85, y: 50, rotation: 0, scale: 0.95 },
        ];
      } else {
        updatedPlacements = [
          { ...selectedTiles[0], x: 15, y: 33, rotation: 0, scale: 0.92 },
          { ...selectedTiles[1], x: 15, y: 67, rotation: 0, scale: 0.92 },
          { ...selectedTiles[2], x: 85, y: 33, rotation: 0, scale: 0.92 },
          { ...selectedTiles[3], x: 85, y: 67, rotation: 0, scale: 0.92 },
        ];
      }
      break;
    }
  }

  return {
    ...config,
    tiles: updatedPlacements,
    layoutTemplate: templateId,
  };
}
