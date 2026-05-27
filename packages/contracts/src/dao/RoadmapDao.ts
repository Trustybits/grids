import type { RoadmapQueryFilter } from "../types/TileContent.js";
import type {
  FetchRoadmapResult,
  NotionDatabase,
} from "..//types/Roadmap.js";

export interface RoadmapDao {
  /** List Notion databases available to the tile's integration. */
  listDatabases(
    gridId: string,
    tileId: string,
  ): Promise<NotionDatabase[]>;

  /** Fetch roadmap items from the connected Notion database. */
  fetchRoadmap(
    gridId: string,
    tileId: string,
    queryFilters?: RoadmapQueryFilter[],
    databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult>;
}
