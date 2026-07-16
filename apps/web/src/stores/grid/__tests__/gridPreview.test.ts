import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGridPreviewStore } from "../gridPreview";

describe("gridPreview", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts a neutral grid-scoped preview", () => {
    const store = useGridPreviewStore();
    const descriptor = { kind: "future-preview", gridId: "grid-1" };

    store.startPreview(descriptor);

    expect(store.activePreview).toEqual(descriptor);
    expect(store.activePreview).not.toBe(descriptor);
    expect(store.isActive("grid-1")).toBe(true);
    expect(store.blocksGridMutation("grid-1")).toBe(true);
  });

  it("does not expose a stale preview to another grid or no grid", () => {
    const store = useGridPreviewStore();
    store.startPreview({ kind: "future-preview", gridId: "grid-1" });

    expect(store.previewForGrid("grid-2")).toBeNull();
    expect(store.previewForGrid(null)).toBeNull();
    expect(store.isActive("grid-2")).toBe(false);
    expect(store.blocksGridMutation(undefined)).toBe(false);
  });

  it("replaces the active preview when another grid starts one", () => {
    const store = useGridPreviewStore();
    store.startPreview({ kind: "future-preview", gridId: "grid-1" });
    store.startPreview({ kind: "other-preview", gridId: "grid-2" });

    expect(store.isActive("grid-1")).toBe(false);
    expect(store.isActive("grid-2")).toBe(true);
    expect(store.activePreview?.kind).toBe("other-preview");
  });

  it("stops only the requested grid preview when scoped", () => {
    const store = useGridPreviewStore();
    store.startPreview({ kind: "future-preview", gridId: "grid-1" });

    store.stopPreview("grid-2");
    expect(store.isActive("grid-1")).toBe(true);

    store.stopPreview("grid-1");
    expect(store.activePreview).toBeNull();
  });

  it("can stop unscoped and reset idempotently", () => {
    const store = useGridPreviewStore();
    store.startPreview({ kind: "future-preview", gridId: "grid-1" });

    store.stopPreview();
    store.stopPreview();
    expect(store.activePreview).toBeNull();

    store.startPreview({ kind: "future-preview", gridId: "grid-1" });
    store.reset();
    store.reset();
    expect(store.activePreview).toBeNull();
  });
});
