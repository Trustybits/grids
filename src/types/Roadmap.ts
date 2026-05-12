import type { RoadmapItem } from "./TileContent";

/** A Notion database available to the connected integration. */
export interface NotionDatabase {
  id: string;
  title: string;
}

/** A property/column on a Notion database, with its select options if applicable. */
export interface PropertyOption {
  name: string;
  type: string;
  selectOptions?: string[];
}

/** Result of fetching a roadmap feed from Notion. */
export interface FetchRoadmapResult {
  items: RoadmapItem[];
  propertyOptions: PropertyOption[];
}
