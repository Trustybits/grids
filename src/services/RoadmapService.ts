import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { RoadmapDao } from "@/dao/interfaces/RoadmapDao";
import type { FetchRoadmapResult, NotionDatabase } from "@/types/Roadmap";
import type { RoadmapQueryFilter } from "@/types/TileContent";
import type { IRoadmapService } from "./interfaces/IRoadmapService";

export class RoadmapService implements IRoadmapService {
  private roadmapDao: RoadmapDao;

  constructor() {
    const factory = getDaoFactory();
    this.roadmapDao = factory.getRoadmapDao();
  }

  async listDatabases(
    layoutId: string,
    tileId: string,
  ): Promise<NotionDatabase[]> {
    return this.roadmapDao.listDatabases(layoutId, tileId);
  }

  async fetchRoadmap(
    layoutId: string,
    tileId: string,
    queryFilters?: RoadmapQueryFilter[],
    databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult> {
    return this.roadmapDao.fetchRoadmap(
      layoutId,
      tileId,
      queryFilters,
      databaseIdOverride,
    );
  }
}
