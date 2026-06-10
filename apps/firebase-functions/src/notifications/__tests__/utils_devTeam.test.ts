import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDevTeamMember } from "../utils_devTeam.js";

describe("isDevTeamMember", () => {
  beforeEach(() => {
    process.env.DEV_TEAM_USER_IDS = "dev-team-uid-1, dev-team-uid-2";
  });

  afterEach(() => {
    delete process.env.DEV_TEAM_USER_IDS;
  });

  it("returns true for a configured dev-team uid", () => {
    expect(isDevTeamMember("dev-team-uid-1")).toBe(true);
  });

  it("trims and matches additional uids from the comma-separated env var", () => {
    expect(isDevTeamMember("dev-team-uid-2")).toBe(true);
  });

  it("returns false for a configured uid once the env var is absent", () => {
    delete process.env.DEV_TEAM_USER_IDS;
    expect(isDevTeamMember("dev-team-uid-1")).toBe(false);
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
