import type {
  FetchRoadmapResult,
  NotionDatabase,
} from "@grids/contracts/types";
import type { RoadmapQueryFilter } from "@grids/contracts/types";
import type { RoadmapServiceInterface } from "../interfaces/RoadmapServiceInterface";

export class MockRoadmapService implements RoadmapServiceInterface {
  listDatabases(_gridId: string, _tileId: string): Promise<NotionDatabase[]> {
    throw new Error("Method not implemented.");
  }

  fetchRoadmap(
    _gridId: string,
    _tileId: string,
    _queryFilters?: RoadmapQueryFilter[],
    _databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult> {
    throw new Error("Method not implemented.");
  }
}
