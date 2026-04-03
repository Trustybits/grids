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
