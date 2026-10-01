import { isAuthProviderError } from "@grids/contracts/auth";

/** Landing page for email-change links (re-auth return and post-verify). */
export const CHANGE_EMAIL_PATH = "/account/change-email";
/** Public page for lost-inbox recovery (request or redeem a code). */
export const ACCOUNT_RECOVERY_PATH = "/account/recover";

/**
 * The new address an email-link user asked for, kept while they confirm their
 * identity via a link sent to their current inbox.
 */
export const PENDING_NEW_EMAIL_STORAGE_KEY = "grids.auth.pendingNewEmail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isSameEmail(a: string | null | undefined, b: string): boolean {
  return (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
}

/** Where Firebase sends the user after they open the verification link. */
export function emailChangeContinueUrl(
  origin: string = window.location.origin,
): string {
  return `${origin}${CHANGE_EMAIL_PATH}?done=1`;
}

/** Where an email-link re-auth link returns the user. */
export function emailChangeReauthUrl(
  origin: string = window.location.origin,
): string {
  return `${origin}${CHANGE_EMAIL_PATH}`;
}

export function readPendingNewEmail(): string | null {
  try {
    return window.localStorage.getItem(PENDING_NEW_EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writePendingNewEmail(email: string | null): void {
  try {
    if (email) {
      window.localStorage.setItem(PENDING_NEW_EMAIL_STORAGE_KEY, email);
    } else {
      window.localStorage.removeItem(PENDING_NEW_EMAIL_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (e.g. private mode): the in-session flow still works.
  }
}

/** User-facing copy for an email-change / re-auth failure. */
export function describeEmailChangeError(error: unknown): string {
  if (isAuthProviderError(error)) {
    switch (error.code) {
      case "email-already-in-use":
        return "That email is already used by another Grids account.";
      case "invalid-email":
        return "That doesn't look like a valid email address.";
      case "too-many-requests":
        return "Too many attempts. Please wait a few minutes and try again.";
      case "user-mismatch":
        return "That confirmation was for a different account.";
      case "invalid-link":
        return "That link is invalid or has expired. Please start again.";
      case "popup-closed":
        return "The Google window was closed before confirming.";
      case "not-signed-in":
        return "Your session has ended. Please sign in again.";
      case "requires-recent-login":
        return "Please confirm it's you first.";
      default:
        break;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
