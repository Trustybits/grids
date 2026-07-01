/**
 * Unit tests for the canonical upload path helpers used across the storage
 * refactor (see notes/storage-refactor-implementation-plan.md, Phase 1.1).
 *
 * These are pure functions whose only external dependency is `HttpsError`
 * from firebase-functions, which is mocked so the thrown `code` can be
 * inspected. Coverage focuses on:
 * - metadata normalization/validation equivalence classes and edge cases
 * - canonical path construction `users/{uid}/{kind}/{hash}.{ext}`
 * - canonical path parsing, including all rejection branches (legacy paths,
 *   original filenames, wrong owners/kinds, malformed hashes/extensions).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import(
    "../../__tests__/utils_testMocks.js"
  );
  return createHttpsModuleMock();
});

import {
  STORAGE_QUOTA_BYTES,
  buildCanonicalUploadPath,
  normalizeContentType,
  normalizeExtension,
  normalizeHash,
  normalizeUploadKind,
  normalizeUploadMetadata,
  normalizeUploadSize,
  parseCanonicalUploadPath,
  type UploadMetadata,
} from "../utils_uploadPaths.js";

const HASH = "a".repeat(64);
const UPPER_HASH = "A".repeat(64);

/** Invokes `fn`, returning the thrown error (or null when nothing threw). */
function caught(fn: () => unknown): { code?: string } | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error as { code?: string };
  }
}

describe("normalizeUploadKind", () => {
  it.each(["images", "videos", "documents"])(
    "accepts the supported kind %s",
    (kind) => {
      expect(normalizeUploadKind(kind)).toBe(kind);
    },
  );

  it.each([
    ["an unsupported string", "audio"],
    ["an empty string", ""],
    ["a non-string", 42],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s with invalid-argument", (_label, value) => {
    expect(caught(() => normalizeUploadKind(value))?.code).toBe(
      "invalid-argument",
    );
  });
});

describe("normalizeHash", () => {
  it("accepts a lowercase 64-char sha256 hex digest", () => {
    expect(normalizeHash(HASH)).toBe(HASH);
  });

  it("lowercases and trims surrounding whitespace", () => {
    expect(normalizeHash(`  ${UPPER_HASH}  `)).toBe(HASH);
  });

  it.each([
    ["a too-short digest", "a".repeat(63)],
    ["a too-long digest", "a".repeat(65)],
    ["a non-hex character", "g".repeat(64)],
    ["a non-string", 123],
    ["an empty string", ""],
  ])("rejects %s with invalid-argument", (_label, value) => {
    expect(caught(() => normalizeHash(value))?.code).toBe("invalid-argument");
  });
});

describe("normalizeExtension", () => {
  it("accepts a simple lowercase extension", () => {
    expect(normalizeExtension("png")).toBe("png");
  });

  it("strips a single leading dot and lowercases", () => {
    expect(normalizeExtension(".PNG")).toBe("png");
  });

  it("accepts hyphenated extensions up to the length cap", () => {
    expect(normalizeExtension("tar-gz")).toBe("tar-gz");
    // 16 chars: first char + 15 more is the maximum allowed.
    expect(normalizeExtension("a".repeat(16))).toBe("a".repeat(16));
  });

  it.each([
    ["a leading hyphen", "-png"],
    ["an over-length extension", "a".repeat(17)],
    ["an extension with a dot", "ta.gz"],
    ["an extension with a slash", "pn/g"],
    ["an empty extension", ""],
    ["a non-string", 5],
  ])("rejects %s with invalid-argument", (_label, value) => {
    expect(caught(() => normalizeExtension(value))?.code).toBe(
      "invalid-argument",
    );
  });
});

describe("normalizeUploadSize", () => {
  it("accepts a positive safe integer", () => {
    expect(normalizeUploadSize(1024)).toBe(1024);
  });

  it("accepts a zero-byte file", () => {
    expect(normalizeUploadSize(0)).toBe(0);
  });

  it.each([
    ["a negative size", -1],
    ["a fractional size", 12.5],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
    ["NaN", Number.NaN],
    ["a numeric string", "1024"],
  ])("rejects %s with invalid-argument", (_label, value) => {
    expect(caught(() => normalizeUploadSize(value))?.code).toBe(
      "invalid-argument",
    );
  });
});

describe("normalizeContentType", () => {
  it("trims and lowercases the content type", () => {
    expect(normalizeContentType("  Image/PNG  ")).toBe("image/png");
  });

  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["a non-string", 5],
  ])("rejects %s with invalid-argument", (_label, value) => {
    expect(caught(() => normalizeContentType(value))?.code).toBe(
      "invalid-argument",
    );
  });
});

describe("normalizeUploadMetadata", () => {
  it("normalizes a full payload", () => {
    expect(
      normalizeUploadMetadata({
        kind: "images",
        hash: UPPER_HASH,
        ext: ".PNG",
        size: 25,
        contentType: "Image/PNG",
      }),
    ).toEqual<UploadMetadata>({
      kind: "images",
      hash: HASH,
      ext: "png",
      size: 25,
      contentType: "image/png",
    });
  });

  it("falls back to the legacy `type` field when `kind` is absent", () => {
    expect(
      normalizeUploadMetadata({
        type: "videos",
        hash: HASH,
        ext: "mp4",
        size: 10,
        contentType: "video/mp4",
      }).kind,
    ).toBe("videos");
  });

  it("treats a missing payload as an empty object and rejects it", () => {
    expect(caught(() => normalizeUploadMetadata(undefined))?.code).toBe(
      "invalid-argument",
    );
  });
});

describe("buildCanonicalUploadPath", () => {
  it("builds users/{uid}/{kind}/{hash}.{ext}", () => {
    expect(
      buildCanonicalUploadPath("user-1", {
        kind: "images",
        hash: HASH,
        ext: "png",
        size: 1,
        contentType: "image/png",
      }),
    ).toBe(`users/user-1/images/${HASH}.png`);
  });
});

describe("parseCanonicalUploadPath", () => {
  it("parses a canonical path into its components", () => {
    expect(parseCanonicalUploadPath(`users/user-1/images/${HASH}.png`)).toEqual({
      uid: "user-1",
      kind: "images",
      hash: HASH,
      ext: "png",
      path: `users/user-1/images/${HASH}.png`,
    });
  });

  it("lowercases hash and extension found in the path", () => {
    const parsed = parseCanonicalUploadPath(
      `users/user-1/images/${UPPER_HASH}.PNG`,
    );
    expect(parsed).toMatchObject({ hash: HASH, ext: "png" });
  });

  it.each([
    ["undefined", undefined],
    ["an empty string", ""],
    ["too few path segments", "users/user-1/images"],
    ["too many path segments", `users/user-1/images/sub/${HASH}.png`],
    ["a non-users root", `public/user-1/images/${HASH}.png`],
    ["an empty uid segment", `users//images/${HASH}.png`],
    ["a legacy non-archive kind", `users/user-1/link-images/${HASH}.png`],
    ["an empty filename", "users/user-1/images/"],
    ["a filename with no extension", `users/user-1/images/${HASH}`],
    ["a dotfile with no basename", "users/user-1/images/.png"],
    ["a filename ending in a dot", `users/user-1/images/${HASH}.`],
    ["an original (non-hash) filename", "users/user-1/images/photo.png"],
    ["a too-short hash", "users/user-1/images/abc.png"],
    ["a hash with an invalid extension", `users/user-1/images/${HASH}.p!g`],
  ])("returns null for %s", (_label, path) => {
    expect(parseCanonicalUploadPath(path as string | undefined)).toBeNull();
  });
});

describe("STORAGE_QUOTA_BYTES", () => {
  it("is the 5 GiB free-tier limit", () => {
    expect(STORAGE_QUOTA_BYTES).toBe(5 * 1024 * 1024 * 1024);
  });
});
