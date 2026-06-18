/**
 * Normalize Timestamp-like values (and Dates) for the client.
 */

export function valueToDate(value: unknown): Date | null {
  if (value == null) return null;
  try {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === "function") {
      const d = maybe.toDate();
      // Only trust the result if it's actually a valid Date. A Timestamp-like
      // whose toDate() returns a non-Date or an invalid Date falls through to
      // the checks below (and ultimately null) rather than leaking a bad value.
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return d;
      }
    }
  } catch {
    /* ignore */
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  return null;
}

/** Milliseconds since epoch; supports Timestamp, Date, or numeric ms. */
export function valueToMillis(value: unknown): number {
  const d = valueToDate(value);
  if (d) return d.getTime();
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  return 0;
}
