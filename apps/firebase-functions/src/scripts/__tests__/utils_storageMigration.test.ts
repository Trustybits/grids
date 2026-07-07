import { describe, expect, it } from "vitest";
import {
  classifyObject,
  decodeDisplayName,
  foreignMigrationKey,
  isObjectReferenced,
  processGrid,
  resolveExtension,
  resolveStorageRef,
  type MigrationTarget,
} from "../utils_storageMigration.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const UID = "user-1";

function downloadUrl(uid: string, folder: string, file: string): string {
  const objectPath = `users/${uid}/${folder}/${file}`;
  return (
    "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/" +
    `${encodeURIComponent(objectPath)}?alt=media&token=abc`
  );
}

describe("resolveStorageRef", () => {
  it("resolves a canonical download URL and marks it canonical", () => {
    const ref = resolveStorageRef(downloadUrl(UID, "images", `${HASH_A}.png`));
    expect(ref).toMatchObject({
      uid: UID,
      folder: "images",
      canonicalKind: "images",
      isCanonical: true,
      hash: HASH_A,
      ext: "png",
      path: `users/${UID}/images/${HASH_A}.png`,
    });
  });

  it("resolves a legacy original-filename object as non-canonical", () => {
    const ref = resolveStorageRef(downloadUrl(UID, "images", "1778778883084_Cover.png"));
    expect(ref).toMatchObject({
      uid: UID,
      folder: "images",
      isCanonical: false,
      ext: "png",
    });
    expect(ref?.hash).toBeUndefined();
  });

  it("maps link-images objects to the canonical images kind", () => {
    const ref = resolveStorageRef(downloadUrl(UID, "link-images", "photo.jpg"));
    expect(ref?.folder).toBe("link-images");
    expect(ref?.canonicalKind).toBe("images");
    expect(ref?.isCanonical).toBe(false);
  });

  it("resolves gs:// and raw storage paths", () => {
    expect(resolveStorageRef(`gs://bucket/users/${UID}/videos/${HASH_A}.mp4`)).toMatchObject({
      folder: "videos",
      hash: HASH_A,
    });
    expect(resolveStorageRef(`users/${UID}/documents/${HASH_B}.pdf`)).toMatchObject({
      folder: "documents",
      hash: HASH_B,
    });
  });

  it("ignores external, blob, data, and non-archive paths", () => {
    expect(resolveStorageRef("https://example.com/cat.png")).toBeNull();
    expect(resolveStorageRef("blob:https://app/x")).toBeNull();
    expect(resolveStorageRef("data:image/png;base64,AAAA")).toBeNull();
    expect(resolveStorageRef(downloadUrl(UID, "thumbnails", "x.png"))).toBeNull();
    expect(resolveStorageRef("og-images/custom/user-1/grid-1/og.png")).toBeNull();
    expect(resolveStorageRef(undefined)).toBeNull();
    expect(resolveStorageRef(42)).toBeNull();
  });
});

describe("processGrid — collection (read-only)", () => {
  it("collects references across every archive-backed field", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: downloadUrl(UID, "images", `${HASH_A}.png`),
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl(UID, "images", "old.png") } },
        {
          i: "t2",
          content: {
            type: "document",
            items: [
              { id: "d1", url: downloadUrl(UID, "documents", "resume.pdf") },
              { id: "d2", url: "https://external.com/spec.pdf" },
            ],
          },
        },
        {
          i: "t3",
          content: {
            type: "smart_text",
            text: JSON.stringify({
              type: "doc",
              content: [
                { type: "image", attrs: { src: downloadUrl(UID, "images", `${HASH_B}.png`), hash: HASH_B } },
              ],
            }),
          },
        },
      ],
    };

    const { collected } = processGrid(grid);
    const resolvedLocations = collected
      .filter((r) => r.resolved)
      .map((r) => r.location)
      .sort();
    expect(resolvedLocations).toEqual([
      "grid.backgroundImage",
      "tile.document.item",
      "tile.image.src",
      "tile.smartText.inlineImage",
    ]);
    // The external document URL is collected but does not resolve.
    const externalDoc = collected.find((r) => r.rawUrl === "https://external.com/spec.pdf");
    expect(externalDoc?.resolved).toBeNull();
  });

  it("flags references owned by another user as ownerMismatch but keeps the resolution", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl("other-user", "images", `${HASH_A}.png`) } },
      ],
    };
    const { collected } = processGrid(grid);
    const ref = collected.find((r) => r.location === "tile.image.src");
    expect(ref?.ownerMismatch).toBe(true);
    // Resolution is retained (owned by other-user) so callers can protect it.
    expect(ref?.resolved?.uid).toBe("other-user");
    expect(ref?.resolved?.path).toBe(`users/other-user/images/${HASH_A}.png`);
  });

  it("never rewrites a foreign-owner reference even when a target exists", () => {
    const foreignPath = `users/other-user/images/old.png`;
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl("other-user", "images", "old.png") } },
      ],
    };
    const map = new Map<string, MigrationTarget>([
      [foreignPath, { newUrl: "NOPE", newHash: HASH_A, newPath: "x" }],
    ]);
    const result = processGrid(grid, map);
    expect(result.changed).toBe(false);
    const img = (result.newTiles[0] as { content: { src: string } }).content;
    expect(img.src).toBe(downloadUrl("other-user", "images", "old.png"));
  });

  it("does not mutate the input when no migrationMap is given", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: downloadUrl(UID, "images", "old.png"),
      tiles: [{ i: "t1", content: { type: "image", src: downloadUrl(UID, "images", "a.png") } }],
    };
    const snapshot = JSON.stringify(grid);
    processGrid(grid);
    expect(JSON.stringify(grid)).toBe(snapshot);
  });
});

describe("processGrid — rewriting (migration)", () => {
  const legacyBgPath = `users/${UID}/images/old-bg.png`;
  const legacyImgPath = `users/${UID}/images/old-img.png`;
  const legacyInlinePath = `users/${UID}/images/inline.png`;
  const map = new Map<string, MigrationTarget>([
    [legacyBgPath, { newUrl: "URL_BG", newHash: HASH_A, newPath: `users/${UID}/images/${HASH_A}.png` }],
    [legacyImgPath, { newUrl: "URL_IMG", newHash: HASH_B, newPath: `users/${UID}/images/${HASH_B}.png` }],
    [legacyInlinePath, { newUrl: "URL_INLINE", newHash: HASH_A, newPath: `users/${UID}/images/${HASH_A}.png` }],
  ]);

  it("rewrites legacy URLs and hashes to canonical, deep-cloning tiles", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: downloadUrl(UID, "images", "old-bg.png"),
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl(UID, "images", "old-img.png") } },
        {
          i: "t2",
          content: {
            type: "smart_text",
            text: JSON.stringify({
              type: "doc",
              content: [{ type: "image", attrs: { src: downloadUrl(UID, "images", "inline.png") } }],
            }),
          },
        },
      ],
    };
    const original = JSON.stringify(grid);

    const result = processGrid(grid, map);
    expect(result.changed).toBe(true);
    expect(result.newBackgroundSrc).toBe("URL_BG");
    expect(result.newBackgroundHash).toBe(HASH_A);

    const img = (result.newTiles[0] as { content: { src: string; srcHash: string } }).content;
    expect(img.src).toBe("URL_IMG");
    expect(img.srcHash).toBe(HASH_B);

    const smart = (result.newTiles[1] as { content: { text: string } }).content;
    const parsed = JSON.parse(smart.text);
    expect(parsed.content[0].attrs.src).toBe("URL_INLINE");
    expect(parsed.content[0].attrs.hash).toBe(HASH_A);

    // Input grid is untouched (deep clone).
    expect(JSON.stringify(grid)).toBe(original);
  });

  it("backfills a missing hash field when the URL is already canonical", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl(UID, "images", `${HASH_A}.png`) } },
      ],
    };
    const result = processGrid(grid, new Map());
    expect(result.changed).toBe(true);
    const img = (result.newTiles[0] as { content: { srcHash: string } }).content;
    expect(img.srcHash).toBe(HASH_A);
  });

  it("repairs a stale stored hash to match the canonical URL", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        {
          i: "t1",
          content: {
            type: "image",
            // URL points at HASH_A but stored srcHash is a stale/wrong HASH_B.
            src: downloadUrl(UID, "images", `${HASH_A}.png`),
            srcHash: HASH_B,
          },
        },
      ],
    };
    const result = processGrid(grid, new Map());
    expect(result.changed).toBe(true);
    const img = (result.newTiles[0] as { content: { srcHash: string } }).content;
    expect(img.srcHash).toBe(HASH_A);
  });

  it("does not change a grid whose references are already canonical with hashes", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: downloadUrl(UID, "images", `${HASH_A}.png`),
      backgroundImageHash: HASH_A,
      tiles: [
        {
          i: "t1",
          content: {
            type: "image",
            src: downloadUrl(UID, "images", `${HASH_B}.png`),
            srcHash: HASH_B,
          },
        },
      ],
    };
    const result = processGrid(grid, new Map());
    expect(result.changed).toBe(false);
  });
});

describe("foreignMigrationKey", () => {
  it("joins owner and path unambiguously and is stable", () => {
    const key = foreignMigrationKey("userA", "users/userB/images/x.png");
    expect(key).toContain("userA");
    expect(key).toContain("users/userB/images/x.png");
    // Deterministic.
    expect(foreignMigrationKey("userA", "p")).toBe(
      foreignMigrationKey("userA", "p"),
    );
    // The separator prevents (owner,path) collisions from string concatenation.
    expect(foreignMigrationKey("userA", "p")).not.toBe(
      foreignMigrationKey("userAp", ""),
    );
  });
});

describe("processGrid — cross-user (foreign-owner) rewriting", () => {
  const foreignLegacy = "users/other-user/images/shared.png";
  const foreignCanonical = `users/other-user/images/${HASH_A}.png`;
  const foreignInline = "users/other-user/images/inline.png";

  it("copies a foreign legacy reference into the owner's canonical target", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl("other-user", "images", "shared.png") } },
      ],
    };
    const foreignMap = new Map<string, MigrationTarget>([
      [
        foreignMigrationKey(UID, foreignLegacy),
        { newUrl: "URL_COPY", newHash: HASH_A, newPath: `users/${UID}/images/${HASH_A}.png` },
      ],
    ]);
    const result = processGrid(grid, new Map(), foreignMap);
    expect(result.changed).toBe(true);
    const img = (result.newTiles[0] as { content: { src: string; srcHash: string } }).content;
    expect(img.src).toBe("URL_COPY");
    expect(img.srcHash).toBe(HASH_A);
  });

  it("rewrites a foreign CANONICAL reference to the owner's own copy", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl("other-user", "images", `${HASH_A}.png`) } },
      ],
    };
    const foreignMap = new Map<string, MigrationTarget>([
      [
        foreignMigrationKey(UID, foreignCanonical),
        { newUrl: "URL_COPY", newHash: HASH_A, newPath: `users/${UID}/images/${HASH_A}.png` },
      ],
    ]);
    const result = processGrid(grid, new Map(), foreignMap);
    expect(result.changed).toBe(true);
    const img = (result.newTiles[0] as { content: { src: string; srcHash: string } }).content;
    expect(img.src).toBe("URL_COPY");
    expect(img.srcHash).toBe(HASH_A);
  });

  it("never backfills a foreign hash when no cross-user copy target exists", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl("other-user", "images", `${HASH_A}.png`) } },
      ],
    };
    // Foreign canonical ref, empty foreign map → must not write other-user's hash.
    const result = processGrid(grid, new Map(), new Map());
    expect(result.changed).toBe(false);
    const img = (result.newTiles[0] as { content: { srcHash?: string } }).content;
    expect(img.srcHash).toBeUndefined();
  });

  it("keys copies by (owner, path): a target for another owner does not apply", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl("other-user", "images", "shared.png") } },
      ],
    };
    // Target registered for a DIFFERENT grid owner — must not match this grid.
    const foreignMap = new Map<string, MigrationTarget>([
      [
        foreignMigrationKey("someone-else", foreignLegacy),
        { newUrl: "WRONG", newHash: HASH_B, newPath: "x" },
      ],
    ]);
    const result = processGrid(grid, new Map(), foreignMap);
    expect(result.changed).toBe(false);
    const img = (result.newTiles[0] as { content: { src: string } }).content;
    expect(img.src).toBe(downloadUrl("other-user", "images", "shared.png"));
  });

  it("rewrites own and foreign references together in one grid", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        { i: "t1", content: { type: "image", src: downloadUrl(UID, "images", "own.png") } },
        { i: "t2", content: { type: "image", src: downloadUrl("other-user", "images", "foreign.png") } },
      ],
    };
    const ownMap = new Map<string, MigrationTarget>([
      [`users/${UID}/images/own.png`, { newUrl: "OWN_URL", newHash: HASH_A, newPath: `users/${UID}/images/${HASH_A}.png` }],
    ]);
    const foreignMap = new Map<string, MigrationTarget>([
      [
        foreignMigrationKey(UID, "users/other-user/images/foreign.png"),
        { newUrl: "FOREIGN_URL", newHash: HASH_B, newPath: `users/${UID}/images/${HASH_B}.png` },
      ],
    ]);
    const result = processGrid(grid, ownMap, foreignMap);
    expect(result.changed).toBe(true);
    const own = (result.newTiles[0] as { content: { src: string; srcHash: string } }).content;
    const foreign = (result.newTiles[1] as { content: { src: string; srcHash: string } }).content;
    expect(own.src).toBe("OWN_URL");
    expect(own.srcHash).toBe(HASH_A);
    expect(foreign.src).toBe("FOREIGN_URL");
    expect(foreign.srcHash).toBe(HASH_B);
  });

  it("rewrites a foreign inline smart-text image to the owner's copy", () => {
    const grid = {
      userId: UID,
      backgroundImageSrc: "",
      tiles: [
        {
          i: "t1",
          content: {
            type: "smart_text",
            text: JSON.stringify({
              type: "doc",
              content: [
                { type: "image", attrs: { src: downloadUrl("other-user", "images", "inline.png") } },
              ],
            }),
          },
        },
      ],
    };
    const foreignMap = new Map<string, MigrationTarget>([
      [
        foreignMigrationKey(UID, foreignInline),
        { newUrl: "INLINE_COPY", newHash: HASH_A, newPath: `users/${UID}/images/${HASH_A}.png` },
      ],
    ]);
    const result = processGrid(grid, new Map(), foreignMap);
    expect(result.changed).toBe(true);
    const smart = (result.newTiles[0] as { content: { text: string } }).content;
    const parsed = JSON.parse(smart.text);
    expect(parsed.content[0].attrs.src).toBe("INLINE_COPY");
    expect(parsed.content[0].attrs.hash).toBe(HASH_A);
  });
});

describe("classifyObject + isObjectReferenced", () => {
  it("classifies canonical and legacy objects", () => {
    expect(classifyObject({ path: `users/${UID}/images/${HASH_A}.png`, size: 10 })).toMatchObject({
      uid: UID,
      folder: "images",
      isCanonical: true,
      hash: HASH_A,
    });
    expect(classifyObject({ path: `users/${UID}/link-images/pic.png`, size: 10 })).toMatchObject({
      folder: "link-images",
      isCanonical: false,
    });
    expect(classifyObject({ path: "og-images/custom/u/g/og.png", size: 10 })).toBeNull();
    expect(classifyObject({ path: `users/${UID}/images/a/b.png`, size: 10 })).toBeNull();
  });

  it("treats an object as referenced by exact path or by canonical hash", () => {
    const legacy = classifyObject({ path: `users/${UID}/images/old.png`, size: 1 })!;
    const canonical = classifyObject({ path: `users/${UID}/images/${HASH_A}.png`, size: 1 })!;

    const paths = new Set<string>([`users/${UID}/images/old.png`]);
    const hashes = new Map<string, Set<string>>([[UID, new Set([HASH_A])]]);

    expect(isObjectReferenced(legacy, paths, hashes)).toBe(true);
    expect(isObjectReferenced(canonical, new Set(), hashes)).toBe(true);
    expect(isObjectReferenced(canonical, new Set(), new Map())).toBe(false);
    // Same hash referenced by a different owner does not protect this object.
    expect(
      isObjectReferenced(canonical, new Set(), new Map([["other", new Set([HASH_A])]])),
    ).toBe(false);
  });
});

describe("resolveExtension + decodeDisplayName", () => {
  it("keeps valid extensions and falls back to content-type", () => {
    expect(resolveExtension("PNG", "image/png")).toBe("png");
    expect(resolveExtension("", "image/jpeg")).toBe("jpg");
    expect(resolveExtension(".mp4", "video/mp4")).toBe("mp4");
    expect(resolveExtension("weird ext", "application/octet-stream")).toBeNull();
  });

  it("strips epoch prefixes and decodes display names", () => {
    expect(decodeDisplayName("1778778883084_Cover.png")).toBe("Cover.png");
    expect(decodeDisplayName("My%20File.pdf")).toBe("My File.pdf");
  });
});
