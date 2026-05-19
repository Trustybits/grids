import type { RoadmapQueryFilter } from "@/types/TileContent";
import type { FetchRoadmapResult, NotionDatabase } from "@/types/Roadmap";

export interface IRoadmapService {
  /** List Notion databases available to the tile's integration. */
  listDatabases(
    layoutId: string,
    tileId: string,
  ): Promise<NotionDatabase[]>;

  /** Fetch roadmap items from the connected Notion database. */
  fetchRoadmap(
    layoutId: string,
    tileId: string,
    queryFilters?: RoadmapQueryFilter[],
    databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult>;
}
