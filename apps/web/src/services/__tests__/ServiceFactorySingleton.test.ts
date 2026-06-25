// Unit tests for the ServiceFactory singleton accessor. Module state is reset
// between tests via vi.resetModules() + dynamic import so each test starts from
// the unregistered state.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServiceFactoryInterface } from "@/services/factory/ServiceFactoryInterface";

async function loadSingleton() {
  vi.resetModules();
  return import("@/services/ServiceFactorySingleton");
}

beforeEach(() => {
  vi.resetModules();
});

describe("getServiceFactory", () => {
  it("throws when no factory has been registered", async () => {
    const { getServiceFactory } = await loadSingleton();
    expect(() => getServiceFactory()).toThrow(
      "ServiceFactory has not been registered. Call registerServiceFactory() at app startup.",
    );
  });

  it("returns the registered factory instance", async () => {
    const { registerServiceFactory, getServiceFactory } = await loadSingleton();
    const factory = { id: "factory" } as unknown as ServiceFactoryInterface;

    registerServiceFactory(factory);

    expect(getServiceFactory()).toBe(factory);
  });

  it("overwrites a previously registered factory", async () => {
    const { registerServiceFactory, getServiceFactory } = await loadSingleton();
    const first = { id: "first" } as unknown as ServiceFactoryInterface;
    const second = { id: "second" } as unknown as ServiceFactoryInterface;

    registerServiceFactory(first);
    registerServiceFactory(second);

    expect(getServiceFactory()).toBe(second);
  });

  it("does not share state across freshly imported modules", async () => {
    const first = await loadSingleton();
    first.registerServiceFactory({
      id: "a",
    } as unknown as ServiceFactoryInterface);
    expect(first.getServiceFactory()).toBeDefined();

    // A fresh module graph should be back to the unregistered state.
    const second = await loadSingleton();
    expect(() => second.getServiceFactory()).toThrow();
  });
});
