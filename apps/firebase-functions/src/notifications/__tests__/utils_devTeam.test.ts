import { describe, expect, it } from "vitest";
import { isDevTeamMember } from "../utils_devTeam.js";

describe("isDevTeamMember", () => {
  it("returns true for a configured dev-team uid", () => {
    expect(isDevTeamMember("F4vIerh5rzgEGrlWKugF17lSoeq2")).toBe(true);
  });

  it.each([
    ["trustybits domain", "person@trustybits.com"],
    ["grids domain", "person@grids.so"],
    ["uppercase email", "PERSON@GRIDS.SO"],
    ["plus-addressed email", "dev+test@trustybits.com"],
  ])("returns true for %s", (_label, email) => {
    expect(isDevTeamMember(undefined, email)).toBe(true);
  });

  it("returns true when either uid or email matches", () => {
    expect(isDevTeamMember("external-uid", "person@grids.so")).toBe(true);
  });

  it.each([
    ["no inputs", undefined, undefined],
    ["unknown uid only", "user-1", undefined],
    ["external email only", undefined, "person@example.com"],
    ["unknown uid and external email", "user-1", "person@example.com"],
  ])("returns false for %s", (_label, uid, email) => {
    expect(isDevTeamMember(uid, email)).toBe(false);
  });
});
