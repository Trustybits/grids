import type { TileContent, ContentType } from "@/types/TileContent";
import type { TileCategory, TileDefinition } from "@/types/TileDefinition";

const registry = new Map<ContentType, TileDefinition>();

export function registerTile<T extends TileContent>(
  def: TileDefinition<T>,
): void {
  registry.set(def.type, def as TileDefinition);
}

export function getTileDefinition(
  type: ContentType,
): TileDefinition | undefined {
  return registry.get(type);
}

export function getAllTileDefinitions(): TileDefinition[] {
  return Array.from(registry.values());
}

export function getTilesByCategory(category: TileCategory): TileDefinition[] {
  return getAllTileDefinitions().filter((def) => def.category === category);
}

/**
 * Given a URL (from paste or embed input), find the first tile definition
 * whose `matchUrl` returns true. Returns undefined if no tile claims the URL.
 */
export function matchUrlToTileType(url: string): TileDefinition | undefined {
  for (const def of registry.values()) {
    if (def.matchUrl?.(url)) return def;
  }
  return undefined;
}
