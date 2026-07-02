import type { Grid } from "../types/Grid.js";

export class GridRevisionConflictError extends Error {
  public readonly code = "grid-revision-conflict";

  public constructor(
    public readonly gridId: string,
    public readonly expectedRev: number,
    public readonly actualRev: number,
    public readonly latestGrid: Grid | null = null,
  ) {
    super(
      `Grid ${gridId} has revision ${actualRev}; expected ${expectedRev}.`,
    );
    this.name = "GridRevisionConflictError";
  }
}

export function isGridRevisionConflictError(
  error: unknown,
): error is GridRevisionConflictError {
  return (
    error instanceof GridRevisionConflictError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "grid-revision-conflict")
  );
}

export interface GridDao {
  /** Fetch a single grid document by ID. */
  getById(id: string): Promise<Grid | null>;

  /** Query all grids belonging to a specific user. */
  findByUserId(userId: string): Promise<Grid[]>;

  /** Generate a new unique document ID without writing to the database. */
  generateId(): string;

  /** Create or fully overwrite a grid document. */
  save(
    id: string,
    data: Record<string, unknown>,
    expectedRev?: number,
  ): Promise<void>;

  /** Partially update fields on an existing grid document. */
  update(
    id: string,
    data: Record<string, unknown>,
    expectedRev?: number,
  ): Promise<void>;

  /** Update only the lastOpenedAt field to a server timestamp. */
  updateLastOpenedAt(id: string): Promise<void>;

  /** Delete a grid document by ID. */
  delete(id: string): Promise<void>;
}
