import type { IServiceFactory } from "./factory/IServiceFactory";

let instance: IServiceFactory | null = null;

export function registerServiceFactory(factory: IServiceFactory) {
  instance = factory;
}

export function getServiceFactory(): IServiceFactory {
  if (!instance) {
    throw new Error(
      "ServiceFactory has not been registered. Call registerServiceFactory() at app startup.",
    );
  }

  return instance;
}
