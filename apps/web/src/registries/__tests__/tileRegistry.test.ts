/**
 * Tests for tileRegistry.ts
 *
 * The registry is a module-level singleton `Map<ContentType, TileDefinition>`.
 * The global test setup (`src/test/setup.ts`) imports `@/registries/tiles`,
 * which self-registers all 15 real tiles into that singleton. To test the
 * registry's own logic in isolation we use `vi.resetModules()` + a dynamic
 * import in `beforeEach`, giving each test a fresh module instance with an
 * empty Map — independent of whatever setup.ts populated.
 *
 * Covers:
 *  - registerTile / getTileDefinition (round-trip, overwrite, miss)
 *  - getAllTileDefinitions (all, empty, insertion order)
 *  - getTilesByCategory (filtering, empty result)
 *  - matchUrlToTileType (first match, no match, defs without matchUrl,
 *    insertion-order precedence)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContentType } from "@grids/contracts/types";
import type { TileDefinition, TileCategory } from "@/types/TileDefinition";

type Registry = typeof import("@/registries/tileRegistry");

let reg: Registry;

beforeEach(async () => {
  vi.resetModules();
  reg = await import("@/registries/tileRegistry");
});

/**
 * Build a minimal TileDefinition stub. Only the fields the registry actually
 * reads (`type`, `category`, `matchUrl`) need to be meaningful; the rest are
 * filled with throwaway values to satisfy the type.
 */
function makeDef(
  type: ContentType,
  overrides: Partial<TileDefinition> = {},
): TileDefinition {
  return {
    type,
    label: String(type),
    component: () => Promise.resolve({ default: {} as never }),
    defaultContent: () => ({ type }) as never,
    validate: () => true,
    capabilities: {},
    ...overrides,
  } as TileDefinition;
}

describe("registerTile / getTileDefinition", () => {
  it("returns the definition that was registered for a type", () => {
    const def = makeDef(ContentType.TEXT);
    reg.registerTile(def);
    expect(reg.getTileDefinition(ContentType.TEXT)).toBe(def);
  });

  it("returns undefined for a type that was never registered", () => {
    expect(reg.getTileDefinition(ContentType.MAP)).toBeUndefined();
  });

  it("overwrites the previous definition when the same type is registered twice", () => {
    const first = makeDef(ContentType.IMAGE, { label: "First" });
    const second = makeDef(ContentType.IMAGE, { label: "Second" });
    reg.registerTile(first);
    reg.registerTile(second);
    expect(reg.getTileDefinition(ContentType.IMAGE)).toBe(second);
  });

  it("keys the definition by its own `type` field, not by anything else", () => {
    const def = makeDef(ContentType.VIDEO);
    reg.registerTile(def);
    expect(reg.getTileDefinition(ContentType.VIDEO)).toBe(def);
    expect(reg.getTileDefinition(ContentType.IMAGE)).toBeUndefined();
  });
});

describe("getAllTileDefinitions", () => {
  it("returns an empty array when nothing is registered", () => {
    expect(reg.getAllTileDefinitions()).toEqual([]);
  });

  it("returns every registered definition", () => {
    const a = makeDef(ContentType.TEXT);
    const b = makeDef(ContentType.IMAGE);
    reg.registerTile(a);
    reg.registerTile(b);
    expect(reg.getAllTileDefinitions()).toEqual([a, b]);
  });

  it("preserves insertion order", () => {
    const a = makeDef(ContentType.MUSIC);
    const b = makeDef(ContentType.MAP);
    const c = makeDef(ContentType.CHAT);
    reg.registerTile(a);
    reg.registerTile(b);
    reg.registerTile(c);
    expect(reg.getAllTileDefinitions().map((d) => d.type)).toEqual([
      ContentType.MUSIC,
      ContentType.MAP,
      ContentType.CHAT,
    ]);
  });

  it("does not grow when a type is re-registered (Map semantics)", () => {
    reg.registerTile(makeDef(ContentType.TEXT, { label: "v1" }));
    reg.registerTile(makeDef(ContentType.TEXT, { label: "v2" }));
    expect(reg.getAllTileDefinitions()).toHaveLength(1);
  });
});

describe("getTilesByCategory", () => {
  it("returns only the definitions whose category matches", () => {
    const media1 = makeDef(ContentType.IMAGE, { category: "media" });
    const media2 = makeDef(ContentType.VIDEO, { category: "media" });
    const text = makeDef(ContentType.TEXT, { category: "text" });
    reg.registerTile(media1);
    reg.registerTile(media2);
    reg.registerTile(text);
    expect(reg.getTilesByCategory("media")).toEqual([media1, media2]);
  });

  it("returns an empty array when no definition has the category", () => {
    reg.registerTile(makeDef(ContentType.TEXT, { category: "text" }));
    expect(reg.getTilesByCategory("game")).toEqual([]);
  });

  it("returns an empty array for an unknown category", () => {
    reg.registerTile(makeDef(ContentType.TEXT, { category: "text" }));
    expect(reg.getTilesByCategory("nonexistent" as TileCategory)).toEqual([]);
  });

  it("excludes definitions that have no category set", () => {
    const withCat = makeDef(ContentType.TEXT, { category: "text" });
    const noCat = makeDef(ContentType.CHAT); // category undefined
    reg.registerTile(withCat);
    reg.registerTile(noCat);
    expect(reg.getTilesByCategory("text")).toEqual([withCat]);
  });
});

describe("matchUrlToTileType", () => {
  it("returns the first definition whose matchUrl returns true", () => {
    const img = makeDef(ContentType.IMAGE, {
      matchUrl: (url) => url.endsWith(".png"),
    });
    reg.registerTile(img);
    expect(reg.matchUrlToTileType("https://x.com/a.png")).toBe(img);
  });

  it("returns undefined when no definition claims the URL", () => {
    reg.registerTile(makeDef(ContentType.IMAGE, { matchUrl: () => false }));
    expect(reg.matchUrlToTileType("https://x.com/a.png")).toBeUndefined();
  });

  it("returns undefined when no registered definition has a matchUrl", () => {
    reg.registerTile(makeDef(ContentType.TEXT)); // no matchUrl
    expect(reg.matchUrlToTileType("anything")).toBeUndefined();
  });

  it("skips definitions without a matchUrl and returns a later matching one", () => {
    const noMatch = makeDef(ContentType.TEXT); // no matchUrl
    const video = makeDef(ContentType.VIDEO, {
      matchUrl: (url) => url.endsWith(".mp4"),
    });
    reg.registerTile(noMatch);
    reg.registerTile(video);
    expect(reg.matchUrlToTileType("https://x.com/clip.mp4")).toBe(video);
  });

  it("returns the earliest-registered match when multiple definitions match", () => {
    const first = makeDef(ContentType.IMAGE, { matchUrl: () => true });
    const second = makeDef(ContentType.VIDEO, { matchUrl: () => true });
    reg.registerTile(first);
    reg.registerTile(second);
    expect(reg.matchUrlToTileType("https://x.com/file")).toBe(first);
  });

  it("returns undefined when the registry is empty", () => {
    expect(reg.matchUrlToTileType("https://x.com/file")).toBeUndefined();
  });
});
