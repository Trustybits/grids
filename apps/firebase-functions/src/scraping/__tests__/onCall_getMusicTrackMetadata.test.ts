import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

vi.mock("firebase-functions/v1", () => ({
  https: {
    onCall: (handler: unknown) => handler,
  },
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock();
});

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

import { getMusicTrackMetadata as callable } from "../onCall_getMusicTrackMetadata.js";

const getMusicTrackMetadata = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

beforeEach(() => {
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMusicTrackMetadata", () => {
  it("returns null without validating auth or fetching when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getMusicTrackMetadata({}, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("getMusicTrackMetadata");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires an authenticated caller", async () => {
    await expect(
      getMusicTrackMetadata({ platform: "spotify", trackId: "track-1" }, {}),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "unauthenticated",
        "You must be signed in to fetch music metadata.",
      );
      return true;
    });
  });

  it.each([
    ["missing data", undefined],
    ["missing platform", { trackId: "track-1" }],
    ["missing trackId", { platform: "spotify" }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(
      getMusicTrackMetadata(data, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Missing platform or trackId.");
      return true;
    });
  });

  it("rejects unsupported platforms", async () => {
    await expect(
      getMusicTrackMetadata(
        { platform: "tidal", trackId: "track-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Unsupported platform: tidal");
      return true;
    });
  });

  it("maps Spotify track embed data to music metadata", async () => {
    const nextData = {
      props: {
        pageProps: {
          state: {
            data: {
              entity: {
                id: "track-entity",
                name: "Song",
                artists: [
                  { name: "Artist", uri: "spotify:artist:artist-1" },
                  { name: "Guest", uri: "spotify:artist:artist-2" },
                ],
                audioPreview: { url: "https://preview.test/song.mp3" },
                visualIdentity: {
                  image: [{ url: "https://image.test/art.jpg" }],
                  backgroundBase: { red: 1, green: 2, blue: 3, alpha: 0.9 },
                  backgroundTintedBase: { red: 4, green: 5, blue: 6 },
                  textSubdued: { red: 7, green: 8, blue: 9, alpha: 0.5 },
                },
              },
            },
          },
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        text: async () =>
          `<script id="__NEXT_DATA__">${JSON.stringify(nextData)}</script>`,
      }),
    );

    await expect(
      getMusicTrackMetadata(
        { platform: "spotify", trackId: "track-1" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toEqual({
      trackName: "Song",
      artistName: "Artist, Guest",
      albumArt: "https://image.test/art.jpg",
      previewUrl: "https://preview.test/song.mp3",
      trackUrl: "https://open.spotify.com/track/track-entity",
      artistUrl: "https://open.spotify.com/artist/artist-1",
      backgroundColor: "rgba(1, 2, 3, 0.9)",
      backgroundTinted: "rgba(4, 5, 6, 1)",
      textSubdued: "rgba(7, 8, 9, 0.5)",
    });
  });

  it("uses the first Spotify album track as the representative entity", async () => {
    const nextData = {
      props: {
        pageProps: {
          state: {
            data: {
              entity: {
                name: "Album",
                artists: [{ name: "Album Artist", uri: "spotify:artist:artist-1" }],
                visualIdentity: {},
                tracks: {
                  items: [
                    {
                      id: "track-from-album",
                      name: "First Track",
                      audioPreview: { url: "https://preview.test/first.mp3" },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        text: async () =>
          `<script id="__NEXT_DATA__">${JSON.stringify(nextData)}</script>`,
      }),
    );

    await expect(
      getMusicTrackMetadata(
        { platform: "spotify", trackId: "album-1", trackType: "album" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toMatchObject({
      trackName: "First Track",
      artistName: "Album Artist",
      trackUrl: "https://open.spotify.com/album/album-1",
      backgroundColor: "rgba(30, 30, 30, 1)",
      backgroundTinted: "rgba(50, 50, 50, 1)",
      textSubdued: "rgba(180, 180, 180, 1)",
    });
  });

  it("throws not-found when Spotify embed data cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ text: async () => "<html></html>" }),
    );

    await expect(
      getMusicTrackMetadata(
        { platform: "spotify", trackId: "track-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "Could not parse Spotify embed data.");
      return true;
    });
  });

  it("maps Apple Music iTunes and embed color data to music metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            results: [
              {
                trackName: "Apple Song",
                artistName: "Apple Artist",
                artworkUrl100: "https://image.test/100x100bb.jpg",
                previewUrl: "https://preview.test/apple.m4a",
                trackViewUrl: "https://music.apple.com/song/apple-song",
                artistViewUrl: "https://music.apple.com/artist/apple-artist",
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        text: async () => "<style>body{background:#336699}</style>",
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getMusicTrackMetadata(
        { platform: "apple", trackId: "123" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toEqual({
      trackName: "Apple Song",
      artistName: "Apple Artist",
      albumArt: "https://image.test/600x600bb.jpg",
      previewUrl: "https://preview.test/apple.m4a",
      trackUrl: "https://music.apple.com/song/apple-song",
      artistUrl: "https://music.apple.com/artist/apple-artist",
      backgroundColor: "rgba(51, 102, 153, 1)",
      backgroundTinted: "rgba(43, 87, 130, 1)",
      textSubdued: "rgba(143, 171, 199, 1)",
    });
  });

  it("uses Apple defaults when embed color scraping fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          text: async () =>
            JSON.stringify({
              results: [
                {
                  collectionName: "Collection Title",
                  artistName: "Apple Artist",
                  artworkUrl100: "",
                },
              ],
            }),
        })
        .mockRejectedValueOnce(new Error("embed unavailable")),
    );

    await expect(
      getMusicTrackMetadata(
        { platform: "apple", trackId: "123" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toMatchObject({
      trackName: "Collection Title",
      artistName: "Apple Artist",
      trackUrl: "https://music.apple.com/us/song/123",
      backgroundColor: "rgba(30, 30, 30, 1)",
      backgroundTinted: "rgba(50, 50, 50, 1)",
      textSubdued: "rgba(180, 180, 180, 1)",
    });
  });

  it("throws not-found when iTunes lookup has no track", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        text: async () => JSON.stringify({ results: [] }),
      }),
    );

    await expect(
      getMusicTrackMetadata(
        { platform: "apple", trackId: "missing" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "Track not found in iTunes lookup.");
      return true;
    });
  });

  it("logs and throws internal for unexpected fetch or parse failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(
      getMusicTrackMetadata(
        { platform: "spotify", trackId: "track-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "internal", "Failed to fetch music track metadata.");
      return true;
    });

    expect(logger.error).toHaveBeenCalledWith("Failed to fetch music track metadata", {
      error: "Error: network down",
      platform: "spotify",
      trackId: "track-1",
    });
  });
});
