import { type Grid } from "@grids/contracts/types";
import type { GridServiceInterface } from "../interfaces/GridServiceInterface";
import { ContentType } from "@grids/contracts/types";
import { createTile, createTileContent } from "@/utils/TileUtils";

const mockData: Grid = {
  id: "mock-grid-id",
  name: "Mock Grid",
  colNum: 16,
  verticalCompact: false,
  userId: "me",
  rev: 0,
  tiles: [
    createTile(
      ContentType.TEXT,
      "0",
      0,
      0,
      3,
      4,
      createTileContent(ContentType.TEXT, {
        text: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontFamily":"Times New Roman","fontSize":"26px"}}],"text":"Big Text"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontFamily":"","fontSize":"12px"}}],"text":"Small Text"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontFamily":"","fontSize":"14px"}},{"type":"bold"}],"text":"Bold Text"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontFamily":"","fontSize":"14px"}},{"type":"italic"}],"text":"Italic Text"}]},{"type":"paragraph","content":[{"type":"text","marks":[{"type":"textStyle","attrs":{"color":"rgb(140, 255, 0)","fontFamily":"","fontSize":"14px"}}],"text":"Different colored text"}]},{"type":"paragraph"},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bullet Text"}]}]}]},{"type":"orderedList","attrs":{"start":1},"content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Numbered Text"}]}]}]},{"type":"paragraph"},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Unchecked"}]}]},{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Checked"}]},{"type":"paragraph"}]}]}]}',
      }),
      "",
    ),
    createTile(
      ContentType.IMAGE,
      "1",
      3,
      0,
      3,
      2,
      createTileContent(ContentType.IMAGE, {
        src: "https://static1.colliderimages.com/wordpress/wp-content/uploads/2022/06/Star-Wars-(1).jpg",
      }),
      "",
    ),
    createTile(
      ContentType.LINK,
      "2",
      0,
      2,
      4,
      1,
      createTileContent(ContentType.LINK, {
        link: "https://www.youtube.com/watch?v=eaEMSKzqGAg",
        domain: "youtube.com",
        faviconUrl:
          "https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=youtube.com",
      }),
      "",
    ),
  ],
  backgroundImageSrc: "",
  backgroundEmbed: false,
};

export class MockGridService implements GridServiceInterface {
  async fetchGrid(id: string): Promise<Grid> {
    console.warn(`Fetching grid with id: ${id}`);
    return { ...mockData };
  }

  async saveGrid(grid: Grid): Promise<Grid> {
    console.warn(`Saving grid`);
    return { ...grid, rev: (grid.rev ?? 0) + 1 };
  }

  async updateGrid(grid: Grid): Promise<Grid> {
    console.warn(`Updating grid`);
    return { ...grid, rev: (grid.rev ?? 0) + 1 };
  }

  async deleteGrid(id: string): Promise<void> {
    console.warn(`Deleting grid with id: ${id}`);
  }

  async fetchGridsByUserId(_userId: string): Promise<Grid[]> {
    return [];
  }

  generateId(): string {
    return "mock-id";
  }

  async createGrid(
    _userId: string,
    _name: string,
    _starterTiles?: Grid["tiles"],
  ): Promise<Grid> {
    return { ...mockData };
  }

  async duplicateGrid(
    _userId: string,
    _sourceGrid: Grid,
    _clonedTiles: Grid["tiles"],
    _newOverrides: Grid["overrides"],
  ): Promise<Grid> {
    return { ...mockData };
  }

  async touchLastOpenedAt(_gridId: string): Promise<void> {}

  async loadRecentGridIds(_userId: string): Promise<string[]> {
    return [];
  }

  async saveRecentGridIds(_userId: string, _ids: string[]): Promise<void> {}

  async createGridWithStarterTiles(
    _userId: string,
    _name: string,
  ): Promise<Grid> {
    return { ...mockData };
  }

  async cloneAndPersistGrid(
    _userId: string,
    _sourceGrid: Grid,
    _copyDepth?: import("@grids/contracts/types").CopyDepth,
  ): Promise<Grid> {
    return { ...mockData };
  }
}
