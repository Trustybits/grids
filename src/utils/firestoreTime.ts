/**
 * Normalize Firestore Timestamp-like values (and Dates) for the client.
 */

export function firestoreValueToDate(value: unknown): Date | null {
  if (value == null) return null;
  try {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === "function") {
      return maybe.toDate();
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
export function firestoreValueToMillis(value: unknown): number {
  const d = firestoreValueToDate(value);
  if (d) return d.getTime();
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  return 0;
}
