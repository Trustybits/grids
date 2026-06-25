/**
 * Tests for tileToolbar/mapButtons.ts
 *
 * Each map button delegates to methods exposed by the map tile's child
 * component (via `ctx.childComponent.value`) and, for MAP_PAN, mirrors the
 * child's `isEditing` flag back into the toolbar context. Covers:
 *  - MAP_PAN: guard when toggleEditMode missing, delegation, isEditing sync,
 *    sync skipped when child does not expose isEditing
 *  - MAP_PLANE / MAP_DEFAULT / MAP_CLOUDS: delegation + isActive
 *  - MAP_RECENTER: delegation + optional chaining safety
 *  - MAP_SEARCH: panel metadata + no-op action
 */

import { describe, it, expect, vi } from "vitest";
import type { ToolbarContext } from "@/types/TileToolbar";
import {
  MAP_PAN,
  MAP_PLANE,
  MAP_SEARCH,
  MAP_RECENTER,
  MAP_DEFAULT,
  MAP_CLOUDS,
} from "@/registries/tileToolbar/mapButtons";

function makeCtx(child: Record<string, unknown> | null = {}) {
  const ctx = {
    tile: { i: "map-1", w: 4, h: 4 },
    childComponent: { value: child },
    gridView: {},
    isEditing: { value: false },
    isExitingCropMode: { value: false },
  } as unknown as ToolbarContext;
  return ctx;
}

describe("MAP_PAN", () => {
  it("returns early without calling anything when child lacks toggleEditMode", () => {
    const ctx = makeCtx({});
    expect(() => MAP_PAN.action(ctx)).not.toThrow();
    expect(ctx.isEditing.value).toBe(false);
  });

  it("returns early when child component is null", () => {
    const ctx = makeCtx(null);
    expect(() => MAP_PAN.action(ctx)).not.toThrow();
  });

  it("calls toggleEditMode and syncs isEditing from the child", () => {
    const toggleEditMode = vi.fn();
    const ctx = makeCtx({ toggleEditMode, isEditing: true });

    MAP_PAN.action(ctx);

    expect(toggleEditMode).toHaveBeenCalledOnce();
    expect(ctx.isEditing.value).toBe(true);
  });

  it("does not overwrite isEditing when the child omits the isEditing flag", () => {
    const toggleEditMode = vi.fn();
    const ctx = makeCtx({ toggleEditMode });
    ctx.isEditing.value = true;

    MAP_PAN.action(ctx);

    expect(toggleEditMode).toHaveBeenCalledOnce();
    expect(ctx.isEditing.value).toBe(true);
  });

  it("copies a false isEditing value through", () => {
    const ctx = makeCtx({ toggleEditMode: vi.fn(), isEditing: false });
    ctx.isEditing.value = true;

    MAP_PAN.action(ctx);

    expect(ctx.isEditing.value).toBe(false);
  });

  it("isActive reflects the toolbar context isEditing flag", () => {
    const active = makeCtx();
    active.isEditing.value = true;
    expect(MAP_PAN.isActive?.(active)).toBe(true);
    expect(MAP_PAN.isActive?.(makeCtx())).toBe(false);
  });
});

describe("MAP_PLANE", () => {
  it("calls togglePlanes on the child", () => {
    const togglePlanes = vi.fn();
    MAP_PLANE.action(makeCtx({ togglePlanes }));
    expect(togglePlanes).toHaveBeenCalledOnce();
  });

  it("does not throw when togglePlanes is missing", () => {
    expect(() => MAP_PLANE.action(makeCtx({}))).not.toThrow();
  });

  it("isActive coerces showPlanes to a boolean", () => {
    expect(MAP_PLANE.isActive?.(makeCtx({ showPlanes: true }))).toBe(true);
    expect(MAP_PLANE.isActive?.(makeCtx({ showPlanes: false }))).toBe(false);
    expect(MAP_PLANE.isActive?.(makeCtx({}))).toBe(false);
    expect(MAP_PLANE.isActive?.(makeCtx(null))).toBe(false);
  });
});

describe("MAP_DEFAULT", () => {
  it("calls toggleDefaultStyle on the child", () => {
    const toggleDefaultStyle = vi.fn();
    MAP_DEFAULT.action(makeCtx({ toggleDefaultStyle }));
    expect(toggleDefaultStyle).toHaveBeenCalledOnce();
  });

  it("isActive coerces isDefaultStyle to a boolean", () => {
    expect(MAP_DEFAULT.isActive?.(makeCtx({ isDefaultStyle: true }))).toBe(true);
    expect(MAP_DEFAULT.isActive?.(makeCtx({}))).toBe(false);
  });
});

describe("MAP_CLOUDS", () => {
  it("calls toggleClouds on the child", () => {
    const toggleClouds = vi.fn();
    MAP_CLOUDS.action(makeCtx({ toggleClouds }));
    expect(toggleClouds).toHaveBeenCalledOnce();
  });

  it("isActive coerces showClouds to a boolean", () => {
    expect(MAP_CLOUDS.isActive?.(makeCtx({ showClouds: true }))).toBe(true);
    expect(MAP_CLOUDS.isActive?.(makeCtx({}))).toBe(false);
  });
});

describe("MAP_RECENTER", () => {
  it("calls recenterOnMarker on the child", () => {
    const recenterOnMarker = vi.fn();
    MAP_RECENTER.action(makeCtx({ recenterOnMarker }));
    expect(recenterOnMarker).toHaveBeenCalledOnce();
  });

  it("does not throw when recenterOnMarker is missing or child is null", () => {
    expect(() => MAP_RECENTER.action(makeCtx({}))).not.toThrow();
    expect(() => MAP_RECENTER.action(makeCtx(null))).not.toThrow();
  });

  it("has no isActive handler (stateless action)", () => {
    expect(MAP_RECENTER.isActive).toBeUndefined();
  });
});

describe("MAP_SEARCH", () => {
  it("exposes a search panel and a no-op action", () => {
    expect(MAP_SEARCH.panelId).toBe("search");
    expect(() => MAP_SEARCH.action(makeCtx())).not.toThrow();
  });
});
