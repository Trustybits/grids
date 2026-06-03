import type { DaoFactory } from "@grids/contracts/dao";

let instance: DaoFactory | null = null;

export function registerDaoFactory(factory: DaoFactory) {
  instance = factory;
}

export function getDaoFactory(): DaoFactory {
  if (!instance) {
    throw new Error("DaoFactory has not been registered. Call registerDaoFactory() at app startup.");
  }

  return instance;
}