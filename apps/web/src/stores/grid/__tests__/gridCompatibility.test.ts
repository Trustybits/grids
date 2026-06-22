import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGridCompatibilityStore } from "../gridCompatibility";

describe("gridCompatibility store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("owns the writable legacy error channel and resets it", () => {
    const store = useGridCompatibilityStore();

    expect(store.error).toBeNull();

    store.setError("Failed to load grid.");
    expect(store.error).toBe("Failed to load grid.");

    store.reset();
    expect(store.error).toBeNull();
  });

  it("is isolated per Pinia instance", () => {
    const first = useGridCompatibilityStore(createPinia());
    const second = useGridCompatibilityStore(createPinia());

    first.setError("First only");

    expect(first.error).toBe("First only");
    expect(second.error).toBeNull();
  });
});
