/**
 * Lost-inbox account recovery. A user who can no longer receive mail at their
 * account email files a request; after staff verify their identity out of
 * band, staff issue a one-time recovery code that stands in for
 * re-authentication so the user can start a verified email change.
 */

export interface RequestEmailRecoveryRequest {
  /** The account email the user can no longer access (required when signed out). */
  lostEmail?: string;
  /** The address the user wants to switch to. */
  requestedEmail: string;
  /** How staff can reach the user, e.g. a Discord username. */
  contact: string;
  /** Anything that helps prove ownership (handle, grid names, what they built). */
  details: string;
}

export interface RequestEmailRecoveryResponse {
  /** Always true: the response never reveals whether an account exists. */
  ok: true;
}

export interface RedeemEmailRecoveryCodeRequest {
  code: string;
}

export interface RedeemEmailRecoveryCodeResponse {
  /** One-time sign-in token for the account the code was issued to. */
  token: string;
}
