import { type Layout } from "@/types/Layout";
import { type LayoutService } from "./LayoutService";
import { ContentType } from "@/types/TileContent";
import { createTile, createTileContent } from "@/utils/TileUtils";

const mockData: Layout = {
  id: "mock-layout-id",
  name: "Mock Layout",
  colNum: 16,
  verticalCompact: false,
  userId: "me",
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
      ""
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
      ""
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
      ""
    ),
  ],
  backgroundImageSrc: "",
  backgroundEmbed: false,
};

export class MockLayoutService implements LayoutService {
  async fetchLayout(id: string): Promise<Layout> {
    console.log(`Fetching layout with id: ${id}`);
    return { ...mockData };
  }

  async saveLayout(layout: Layout): Promise<void> {
    console.log(`Saving layout`);
  }

  async updateLayout(layout: Layout): Promise<void> {
    console.log(`Updating layout`);
  }

  async deleteLayout(id: string): Promise<void> {
    console.log(`Deleting layout with id: ${id}`);
  }
}
