/* eslint-disable */

// ---------------------------------------------------------------------------
// Dev team filter — update these lists to suppress notifications for internal
// accounts. Email patterns are matched as case-insensitive substrings.
// ---------------------------------------------------------------------------
const DEV_TEAM_USER_IDS: string[] = [
  // Add Firebase UIDs here, e.g.:
  // "abc123uid",
  "REMOVED_FIREBASE_UID"
];

const DEV_TEAM_EMAIL_PATTERNS: string[] = [
  // Add email substrings/domains here, e.g.:
  // "@yourcompany.com",
  // "+test",
  // "dev+",
  "@trustybits.com",
  "@grids.so",
];

/**
 * Returns true if the given uid or email belongs to a dev team member
 * and should be excluded from Discord notifications.
 */
export function isDevTeamMember(uid?: string, email?: string): boolean {
  if (uid && DEV_TEAM_USER_IDS.includes(uid)) {
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
