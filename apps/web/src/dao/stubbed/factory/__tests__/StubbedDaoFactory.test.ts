// Unit tests for StubbedDaoFactory — verifies it constructs and hands back the
// correct stubbed DAO instance for every getter, and that each getter returns a
// stable singleton instance per factory.
import { describe, it, expect, beforeEach } from "vitest";
import { StubbedDaoFactory } from "../StubbedDaoFactory";
import { StubbedBadgeDao } from "../../StubbedBadgeDao";
import { StubbedAnalyticsEventDao } from "../../StubbedAnalyticsEventDao";
import { StubbedBusinessStatsDao } from "../../StubbedBusinessStatsDao";
import { StubbedChatDao } from "../../StubbedChatDao";
import { StubbedCloudFunctionsDao } from "../../StubbedCloudFunctionsDao";
import { StubbedCustomerDao } from "../../StubbedCustomerDao";
import { StubbedGridStatsDao } from "../../StubbedGridStatsDao";
import { StubbedGridDao } from "../../StubbedGridDao";
import { StubbedRoadmapDao } from "../../StubbedRoadmapDao";
import { StubbedSlugDao } from "../../StubbedSlugDao";
import { StubbedStorageDao } from "../../StubbedStorageDao";
import { StubbedUpvoteDao } from "../../StubbedUpvoteDao";
import { StubbedUserDao } from "../../StubbedUserDao";
import { StubbedUserGameDataDao } from "../../StubbedUserGameDataDao";

let factory: StubbedDaoFactory;

beforeEach(() => {
  factory = new StubbedDaoFactory();
});

describe("StubbedDaoFactory", () => {
  const cases: Array<[keyof StubbedDaoFactory, new () => unknown]> = [
    ["getBadgeDao", StubbedBadgeDao],
    ["getAnalyticsEventDao", StubbedAnalyticsEventDao],
    ["getBusinessStatsDao", StubbedBusinessStatsDao],
    ["getChatDao", StubbedChatDao],
    ["getCloudFunctionsDao", StubbedCloudFunctionsDao],
    ["getCustomerDao", StubbedCustomerDao],
    ["getGridStatsDao", StubbedGridStatsDao],
    ["getGridDao", StubbedGridDao],
    ["getRoadmapDao", StubbedRoadmapDao],
    ["getSlugDao", StubbedSlugDao],
    ["getStorageDao", StubbedStorageDao],
    ["getUpvoteDao", StubbedUpvoteDao],
    ["getUserDao", StubbedUserDao],
    ["getUserGameDataDao", StubbedUserGameDataDao],
  ];

  it.each(cases)("%s returns the matching stubbed DAO instance", (getter, Ctor) => {
    const dao = (factory[getter] as () => unknown)();
    expect(dao).toBeInstanceOf(Ctor);
  });

  it.each(cases)("%s returns the same instance on repeated calls", (getter) => {
    const call = factory[getter] as () => unknown;
    expect(call.call(factory)).toBe(call.call(factory));
  });

  it("gives separate factory instances their own DAO instances", () => {
    const other = new StubbedDaoFactory();
    expect(factory.getGridDao()).not.toBe(other.getGridDao());
  });
});
