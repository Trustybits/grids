import type { RoadmapDao } from "@/dao/interfaces/RoadmapDao";
import type { FetchRoadmapResult, NotionDatabase } from "@/types/Roadmap";
import type { RoadmapQueryFilter } from "@/types/TileContent";

export class StubbedRoadmapDao implements RoadmapDao {
  public listDatabases(
    _gridId: string,
    _tileId: string,
  ): Promise<NotionDatabase[]> {
    throw new Error("Stubbed DAO implementation");
  }

  public fetchRoadmap(
    _gridId: string,
    _tileId: string,
    _queryFilters?: RoadmapQueryFilter[],
    _databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult> {
    throw new Error("Stubbed DAO implementation");
  }
}
