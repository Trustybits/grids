/**
 * Compact relative time from a past instant (e.g. dashboard "updated" hints).
 */
export function formatRelativeSince(date: Date, nowMs: number = Date.now()): string {
  const diff = nowMs - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const y = date.getFullYear();
  const nowY = new Date(nowMs).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(y !== nowY ? { year: "numeric" as const } : {}),
  });
}

/**
 * Format a duration in milliseconds as a compact "{n}{unit}" string, picking
 * seconds, minutes, or hours based on magnitude. Values under 10 in the
 * minute/hour bucket get one decimal place; everything else rounds.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${minutes >= 10 ? Math.round(minutes) : minutes.toFixed(1)}m`;
  }
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`;
}
