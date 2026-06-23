// Unit tests for StubbedBadgeDao — getById returns a defensive clone or null;
// subscribe pushes the current badges snapshot through the in-memory pub/sub.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StubbedBadgeDao } from "../StubbedBadgeDao";
import type { UserBadges } from "@grids/contracts/types";
import { channel, emit, memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

const badges: UserBadges = {
  earlyAdopter: { earnedAt: new Date("2024-01-01T00:00:00.000Z") },
};

let dao: StubbedBadgeDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedBadgeDao();
});

describe("StubbedBadgeDao.getById", () => {
  it("returns null when the user has no badges", async () => {
    expect(await dao.getById("missing")).toBeNull();
  });

  it("returns the stored badges when present", async () => {
    memoryDatabase.badges.set("user-1", badges);
    expect(await dao.getById("user-1")).toEqual(badges);
  });

  it("returns a clone, not the stored reference", async () => {
    memoryDatabase.badges.set("user-1", badges);
    const result = await dao.getById("user-1");

    expect(result).not.toBe(badges);
    expect(result).toEqual(badges);
  });
});

describe("StubbedBadgeDao.subscribe", () => {
  it("delivers the current badges asynchronously", async () => {
    memoryDatabase.badges.set("user-1", badges);
    const callback = vi.fn();

    dao.subscribe("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(badges);
  });

  it("delivers null when the user has no badges", async () => {
    const callback = vi.fn();
    dao.subscribe("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(null);
  });

  it("delivers updated badges when the channel emits", async () => {
    const callback = vi.fn();
    dao.subscribe("user-1", callback);
    await flushMicrotasks();
    callback.mockClear();

    memoryDatabase.badges.set("user-1", badges);
    emit(channel("badges", "user-1"));
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(badges);
  });

  it("returns an unsubscribe function that stops further delivery", async () => {
    const callback = vi.fn();
    const unsubscribe = dao.subscribe("user-1", callback);
    await flushMicrotasks();
    callback.mockClear();

    unsubscribe();
    // A later write + emit on the channel must not reach the callback.
    memoryDatabase.badges.set("user-1", badges);
    emit(channel("badges", "user-1"));
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });
});
