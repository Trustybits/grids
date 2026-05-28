import type { RoadmapDao } from "@grids/contracts/dao";
import type { FetchRoadmapResult, NotionDatabase } from "@grids/contracts/types";
import type { RoadmapQueryFilter } from "@grids/contracts/types";

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
