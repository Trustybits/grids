import { describe, expect, it } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type EmbedContent,
  type Grid,
  type ImageContent,
  type LinkContent,
  type ProfileBioContent,
  type SmartTextContent,
  type Tile,
  type TileContent,
  type VideoContent,
} from "../../types/index.js";
import { extractGridStorageReferences } from "../GridStorageReferences.js";

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [],
    ...overrides,
  };
}

function makeTile(tile: { i: string; content: TileContent }): Tile {
  return {
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    ...tile,
  };
}

describe("extractGridStorageReferences", () => {
  it("returns duplicate archive references as separate rows", () => {
    const grid = makeGrid({
      backgroundImageSrc:
        "https://firebasestorage.googleapis.com/v0/b/demo/o/users%2Fuser-1%2Fimages%2Fbg-hash.png?alt=media",
      backgroundImageHash: "bg-hash",
      tiles: [
        makeTile({
          i: "image-a",
          content: {
            type: ContentType.IMAGE,
            src: "users/user-1/images/shared-hash.png",
            srcHash: "shared-hash",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
        makeTile({
          i: "image-b",
          content: {
            type: ContentType.IMAGE,
            src: "users/user-1/images/shared-hash.png",
            srcHash: "shared-hash",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
      ],
    });

    const references = extractGridStorageReferences(grid);

    expect(references).toHaveLength(3);
    expect(references.map((ref) => ref.hash)).toEqual([
      "bg-hash",
      "shared-hash",
      "shared-hash",
    ]);
    expect(references.filter((ref) => ref.hash === "shared-hash")).toHaveLength(
      2,
    );
  });

  it("uses stored hash fields as the authoritative key", () => {
    const grid = makeGrid({
      tiles: [
        makeTile({
          i: "video",
          content: {
            type: ContentType.VIDEO,
            src: "users/user-1/videos/url-derived.mp4",
            srcHash: "stored-video-hash",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as VideoContent,
        }),
        makeTile({
          i: "documents",
          content: {
            type: ContentType.DOCUMENT,
            items: [
              {
                id: "doc-1",
                fileName: "doc.pdf",
                url: "users/user-1/documents/url-derived.pdf",
                hash: "stored-doc-hash",
              },
            ],
          } as DocumentsContent,
        }),
      ],
    });

    expect(extractGridStorageReferences(grid)).toMatchObject([
      {
        tileId: "video",
        hash: "stored-video-hash",
        kind: "videos",
        source: "stored-hash",
      },
      {
        tileId: "documents",
        documentItemId: "doc-1",
        hash: "stored-doc-hash",
        kind: "documents",
        source: "stored-hash",
      },
    ]);
  });

  it("falls back to user storage URLs for legacy src-only data", () => {
    const grid = makeGrid({
      tiles: [
        makeTile({
          i: "profile",
          content: {
            type: ContentType.PROFILE,
            name: "Taylor",
            title: "",
            bio: "",
            avatarShape: "circle",
            avatarRadius: 50,
            profilePhotoUrl: "gs://bucket/users/user-1/images/avatar-hash.jpg",
          } as ProfileBioContent,
        }),
        makeTile({
          i: "link",
          content: {
            type: ContentType.LINK,
            link: "https://example.com",
            customImageUrl: "users/user-1/images/link-hash.webp",
          } as LinkContent,
        }),
      ],
    });

    expect(extractGridStorageReferences(grid)).toMatchObject([
      {
        location: "tile.profile.profilePhoto",
        hash: "avatar-hash",
        source: "url-fallback",
      },
      {
        location: "tile.link.customImage",
        hash: "link-hash",
        source: "url-fallback",
      },
    ]);
  });

  it("extracts archive-backed smart text inline image URLs", () => {
    const text = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "users/user-1/images/inline-hash.png",
          },
        },
      ],
    });
    const grid = makeGrid({
      tiles: [
        makeTile({
          i: "smart",
          content: {
            type: ContentType.SMART_TEXT,
            text,
            font: "Inter",
            fontSize: 16,
            isBold: false,
            isItalic: false,
            textType: "paragraph",
            color: "#000",
          } as SmartTextContent,
        }),
      ],
    });

    expect(extractGridStorageReferences(grid)).toMatchObject([
      {
        location: "tile.smartText.inlineImage",
        tileId: "smart",
        hash: "inline-hash",
        kind: "images",
      },
    ]);
  });

  it("ignores external, generated, thumbnail, transient, and other-owner URLs", () => {
    const grid = makeGrid({
      ogImageSrc: "users/user-1/images/og-ignored.png",
      tiles: [
        makeTile({
          i: "image",
          content: {
            type: ContentType.IMAGE,
            src: "blob:http://localhost/preview",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
        makeTile({
          i: "documents",
          content: {
            type: ContentType.DOCUMENT,
            items: [
              {
                id: "doc-1",
                fileName: "doc.pdf",
                url: "data:application/pdf;base64,abc",
                thumbnailUrl: "thumbnails/documents/user-1/doc-1.png",
              },
            ],
          } as DocumentsContent,
        }),
        makeTile({
          i: "link",
          content: {
            type: ContentType.LINK,
            link: "https://example.com",
            faviconUrl: "https://www.google.com/s2/favicons?domain=example.com",
            metaImageUrl: "https://cdn.example.com/og.png",
            customImageUrl: "https://cdn.example.com/custom.png",
          } as LinkContent,
        }),
        makeTile({
          i: "embed",
          content: {
            type: ContentType.EMBED,
            src: "users/user-1/images/embed-ignored.png",
          } as EmbedContent,
        }),
        makeTile({
          i: "other-owner",
          content: {
            type: ContentType.IMAGE,
            src: "users/user-2/images/not-owned.png",
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          } as ImageContent,
        }),
      ],
    });

    expect(extractGridStorageReferences(grid)).toEqual([]);
  });
});
