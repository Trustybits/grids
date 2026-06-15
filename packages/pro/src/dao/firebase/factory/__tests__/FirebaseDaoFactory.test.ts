/**
 * Unit tests for FirebaseDaoFactory
 *
 * Covers:
 *  - constructor wiring: each DAO class is constructed exactly once with the
 *    injected db / functions / storage / beacon URL it needs
 *  - getters: each getter returns the constructed instance, stable across calls
 *
 * All DAO modules are mocked — the factory's wiring is the unit under test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Firestore } from "firebase/firestore";
import type { Functions } from "firebase/functions";
import type { FirebaseStorage } from "firebase/storage";
import { FirebaseDaoFactory } from "../FirebaseDaoFactory.js";
import { FirebaseBadgeDao } from "../../FirebaseBadgeDao.js";
import { FirebaseAnalyticsEventDao } from "../../FirebaseAnalyticsEventDao.js";
import { FirebaseBusinessStatsDao } from "../../FirebaseBusinessStatsDao.js";
import { FirebaseChatDao } from "../../FirebaseChatDao.js";
import { FirebaseCloudFunctionsDao } from "../../FirebaseCloudFunctionsDao.js";
import { FirebaseCustomerDao } from "../../FirebaseCustomerDao.js";
import { FirebaseGridStatsDao } from "../../FirebaseGridStatsDao.js";
import { FirebaseGridDao } from "../../FirebaseGridDao.js";
import { FirebaseRoadmapDao } from "../../FirebaseRoadmapDao.js";
import { FirebaseSlugDao } from "../../FirebaseSlugDao.js";
import { FirebaseStorageDao } from "../../FirebaseStorageDao.js";
import { FirebaseUpvoteDao } from "../../FirebaseUpvoteDao.js";
import { FirebaseUserDao } from "../../FirebaseUserDao.js";
import { FirebaseUserGameDataDao } from "../../FirebaseUserGameDataDao.js";

vi.mock("../../FirebaseBadgeDao.js", () => ({ FirebaseBadgeDao: vi.fn() }));
vi.mock("../../FirebaseAnalyticsEventDao.js", () => ({
  FirebaseAnalyticsEventDao: vi.fn(),
}));
vi.mock("../../FirebaseBusinessStatsDao.js", () => ({
  FirebaseBusinessStatsDao: vi.fn(),
}));
vi.mock("../../FirebaseChatDao.js", () => ({ FirebaseChatDao: vi.fn() }));
vi.mock("../../FirebaseCloudFunctionsDao.js", () => ({
  FirebaseCloudFunctionsDao: vi.fn(),
}));
vi.mock("../../FirebaseCustomerDao.js", () => ({ FirebaseCustomerDao: vi.fn() }));
vi.mock("../../FirebaseGridStatsDao.js", () => ({ FirebaseGridStatsDao: vi.fn() }));
vi.mock("../../FirebaseGridDao.js", () => ({ FirebaseGridDao: vi.fn() }));
vi.mock("../../FirebaseRoadmapDao.js", () => ({ FirebaseRoadmapDao: vi.fn() }));
vi.mock("../../FirebaseSlugDao.js", () => ({ FirebaseSlugDao: vi.fn() }));
vi.mock("../../FirebaseStorageDao.js", () => ({ FirebaseStorageDao: vi.fn() }));
vi.mock("../../FirebaseUpvoteDao.js", () => ({ FirebaseUpvoteDao: vi.fn() }));
vi.mock("../../FirebaseUserDao.js", () => ({ FirebaseUserDao: vi.fn() }));
vi.mock("../../FirebaseUserGameDataDao.js", () => ({
  FirebaseUserGameDataDao: vi.fn(),
}));

const db = { kind: "db" } as unknown as Firestore;
const functions = { kind: "functions" } as unknown as Functions;
const storage = { kind: "storage" } as unknown as FirebaseStorage;
const beaconUrl = "https://example.com/beacon";

describe("FirebaseDaoFactory", () => {
  let factory: FirebaseDaoFactory;

  beforeEach(() => {
    factory = new FirebaseDaoFactory({
      db,
      functions,
      storage,
      viewEndAnalyticsBeaconUrl: beaconUrl,
    });
  });

  it("constructs each Firestore-backed DAO once with the injected db", () => {
    expect(FirebaseBadgeDao).toHaveBeenCalledExactlyOnceWith(db);
    expect(FirebaseBusinessStatsDao).toHaveBeenCalledExactlyOnceWith(db);
    expect(FirebaseChatDao).toHaveBeenCalledExactlyOnceWith(db);
    expect(FirebaseCustomerDao).toHaveBeenCalledExactlyOnceWith(db);
    expect(FirebaseGridStatsDao).toHaveBeenCalledExactlyOnceWith(db);
    expect(FirebaseGridDao).toHaveBeenCalledExactlyOnceWith(db);
    expect(FirebaseUserDao).toHaveBeenCalledExactlyOnceWith(db);
    expect(FirebaseUserGameDataDao).toHaveBeenCalledExactlyOnceWith(db);
  });

  it("constructs the functions/storage/mixed DAOs with the right dependencies", () => {
    expect(FirebaseCloudFunctionsDao).toHaveBeenCalledExactlyOnceWith(functions);
    expect(FirebaseRoadmapDao).toHaveBeenCalledExactlyOnceWith(functions);
    expect(FirebaseSlugDao).toHaveBeenCalledExactlyOnceWith(db, functions);
    expect(FirebaseUpvoteDao).toHaveBeenCalledExactlyOnceWith(db, functions);
    expect(FirebaseStorageDao).toHaveBeenCalledExactlyOnceWith(storage);
  });

  it("passes the beacon URL to the analytics event DAO", () => {
    expect(FirebaseAnalyticsEventDao).toHaveBeenCalledExactlyOnceWith(
      db,
      beaconUrl,
    );
  });

  it("forwards a null beacon URL unchanged", () => {
    vi.mocked(FirebaseAnalyticsEventDao).mockClear();
    new FirebaseDaoFactory({
      db,
      functions,
      storage,
      viewEndAnalyticsBeaconUrl: null,
    });
    expect(FirebaseAnalyticsEventDao).toHaveBeenCalledExactlyOnceWith(db, null);
  });

  it("each getter returns the constructed instance and is stable across calls", () => {
    const expectations: Array<[unknown, ReturnType<typeof vi.fn>]> = [
      [factory.getBadgeDao(), vi.mocked(FirebaseBadgeDao)],
      [factory.getAnalyticsEventDao(), vi.mocked(FirebaseAnalyticsEventDao)],
      [factory.getBusinessStatsDao(), vi.mocked(FirebaseBusinessStatsDao)],
      [factory.getChatDao(), vi.mocked(FirebaseChatDao)],
      [factory.getCloudFunctionsDao(), vi.mocked(FirebaseCloudFunctionsDao)],
      [factory.getCustomerDao(), vi.mocked(FirebaseCustomerDao)],
      [factory.getGridStatsDao(), vi.mocked(FirebaseGridStatsDao)],
      [factory.getGridDao(), vi.mocked(FirebaseGridDao)],
      [factory.getRoadmapDao(), vi.mocked(FirebaseRoadmapDao)],
      [factory.getSlugDao(), vi.mocked(FirebaseSlugDao)],
      [factory.getStorageDao(), vi.mocked(FirebaseStorageDao)],
      [factory.getUpvoteDao(), vi.mocked(FirebaseUpvoteDao)],
      [factory.getUserDao(), vi.mocked(FirebaseUserDao)],
      [factory.getUserGameDataDao(), vi.mocked(FirebaseUserGameDataDao)],
    ];

    for (const [instance, mockClass] of expectations) {
      expect(instance).toBe(mockClass.mock.instances[0]);
    }

    // Stable: repeated calls hand back the same instance.
    expect(factory.getGridDao()).toBe(factory.getGridDao());
    expect(factory.getUserDao()).toBe(factory.getUserDao());
  });
});
