import type { Layout } from "@/types/Layout";

export interface LayoutDao {
  /** Fetch a single layout document by ID. */
  getById(id: string): Promise<Layout | null>;

  /** Query all layouts belonging to a specific user. */
  findByUserId(userId: string): Promise<Layout[]>;

  /** Generate a new unique document ID without writing to the database. */
  generateId(): string;

  /** Create or fully overwrite a layout document. */
  save(id: string, data: Record<string, unknown>): Promise<void>;

  /** Partially update fields on an existing layout document. */
  update(id: string, data: Record<string, unknown>): Promise<void>;

  /** Update only the lastOpenedAt field to a server timestamp. */
  updateLastOpenedAt(id: string): Promise<void>;

  /** Delete a layout document by ID. */
  delete(id: string): Promise<void>;
}
