import type { Functions } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import type {
  FetchRoadmapResult,
  NotionDatabase,
  RoadmapDao,
} from "../interfaces/RoadmapDao";
import type { RoadmapQueryFilter } from "@/types/TileContent";

export class FirestoreRoadmapDao implements RoadmapDao {
  private functions: Functions;

  public constructor(functions: Functions) {
    this.functions = functions;
  }

  public async listDatabases(
    layoutId: string,
    tileId: string,
  ): Promise<NotionDatabase[]> {
    const fn = httpsCallable<unknown, { databases: NotionDatabase[] }>(
      this.functions,
      "listNotionDatabases",
    );
    const result = await fn({ layoutId, tileId });
    return result.data.databases;
  }

  public async fetchRoadmap(
    layoutId: string,
    tileId: string,
    queryFilters?: RoadmapQueryFilter[],
    databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult> {
    const fn = httpsCallable<unknown, FetchRoadmapResult>(
      this.functions,
      "fetchNotionRoadmap",
    );
    const result = await fn({
      layoutId,
      tileId,
      queryFilters,
      ...(databaseIdOverride ? { databaseIdOverride } : {}),
    });
    return result.data;
  }
}
