import type { Grid } from "@grids/contracts/types";

export interface GridPersistenceScope {
  gridId: string;
  sessionGeneration: number;
}

export interface GridPersistenceSchedulerInterface {
  schedule(scope: GridPersistenceScope, snapshot: Grid): void;
  flush(scope: GridPersistenceScope): Promise<Grid | null>;
}
