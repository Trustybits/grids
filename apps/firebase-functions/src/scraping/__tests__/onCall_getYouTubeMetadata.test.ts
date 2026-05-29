import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { secretState } = vi.hoisted(() => ({
  secretState: {
    apiKey: "youtube-key",
  },
}));

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    https: {
      onCall: (handler: unknown) => handler,
    },
  })),
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock();
});

vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn(() => ({
    value: () => secretState.apiKey,
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

import { getYouTubeMetadata as callable } from "../onCall_getYouTubeMetadata.js";

const getYouTubeMetadata = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

beforeEach(() => {
  secretState.apiKey = "youtube-key";
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getYouTubeMetadata", () => {
  it("returns null without validating auth or fetching when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getYouTubeMetadata({}, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("getYouTubeMetadata");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires an authenticated caller", async () => {
    await expect(
      getYouTubeMetadata({ youtubeType: "video", youtubeId: "video-1" }, {}),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "unauthenticated",
        "You must be signed in to fetch YouTube metadata.",
      );
      return true;
    });
  });

  it.each([
    ["missing data", undefined],
    ["missing youtubeType", { youtubeId: "video-1" }],
    ["missing youtubeId", { youtubeType: "video" }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(
      getYouTubeMetadata(data, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Missing youtubeType or youtubeId.");
      return true;
    });
  });

  it("rejects invalid YouTube types", async () => {
    await expect(
      getYouTubeMetadata(
        { youtubeType: "clip", youtubeId: "video-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Invalid youtubeType: clip");
      return true;
    });
  });

  it("throws failed-precondition when the API key secret is missing", async () => {
    secretState.apiKey = "";

    await expect(
      getYouTubeMetadata(
        { youtubeType: "video", youtubeId: "video-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "failed-precondition", "YouTube API not configured.");
      return true;
    });
    expect(logger.error).toHaveBeenCalledWith("YouTube API key not configured");
  });

  it("fetches video metadata and channel thumbnail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        okJson({
          items: [
            {
              snippet: {
                title: "Video",
                description: "Description",
                thumbnails: { high: { url: "thumb" } },
                publishedAt: "2026-01-01",
                channelTitle: "Channel",
                channelId: "channel-1",
                categoryId: "22",
              },
              statistics: {
                viewCount: "100",
                likeCount: "10",
                commentCount: "2",
              },
              contentDetails: { duration: "PT1M" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          items: [
            {
              snippet: {
                thumbnails: { default: { url: "channel-thumb" } },
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getYouTubeMetadata(
        { youtubeType: "video", youtubeId: "video-1" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toEqual({
      title: "Video",
      description: "Description",
      thumbnails: { high: { url: "thumb" } },
      publishedAt: "2026-01-01",
      channelTitle: "Channel",
      channelId: "channel-1",
      channelThumbnail: "channel-thumb",
      duration: "PT1M",
      viewCount: "100",
      likeCount: "10",
      commentCount: "2",
      categoryId: "22",
    });
  });

  it("treats shorts as videos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        okJson({
          items: [
            {
              snippet: { title: "Short", channelTitle: "Channel" },
              statistics: {},
              contentDetails: {},
            },
          ],
        }),
      ),
    );

    await expect(
      getYouTubeMetadata(
        { youtubeType: "short", youtubeId: "short-1" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toMatchObject({ title: "Short" });
  });

  it("throws not-found when video API returns an error or no items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }));

    await expect(
      getYouTubeMetadata(
        { youtubeType: "video", youtubeId: "missing" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "YouTube video not found.");
      return true;
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJson({ items: [] })));
    await expect(
      getYouTubeMetadata(
        { youtubeType: "video", youtubeId: "missing" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "YouTube video not found.");
      return true;
    });
  });

  it("fetches playlist metadata and maps first playlist items", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          okJson({
            items: [
              {
                snippet: {
                  title: "Playlist",
                  description: "Playlist desc",
                  thumbnails: { high: { url: "playlist-thumb" } },
                  publishedAt: "2026-01-01",
                  channelTitle: "Channel",
                  channelId: "channel-1",
                },
                contentDetails: { itemCount: 2 },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          okJson({
            items: [
              {
                snippet: {
                  resourceId: { videoId: "video-1" },
                  title: "Video 1",
                  thumbnails: {},
                  channelTitle: "Channel",
                },
              },
            ],
          }),
        ),
    );

    await expect(
      getYouTubeMetadata(
        { youtubeType: "playlist", youtubeId: "playlist-1" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toMatchObject({
      title: "Playlist",
      itemCount: 2,
      playlistItems: [
        {
          videoId: "video-1",
          title: "Video 1",
          thumbnails: {},
          channelTitle: "Channel",
          position: 0,
        },
      ],
    });
  });

  it("resolves channel handles and fetches recent uploads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson({ items: [{ id: "UC123" }] }))
      .mockResolvedValueOnce(
        okJson({
          items: [
            {
              id: "UC123",
              snippet: {
                title: "Channel",
                description: "Channel desc",
                customUrl: "@channel",
                thumbnails: { high: { url: "channel-thumb" } },
              },
              statistics: {
                subscriberCount: "1000",
                videoCount: "20",
                viewCount: "2000",
              },
              contentDetails: {
                relatedPlaylists: { uploads: "uploads-1" },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          items: [
            {
              snippet: {
                resourceId: { videoId: "recent-1" },
                title: "Recent",
                thumbnails: {},
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getYouTubeMetadata(
        { youtubeType: "channel", youtubeId: "handle" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toMatchObject({
      channelData: {
        channelId: "UC123",
        title: "Channel",
        subscriberCount: "1000",
      },
      recentVideos: [
        {
          videoId: "recent-1",
          title: "Recent",
          thumbnails: {},
          channelTitle: "Channel",
          position: 0,
        },
      ],
    });
    expect(fetchMock.mock.calls[0][0]).toContain("forHandle=%40handle");
  });

  it("falls back through username and search when resolving a channel", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson({ items: [] }))
      .mockResolvedValueOnce(okJson({ items: [] }))
      .mockResolvedValueOnce(okJson({ items: [{ snippet: { channelId: "UC999" } }] }))
      .mockResolvedValueOnce(
        okJson({
          items: [
            {
              id: "UC999",
              snippet: { title: "Found Channel", thumbnails: {} },
              statistics: {},
              contentDetails: {},
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getYouTubeMetadata(
        { youtubeType: "channel", youtubeId: "legacyUser" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toMatchObject({
      channelData: { channelId: "UC999", title: "Found Channel" },
    });
    expect(fetchMock.mock.calls[1][0]).toContain("forUsername=legacyUser");
    expect(fetchMock.mock.calls[2][0]).toContain("type=channel");
  });

  it("throws not-found for missing playlists and channels", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJson({ items: [] })));
    await expect(
      getYouTubeMetadata(
        { youtubeType: "playlist", youtubeId: "missing" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "YouTube playlist not found.");
      return true;
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okJson({ items: [] })));
    await expect(
      getYouTubeMetadata(
        { youtubeType: "channel", youtubeId: "UCmissing" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "YouTube channel not found.");
      return true;
    });
  });

  it("logs and throws internal for unexpected network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(
      getYouTubeMetadata(
        { youtubeType: "video", youtubeId: "video-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "internal", "Failed to fetch YouTube metadata.");
      return true;
    });

    expect(logger.error).toHaveBeenCalledWith("Failed to fetch YouTube metadata", {
      error: "Error: network down",
      youtubeType: "video",
      youtubeId: "video-1",
    });
  });
});
