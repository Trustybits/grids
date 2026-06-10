// ---------------------------------------------------------------------------
// Dev team filter — suppresses notifications for internal accounts.
//
// The UID list is private (it identifies internal accounts), so it is supplied
// at runtime via the DEV_TEAM_USER_IDS env var (a comma-separated list) rather
// than hardcoded here — keeping it out of the open-source repo. When the var is
// absent (e.g. an OSS checkout or emulator run) the list is empty and no UID is
// suppressed, which is harmless. Email patterns are matched as case-insensitive
// substrings and stay in source since they are public company domains.
// ---------------------------------------------------------------------------
const DEV_TEAM_EMAIL_PATTERNS: string[] = [
  "@trustybits.com",
  "@grids.so",
];

/** Parse a comma-separated env value into a trimmed, non-empty string list. */
function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Returns true if the given uid or email belongs to a dev team member
 * and should be excluded from Discord notifications.
 */
export function isDevTeamMember(uid?: string, email?: string): boolean {
  const devTeamUserIds = parseList(process.env.DEV_TEAM_USER_IDS);
  if (uid && devTeamUserIds.includes(uid)) {
    return true;
  }
  if (email) {
    const lower = email.toLowerCase();
    if (DEV_TEAM_EMAIL_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()))) {
      return true;
    }
  }
  return false;
}
