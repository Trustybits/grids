import type { CloudFunctionsDao } from "@/dao/interfaces/CloudFunctionsDao";

export class StubbedCloudFunctionsDao implements CloudFunctionsDao {
  public callFunction<TRequest = unknown, TResponse = unknown>(
    _functionName: string,
    _data: TRequest,
  ): Promise<TResponse> {
    throw new Error("Stubbed DAO implementation");
  }
}
