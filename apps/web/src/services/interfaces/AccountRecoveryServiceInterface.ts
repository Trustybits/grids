import type { AuthUser } from "@grids/contracts/auth";
import type { RequestEmailRecoveryRequest } from "@grids/contracts/types";

export interface AccountRecoveryServiceInterface {
  /** File a lost-inbox recovery request for staff review. */
  requestEmailRecovery(input: RequestEmailRecoveryRequest): Promise<void>;

  /**
   * Redeem a staff-issued recovery code and sign in with it. The resulting
   * session counts as a fresh sign-in, so a verified email change can follow.
   */
  redeemRecoveryCode(code: string): Promise<AuthUser>;
}
