import type { RoadmapQueryFilter } from "@grids/contracts/types";
import type {
  FetchRoadmapResult,
  NotionDatabase,
} from "@grids/contracts/types";

export interface RoadmapServiceInterface {
  /** List Notion databases available to the tile's integration. */
  listDatabases(gridId: string, tileId: string): Promise<NotionDatabase[]>;

  /** Fetch roadmap items from the connected Notion database. */
  fetchRoadmap(
    gridId: string,
    tileId: string,
    queryFilters?: RoadmapQueryFilter[],
    databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult>;
}
