export interface DbUtils {
  /** Sanitize a value before persisting (e.g. strip `undefined`). */
  sanitizeValue(value: unknown): unknown;

  /** Return a database-specific server-timestamp sentinel. */
  serverTimestamp(): unknown;

  /**
   * Return a database-specific sentinel that, when used as a field value in an
   * update/save payload, removes that field from the stored document. Used to
   * clear optional markers (e.g. promoting a hidden draft to a listed public
   * grid must delete its `draftOf` field, not merely blank it).
   */
  deleteField(): unknown;
}
