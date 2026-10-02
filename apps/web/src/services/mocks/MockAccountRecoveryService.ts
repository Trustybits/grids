import type { AuthUser } from "@grids/contracts/auth";
import type { RequestEmailRecoveryRequest } from "@grids/contracts/types";
import type { AccountRecoveryServiceInterface } from "../interfaces/AccountRecoveryServiceInterface";

export class MockAccountRecoveryService implements AccountRecoveryServiceInterface {
  requestEmailRecovery(_input: RequestEmailRecoveryRequest): Promise<void> {
    throw new Error("Method not implemented.");
  }

  redeemRecoveryCode(_code: string): Promise<AuthUser> {
    throw new Error("Method not implemented.");
  }
}
