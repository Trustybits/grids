import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v1/https";
import {
  getCallableData,
  requireAuth,
  requireStringFields,
} from "../utils_callable.js";

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as HttpsError).message).toBe(message);
}

describe("getCallableData", () => {
  it("returns the payload object with its existing fields", () => {
    const data = { gridId: "grid-1", count: 2 };

    expect(getCallableData<{ gridId: string; count: number }>(data)).toEqual(data);
  });

  it("normalizes nullish callable data to an empty object", () => {
    expect(getCallableData(undefined)).toEqual({});
    expect(getCallableData(null)).toEqual({});
  });
});

describe("requireAuth", () => {
  it("returns the authenticated uid", () => {
    expect(requireAuth({ auth: { uid: "user-1" } }, "Sign in required.")).toBe(
      "user-1",
    );
  });

  it.each([
    ["missing auth", {}],
    ["null auth", { auth: null }],
    ["missing uid", { auth: {} }],
    ["empty uid", { auth: { uid: "" } }],
  ])("throws unauthenticated for %s", (_label, context) => {
    try {
      requireAuth(context, "Custom auth message.");
      throw new Error("Expected requireAuth to throw");
    } catch (error) {
      expectHttpsError(error, "unauthenticated", "Custom auth message.");
    }
  });
});

describe("requireStringFields", () => {
  it("returns the required string fields and ignores unrelated fields", () => {
    expect(
      requireStringFields(
        {
          gridId: "grid-1",
          tileId: "tile-1",
          extra: 123,
        },
        ["gridId", "tileId"],
        "Missing gridId or tileId.",
      ),
    ).toEqual({
      gridId: "grid-1",
      tileId: "tile-1",
    });
  });

  it("preserves exact string values without trimming", () => {
    expect(
      requireStringFields(
        { slug: "  my-slug  " },
        ["slug"],
        "Slug is required.",
      ),
    ).toEqual({ slug: "  my-slug  " });
  });

  it.each([
    ["undefined data", undefined],
    ["null data", null],
    ["missing field", {}],
    ["undefined field", { slug: undefined }],
    ["null field", { slug: null }],
    ["empty string", { slug: "" }],
    ["number field", { slug: 123 }],
    ["boolean field", { slug: true }],
    ["array field", { slug: ["abc"] }],
    ["object field", { slug: { value: "abc" } }],
  ])("throws invalid-argument for %s", (_label, data) => {
    try {
      requireStringFields(data, ["slug"], "Slug is required.");
      throw new Error("Expected requireStringFields to throw");
    } catch (error) {
      expectHttpsError(error, "invalid-argument", "Slug is required.");
    }
  });

  it("throws invalid-argument when any required field is invalid", () => {
    try {
      requireStringFields(
        { gridId: "grid-1", tileId: "" },
        ["gridId", "tileId"],
        "Missing gridId or tileId.",
      );
      throw new Error("Expected requireStringFields to throw");
    } catch (error) {
      expectHttpsError(error, "invalid-argument", "Missing gridId or tileId.");
    }
  });
});
