import { describe, expect, it } from "vitest";
import { xPostRefreshAfterMs } from "../TileContent.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Created 2026-09-23T01:37:52.099Z, read from the ID.
const POST_ID = "2102573127192727704";
const CREATED_AT = Date.parse("2026-09-23T01:37:52.099Z");

describe("xPostRefreshAfterMs", () => {
  it.each([
    ["a post under 2 days old", CREATED_AT + DAY, 6 * HOUR],
    ["a post under a week old", CREATED_AT + 3 * DAY, DAY],
    ["an older post", CREATED_AT + 30 * DAY, 7 * DAY],
  ])("refreshes %s on its own schedule", (_label, now, expected) => {
    expect(xPostRefreshAfterMs(POST_ID, now)).toBe(expected);
  });

  it("treats IDs it can't read as old posts", () => {
    expect(xPostRefreshAfterMs("not-a-number", CREATED_AT)).toBe(7 * DAY);
  });
});
