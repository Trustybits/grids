import type { ServiceFactoryInterface } from "./factory/ServiceFactoryInterface";

let instance: ServiceFactoryInterface | null = null;

export function registerServiceFactory(factory: ServiceFactoryInterface) {
  instance = factory;
}

export function getServiceFactory(): ServiceFactoryInterface {
  if (!instance) {
    throw new Error(
      "ServiceFactory has not been registered. Call registerServiceFactory() at app startup.",
    );
  }

  return instance;
}
