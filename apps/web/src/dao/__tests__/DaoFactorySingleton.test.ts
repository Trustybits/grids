// Unit tests for the DaoFactory singleton accessor. Module state is reset
// between tests via vi.resetModules() + dynamic import so each test starts from
// the unregistered state.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DaoFactory } from "@grids/contracts/dao";

async function loadSingleton() {
  vi.resetModules();
  return import("@/dao/DaoFactorySingleton");
}

beforeEach(() => {
  vi.resetModules();
});

describe("getDaoFactory", () => {
  it("throws when no factory has been registered", async () => {
    const { getDaoFactory } = await loadSingleton();
    expect(() => getDaoFactory()).toThrow(
      "DaoFactory has not been registered. Call registerDaoFactory() at app startup.",
    );
  });

  it("returns the registered factory instance", async () => {
    const { registerDaoFactory, getDaoFactory } = await loadSingleton();
    const factory = { id: "factory" } as unknown as DaoFactory;

    registerDaoFactory(factory);

    expect(getDaoFactory()).toBe(factory);
  });

  it("overwrites a previously registered factory", async () => {
    const { registerDaoFactory, getDaoFactory } = await loadSingleton();
    const first = { id: "first" } as unknown as DaoFactory;
    const second = { id: "second" } as unknown as DaoFactory;

    registerDaoFactory(first);
    registerDaoFactory(second);

    expect(getDaoFactory()).toBe(second);
  });

  it("returns the same instance on repeated calls", async () => {
    const { registerDaoFactory, getDaoFactory } = await loadSingleton();
    const factory = { id: "factory" } as unknown as DaoFactory;

    registerDaoFactory(factory);

    expect(getDaoFactory()).toBe(getDaoFactory());
  });

  it("does not share state across freshly imported modules", async () => {
    const first = await loadSingleton();
    first.registerDaoFactory({ id: "a" } as unknown as DaoFactory);
    expect(first.getDaoFactory()).toBeDefined();

    // A fresh module graph should be back to the unregistered state.
    const second = await loadSingleton();
    expect(() => second.getDaoFactory()).toThrow();
  });
});
