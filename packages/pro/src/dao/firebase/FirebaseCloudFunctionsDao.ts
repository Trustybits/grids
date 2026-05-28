import type { Functions } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import type { CloudFunctionsDao } from "@grids/contracts/dao";

export class FirebaseCloudFunctionsDao implements CloudFunctionsDao {
  private functions: Functions;

  public constructor(functions: Functions) {
    this.functions = functions;
  }

  public async callFunction<TRequest = unknown, TResponse = unknown>(
    functionName: string,
    data: TRequest,
  ): Promise<TResponse> {
    const fn = httpsCallable<TRequest, TResponse>(
      this.functions,
      functionName,
    );
    const result = await fn(data);
    return result.data;
  }
}
