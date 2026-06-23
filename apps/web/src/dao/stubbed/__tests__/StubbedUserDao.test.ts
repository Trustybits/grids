// Unit tests for StubbedUserDao — reads return cloned records or null;
// save/update merge sanitized data over any existing record and notify the
// user channel; subscribe delivers the current record and live updates.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StubbedUserDao } from "../StubbedUserDao";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

let dao: StubbedUserDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedUserDao();
});

describe("StubbedUserDao.getById", () => {
  it("returns null when the user does not exist", async () => {
    expect(await dao.getById("missing")).toBeNull();
  });

  it("returns a clone of the stored user", async () => {
    const user = { name: "Ada", nested: { a: 1 } };
    memoryDatabase.users.set("user-1", user);

    const result = await dao.getById("user-1");
    expect(result).toEqual(user);
    expect(result).not.toBe(user);
  });
});

describe("StubbedUserDao.save", () => {
  it("creates a new user record", async () => {
    await dao.save("user-1", { name: "Ada" });
    expect(memoryDatabase.users.get("user-1")).toEqual({ name: "Ada" });
  });

  it("merges over an existing record and drops undefined patch values", async () => {
    await dao.save("user-1", { name: "Ada", role: "admin" });
    await dao.save("user-1", { name: "Grace", role: undefined });

    expect(memoryDatabase.users.get("user-1")).toEqual({
      name: "Grace",
      role: "admin",
    });
  });
});

describe("StubbedUserDao.update", () => {
  it("merges data over an existing record", async () => {
    await dao.save("user-1", { name: "Ada" });
    await dao.update("user-1", { role: "admin" });

    expect(memoryDatabase.users.get("user-1")).toEqual({
      name: "Ada",
      role: "admin",
    });
  });

  it("creates the record when it does not yet exist", async () => {
    await dao.update("user-1", { name: "Ada" });
    expect(memoryDatabase.users.get("user-1")).toEqual({ name: "Ada" });
  });
});

describe("StubbedUserDao.subscribe", () => {
  it("delivers the current user asynchronously", async () => {
    memoryDatabase.users.set("user-1", { name: "Ada" });
    const callback = vi.fn();

    dao.subscribe("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith({ name: "Ada" });
  });

  it("delivers null when the user does not exist", async () => {
    const callback = vi.fn();
    dao.subscribe("user-1", callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(null);
  });

  it("delivers updates when the user record is saved", async () => {
    const callback = vi.fn();
    dao.subscribe("user-1", callback);
    await flushMicrotasks();

    await dao.save("user-1", { name: "Ada" });
    await flushMicrotasks();

    expect(callback).toHaveBeenLastCalledWith({ name: "Ada" });
  });

  it("stops delivering after unsubscribe", async () => {
    const callback = vi.fn();
    const unsubscribe = dao.subscribe("user-1", callback);
    await flushMicrotasks();
    callback.mockClear();

    unsubscribe();
    await dao.save("user-1", { name: "Ada" });
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });
});
