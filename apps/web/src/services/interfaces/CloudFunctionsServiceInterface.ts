export interface CloudFunctionsServiceInterface {
  callFunction<TRequest = unknown, TResponse = unknown>(
    functionName: string,
    data: TRequest,
  ): Promise<TResponse>;
}
