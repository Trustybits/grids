import { vi } from "vitest";
import { registerDaoFactory } from "@/dao/DaoFactorySingleton";
import type { DaoFactory, DbUtils } from "@grids/contracts/dao";

const nullDao = () => null as never;

export type MockDbUtils = DbUtils & {
  sanitizeValue: ReturnType<typeof vi.fn>;
  serverTimestamp: ReturnType<typeof vi.fn>;
};

export function makeDaoFactory(overrides: Partial<DaoFactory> = {}): DaoFactory {
  return {
    getBadgeDao: nullDao,
    getAnalyticsEventDao: nullDao,
    getBusinessStatsDao: nullDao,
    getChatDao: nullDao,
    getCloudFunctionsDao: nullDao,
    getCustomerDao: nullDao,
    getGridStatsDao: nullDao,
    getGridDao: nullDao,
    getRoadmapDao: nullDao,
    getSlugDao: nullDao,
    getStorageDao: nullDao,
    getUploadArchiveDao: nullDao,
    getUpvoteDao: nullDao,
    getUserDao: nullDao,
    getUserGameDataDao: nullDao,
    ...overrides,
  };
}

export function registerTestDaoFactory(
  overrides: Partial<DaoFactory>,
): DaoFactory {
  const factory = makeDaoFactory(overrides);
  registerDaoFactory(factory);
  return factory;
}

export function makeDbUtils(overrides: Partial<DbUtils> = {}): MockDbUtils {
  return {
    sanitizeValue: vi.fn((value: unknown) => value),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    ...overrides,
  } as unknown as MockDbUtils;
}

export function mockConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

export function mockConsoleWarn() {
  return vi.spyOn(console, "warn").mockImplementation(() => {});
}
