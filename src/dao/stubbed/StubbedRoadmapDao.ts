import type {
  FetchRoadmapResult,
  NotionDatabase,
  RoadmapDao,
} from "@/dao/interfaces/RoadmapDao";
import type { RoadmapQueryFilter } from "@/types/TileContent";

export class StubbedRoadmapDao implements RoadmapDao {
  public listDatabases(
    _layoutId: string,
    _tileId: string,
  ): Promise<NotionDatabase[]> {
    throw new Error("Stubbed DAO implementation");
  }

  public fetchRoadmap(
    _layoutId: string,
    _tileId: string,
    _queryFilters?: RoadmapQueryFilter[],
    _databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult> {
    throw new Error("Stubbed DAO implementation");
  }
}
