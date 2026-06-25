import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { RoadmapDao } from "@grids/contracts/dao";
import type {
  FetchRoadmapResult,
  NotionDatabase,
} from "@grids/contracts/types";
import type { RoadmapQueryFilter } from "@grids/contracts/types";
import type { RoadmapServiceInterface } from "./interfaces/RoadmapServiceInterface";

export class RoadmapService implements RoadmapServiceInterface {
  private roadmapDao: RoadmapDao;

  constructor() {
    const factory = getDaoFactory();
    this.roadmapDao = factory.getRoadmapDao();
  }

  async listDatabases(
    gridId: string,
    tileId: string,
  ): Promise<NotionDatabase[]> {
    return this.roadmapDao.listDatabases(gridId, tileId);
  }

  async fetchRoadmap(
    gridId: string,
    tileId: string,
    queryFilters?: RoadmapQueryFilter[],
    databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult> {
    return this.roadmapDao.fetchRoadmap(
      gridId,
      tileId,
      queryFilters,
      databaseIdOverride,
    );
  }
}
