import type { ICloudFunctionsService } from "../interfaces/ICloudFunctionsService";

export class MockCloudFunctionsService implements ICloudFunctionsService {
  callFunction<TRequest = unknown, TResponse = unknown>(
    _functionName: string,
    _data: TRequest,
  ): Promise<TResponse> {
    throw new Error("Method not implemented.");
  }
}
