import type { CloudFunctionsServiceInterface } from "../interfaces/CloudFunctionsServiceInterface";

export class MockCloudFunctionsService implements CloudFunctionsServiceInterface {
  callFunction<TRequest = unknown, TResponse = unknown>(
    _functionName: string,
    _data: TRequest,
  ): Promise<TResponse> {
    throw new Error("Method not implemented.");
  }
}
