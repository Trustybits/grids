import { describe, expect, it } from "vitest";
import { selectGridFacadeLoading } from "../gridFacadePolicy";

describe("grid facade loading policy", () => {
  it.each([
    {
      collectionLoading: false,
      sessionLoading: false,
      expected: false,
    },
    {
      collectionLoading: true,
      sessionLoading: false,
      expected: true,
    },
    {
      collectionLoading: false,
      sessionLoading: true,
      expected: true,
    },
    {
      collectionLoading: true,
      sessionLoading: true,
      expected: true,
    },
  ])(
    "returns $expected for collection=$collectionLoading and session=$sessionLoading",
    ({ collectionLoading, sessionLoading, expected }) => {
      expect(
        selectGridFacadeLoading({
          collectionLoading,
          sessionLoading,
        }),
      ).toBe(expected);
    },
  );

  it("remains loading when one overlapping operation finishes", () => {
    expect(
      selectGridFacadeLoading({
        collectionLoading: false,
        sessionLoading: true,
      }),
    ).toBe(true);
  });
});
