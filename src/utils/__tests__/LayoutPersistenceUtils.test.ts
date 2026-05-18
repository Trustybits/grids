import { describe, it, expect } from "vitest";
import { ContentType } from "@/types/TileContent";
import { stripBlobUrlsFromTiles } from "../layoutPersistenceUtils";

describe("stripBlobUrlsFromTiles", () => {
  it("clears blob src and document item urls", () => {
    const tiles = [
      {
        i: "1",
        content: {
          type: ContentType.IMAGE,
          src: "blob:http://x",
        },
      },
      {
        i: "2",
        content: {
          type: ContentType.DOCUMENT,
          items: [
            { id: "a", fileName: "f.pdf", url: "blob:http://y" },
            { id: "b", fileName: "g.pdf", url: "https://ok" },
          ],
        },
      },
    ];

    const out = stripBlobUrlsFromTiles(tiles) as typeof tiles;
    const c0 = out[0]?.content as { src?: string };
    const c1 = out[1]?.content as {
      items: Array<{ url: string }>;
    };
    expect(c0.src).toBe("");
    expect(c1.items[0]?.url).toBe("");
    expect(c1.items[1]?.url).toBe("https://ok");
  });
});
