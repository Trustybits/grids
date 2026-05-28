import type { DbUtils } from "@grids/contracts/dao";

let instance: DbUtils | null = null;

export function registerDbUtils(utils: DbUtils) {
  instance = utils;
}

export function getDbUtils(): DbUtils {
  if (!instance) {
    throw new Error("DbUtils has not been registered. Call registerDbUtils() at app startup.");
  }

  return instance;
}
