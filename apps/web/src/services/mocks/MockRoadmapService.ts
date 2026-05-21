import type { FetchRoadmapResult, NotionDatabase } from "@/types/Roadmap";
import type { RoadmapQueryFilter } from "@/types/TileContent";
import type { IRoadmapService } from "../interfaces/IRoadmapService";

export class MockRoadmapService implements IRoadmapService {
  listDatabases(
    _gridId: string,
    _tileId: string,
  ): Promise<NotionDatabase[]> {
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
