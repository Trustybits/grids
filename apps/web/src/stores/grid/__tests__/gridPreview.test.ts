import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { GRIDDLE_RESPONSIVE_LAYOUT_VERSION } from "@grids/contracts/types";
import { useGridPreviewStore } from "../gridPreview";

describe("gridPreview", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts a grid-scoped responsive-layout preview", () => {
    const store = useGridPreviewStore();

    store.startResponsiveLayoutPreview("grid-1");

    expect(store.activePreview).toEqual({
      kind: "responsive-layout",
      gridId: "grid-1",
      responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    });
    expect(store.isActive("grid-1")).toBe(true);
    expect(store.blocksGridMutation("grid-1")).toBe(true);
    expect(store.responsiveLayoutVersionOverride("grid-1")).toBe(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );
  });

  it("does not expose a stale preview to another grid or no grid", () => {
    const store = useGridPreviewStore();
    store.startResponsiveLayoutPreview("grid-1");

    expect(store.previewForGrid("grid-2")).toBeNull();
    expect(store.previewForGrid(null)).toBeNull();
    expect(store.isActive("grid-2")).toBe(false);
    expect(store.blocksGridMutation(undefined)).toBe(false);
    expect(
      store.responsiveLayoutVersionOverride("grid-2"),
    ).toBeUndefined();
  });

  it("replaces the active preview when another grid starts one", () => {
    const store = useGridPreviewStore();
    store.startResponsiveLayoutPreview("grid-1");
    store.startResponsiveLayoutPreview("grid-2");

    expect(store.isActive("grid-1")).toBe(false);
    expect(store.isActive("grid-2")).toBe(true);
  });

  it("stops only the requested grid preview when scoped", () => {
    const store = useGridPreviewStore();
    store.startResponsiveLayoutPreview("grid-1");

    store.stopPreview("grid-2");
    expect(store.isActive("grid-1")).toBe(true);

    store.stopPreview("grid-1");
    expect(store.activePreview).toBeNull();
  });

  it("can stop unscoped and reset idempotently", () => {
    const store = useGridPreviewStore();
    store.startResponsiveLayoutPreview("grid-1");

    store.stopPreview();
    store.stopPreview();
    expect(store.activePreview).toBeNull();

    store.startResponsiveLayoutPreview("grid-1");
    store.reset();
    store.reset();
    expect(store.activePreview).toBeNull();
  });
});
