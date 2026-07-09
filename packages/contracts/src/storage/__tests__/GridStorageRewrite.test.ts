import { describe, expect, it } from "vitest";
import {
  ContentType,
  type DocumentsContent,
  type Grid,
  type ImageContent,
  type LinkContent,
  type ProfileBioContent,
  type SmartTextContent,
  type Tile,
  type TileContent,
  type VideoContent,
} from "../../types/index.js";
import {
  rewriteArchiveBackedContent,
  rewriteBackgroundImage,
  rewriteTiptapImages,
  type GridStorageRewritePlan,
} from "../GridStorageRewrite.js";

const OLD_HASH = "a".repeat(64);
const NEW_HASH = "b".repeat(64);
const OLD_URL = "https://cdn.example/old.png";
const NEW_URL = "https://cdn.example/new.png";

const rewritePlan: GridStorageRewritePlan = {
  rewriteMap: {
    [OLD_HASH]: {
      oldHash: OLD_HASH,
      oldUrl: OLD_URL,
      newHash: NEW_HASH,
      newUrl: NEW_URL,
    },
  },
};

function makeTile(content: TileContent): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    caption: "",
    content,
  };
}

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

describe("GridStorageRewrite", () => {
  it("rewrites image and video source fields by hash", () => {
    const imageTile = makeTile({
      type: ContentType.IMAGE,
      src: OLD_URL,
      srcHash: OLD_HASH,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    } as ImageContent);
    const videoTile = makeTile({
      type: ContentType.VIDEO,
      src: OLD_URL,
      srcHash: OLD_HASH,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    } as VideoContent);

    rewriteArchiveBackedContent(imageTile, rewritePlan);
    rewriteArchiveBackedContent(videoTile, rewritePlan);

    expect(imageTile.content).toMatchObject({
      src: NEW_URL,
      srcHash: NEW_HASH,
    });
    expect(videoTile.content).toMatchObject({
      src: NEW_URL,
      srcHash: NEW_HASH,
    });
  });

  it("rewrites document item urls by hash without mutating unrelated items", () => {
    const tile = makeTile({
      type: ContentType.DOCUMENT,
      items: [
        {
          id: "doc-1",
          fileName: "one.pdf",
          url: OLD_URL,
          hash: OLD_HASH,
        },
        {
          id: "doc-2",
          fileName: "two.pdf",
          url: "https://cdn.example/other.pdf",
          hash: "c".repeat(64),
        },
      ],
    } as DocumentsContent);

    rewriteArchiveBackedContent(tile, rewritePlan);

    expect((tile.content as DocumentsContent).items).toEqual([
      {
        id: "doc-1",
        fileName: "one.pdf",
        url: NEW_URL,
        hash: NEW_HASH,
      },
      {
        id: "doc-2",
        fileName: "two.pdf",
        url: "https://cdn.example/other.pdf",
        hash: "c".repeat(64),
      },
    ]);
  });

  it("rewrites link and profile image fields by hash", () => {
    const linkTile = makeTile({
      type: ContentType.LINK,
      link: "https://example.com",
      customImageUrl: OLD_URL,
      customImageHash: OLD_HASH,
    } as LinkContent);
    const profileTile = makeTile({
      type: ContentType.PROFILE,
      name: "Taylor",
      title: "",
      bio: "",
      avatarShape: "circle",
      avatarRadius: 50,
      profilePhotoUrl: OLD_URL,
      profilePhotoHash: OLD_HASH,
    } as ProfileBioContent);

    rewriteArchiveBackedContent(linkTile, rewritePlan);
    rewriteArchiveBackedContent(profileTile, rewritePlan);

    expect(linkTile.content).toMatchObject({
      customImageUrl: NEW_URL,
      customImageHash: NEW_HASH,
    });
    expect(profileTile.content).toMatchObject({
      profilePhotoUrl: NEW_URL,
      profilePhotoHash: NEW_HASH,
    });
  });

  it("rewrites smart text image attrs by hash", () => {
    const text = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: OLD_URL,
            hash: OLD_HASH,
          },
        },
      ],
    });
    const tile = makeTile({
      type: ContentType.SMART_TEXT,
      text,
      font: "Inter",
      fontSize: 16,
      isBold: false,
      isItalic: false,
      textType: "paragraph",
      color: "#000",
    } as SmartTextContent);

    rewriteArchiveBackedContent(tile, rewritePlan);

    expect(JSON.parse((tile.content as SmartTextContent).text)).toMatchObject({
      content: [
        {
          attrs: {
            src: NEW_URL,
            hash: NEW_HASH,
          },
        },
      ],
    });
  });

  it("returns invalid smart text json unchanged", () => {
    expect(rewriteTiptapImages("{", rewritePlan)).toBe("{");
  });

  it("rewrites or removes grid background image fields", () => {
    const grid = makeGrid({
      backgroundImageSrc: OLD_URL,
      backgroundImageHash: OLD_HASH,
    });

    expect(rewriteBackgroundImage(grid, rewritePlan)).toEqual({
      backgroundImageSrc: NEW_URL,
      backgroundImageHash: NEW_HASH,
    });
    expect(
      rewriteBackgroundImage(grid, { removeBackgroundImage: true }),
    ).toEqual({
      backgroundImageSrc: "",
      backgroundImageHash: "",
    });
  });

  it("supports ownership-transfer rewrites where the hash is unchanged", () => {
    const transferUrl = "https://cdn.example/recipient.png";
    const tile = makeTile({
      type: ContentType.IMAGE,
      src: OLD_URL,
      srcHash: OLD_HASH,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    } as ImageContent);

    rewriteArchiveBackedContent(tile, {
      rewriteMap: {
        [OLD_HASH]: {
          newHash: OLD_HASH,
          newUrl: transferUrl,
        },
      },
    });

    expect(tile.content).toMatchObject({
      src: transferUrl,
      srcHash: OLD_HASH,
    });
  });
});
