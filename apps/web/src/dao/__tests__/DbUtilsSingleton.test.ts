// Unit tests for the DbUtils singleton accessor. Module state is reset between
// tests via vi.resetModules() + dynamic import so each test starts from the
// unregistered state.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbUtils } from "@grids/contracts/dao";

async function loadSingleton() {
  vi.resetModules();
  return import("@/dao/DbUtilsSingleton");
}

beforeEach(() => {
  vi.resetModules();
});

describe("getDbUtils", () => {
  it("throws when no utils have been registered", async () => {
    const { getDbUtils } = await loadSingleton();
    expect(() => getDbUtils()).toThrow(
      "DbUtils has not been registered. Call registerDbUtils() at app startup.",
    );
  });

  it("returns the registered utils instance", async () => {
    const { registerDbUtils, getDbUtils } = await loadSingleton();
    const utils = { id: "utils" } as unknown as DbUtils;

    registerDbUtils(utils);

    expect(getDbUtils()).toBe(utils);
  });

  it("overwrites a previously registered utils instance", async () => {
    const { registerDbUtils, getDbUtils } = await loadSingleton();
    const first = { id: "first" } as unknown as DbUtils;
    const second = { id: "second" } as unknown as DbUtils;

    registerDbUtils(first);
    registerDbUtils(second);

    expect(getDbUtils()).toBe(second);
  });

  it("returns the same instance on repeated calls", async () => {
    const { registerDbUtils, getDbUtils } = await loadSingleton();
    const utils = { id: "utils" } as unknown as DbUtils;

    registerDbUtils(utils);

    expect(getDbUtils()).toBe(getDbUtils());
  });

  it("does not share state across freshly imported modules", async () => {
    const first = await loadSingleton();
    first.registerDbUtils({ id: "a" } as unknown as DbUtils);
    expect(first.getDbUtils()).toBeDefined();

    // A fresh module graph should be back to the unregistered state.
    const second = await loadSingleton();
    expect(() => second.getDbUtils()).toThrow();
  });
});
