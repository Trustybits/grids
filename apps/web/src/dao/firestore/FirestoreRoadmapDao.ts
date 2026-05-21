import type { Functions } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import type { RoadmapDao } from "../interfaces/RoadmapDao";
import type { FetchRoadmapResult, NotionDatabase } from "@/types/Roadmap";
import type { RoadmapQueryFilter } from "@/types/TileContent";

export class FirestoreRoadmapDao implements RoadmapDao {
  private functions: Functions;

  public constructor(functions: Functions) {
    this.functions = functions;
  }

  public async listDatabases(
    gridId: string,
    tileId: string,
  ): Promise<NotionDatabase[]> {
    const fn = httpsCallable<unknown, { databases: NotionDatabase[] }>(
      this.functions,
      "listNotionDatabases",
    );
    const result = await fn({ layoutId: gridId, tileId });
    return result.data.databases;
  }

  public async fetchRoadmap(
    gridId: string,
    tileId: string,
    queryFilters?: RoadmapQueryFilter[],
    databaseIdOverride?: string,
  ): Promise<FetchRoadmapResult> {
    const fn = httpsCallable<unknown, FetchRoadmapResult>(
      this.functions,
      "fetchNotionRoadmap",
    );
    const result = await fn({
      layoutId: gridId,
      tileId,
      queryFilters,
      ...(databaseIdOverride ? { databaseIdOverride } : {}),
    });
    return result.data;
  }
}
