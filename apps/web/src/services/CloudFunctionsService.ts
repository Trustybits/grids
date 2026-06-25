import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import type { CloudFunctionsDao } from "@grids/contracts/dao";
import type { CloudFunctionsServiceInterface } from "./interfaces/CloudFunctionsServiceInterface";

export class CloudFunctionsService implements CloudFunctionsServiceInterface {
  private cloudFunctionsDao: CloudFunctionsDao;

  constructor() {
    const factory = getDaoFactory();
    this.cloudFunctionsDao = factory.getCloudFunctionsDao();
  }

  async callFunction<TRequest = unknown, TResponse = unknown>(
    functionName: string,
    data: TRequest,
  ): Promise<TResponse> {
    return this.cloudFunctionsDao.callFunction<TRequest, TResponse>(
      functionName,
      data,
    );
  }
}
