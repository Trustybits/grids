/**
 * Free-tier storage quota in bytes (5 GB). Mirrors the server-side
 * `STORAGE_QUOTA_BYTES` used by the upload authorization callable and the
 * Storage security rules. Dev accounts (`isDevAccount`) are exempt from this
 * limit and are shown an unlimited (∞) quota instead.
 */
export const STORAGE_QUOTA_BYTES = 5_368_709_120;

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/**
 * Format a byte count as a compact human-readable string (e.g. `24 MB`,
 * `1.4 GB`). Values are rounded to at most one decimal place, and whole
 * numbers drop the decimal.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exp;
  const rounded =
    value >= 100 || Number.isInteger(value)
      ? Math.round(value)
      : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[exp]}`;
}
