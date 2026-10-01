import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { AuthUser } from "@grids/contracts/auth";
import type { CloudFunctionsDao } from "@grids/contracts/dao";
import type {
  RedeemEmailRecoveryCodeRequest,
  RedeemEmailRecoveryCodeResponse,
  RequestEmailRecoveryRequest,
  RequestEmailRecoveryResponse,
} from "@grids/contracts/types";
import type { AccountRecoveryServiceInterface } from "./interfaces/AccountRecoveryServiceInterface";

export class AccountRecoveryService implements AccountRecoveryServiceInterface {
  private cloudFunctionsDao: CloudFunctionsDao;

  public constructor() {
    this.cloudFunctionsDao = getDaoFactory().getCloudFunctionsDao();
  }

  public async requestEmailRecovery(
    input: RequestEmailRecoveryRequest,
  ): Promise<void> {
    await this.cloudFunctionsDao.callFunction<
      RequestEmailRecoveryRequest,
      RequestEmailRecoveryResponse
    >("requestEmailRecovery", input);
  }

  public async redeemRecoveryCode(code: string): Promise<AuthUser> {
    const { token } = await this.cloudFunctionsDao.callFunction<
      RedeemEmailRecoveryCodeRequest,
      RedeemEmailRecoveryCodeResponse
    >("redeemEmailRecoveryCode", { code });
    return getAuthProvider().signInWithRecoveryToken(token);
  }
}
