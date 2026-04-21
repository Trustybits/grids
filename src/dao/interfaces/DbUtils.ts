export interface DbUtils {
  /** Sanitize a value before persisting (e.g. strip `undefined`). */
  sanitizeValue(value: unknown): unknown;

  /** Return a database-specific server-timestamp sentinel. */
  serverTimestamp(): unknown;
}
