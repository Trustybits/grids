import { registerTile } from "@/registries/tileRegistry";
import { textDefinition } from "./text";
import { smartTextDefinition } from "./smartText";
import { chatDefinition } from "./chat";
import { imageDefinition } from "./image";
import { videoDefinition } from "./video";
import { linkDefinition } from "./link";
import { embedDefinition } from "./embed";
import { mapDefinition } from "./map";
import { campfireDefinition } from "./campfire";
import { suggestionDefinition } from "./suggestion";
import { profileDefinition } from "./profile";
import { youtubeDefinition } from "./youtube";
import { roadmapFeedDefinition } from "./roadmapFeed";
import { musicDefinition } from "./music";
import { documentDefinition } from "./document";
import { brandDefinition } from "./brand";

export function registerAllTiles(): void {
  registerTile(textDefinition);
  registerTile(smartTextDefinition);
  registerTile(chatDefinition);
  registerTile(imageDefinition);
  registerTile(videoDefinition);
  registerTile(linkDefinition);
  registerTile(embedDefinition);
  registerTile(mapDefinition);
  registerTile(campfireDefinition);
  registerTile(suggestionDefinition);
  registerTile(profileDefinition);
  registerTile(youtubeDefinition);
  registerTile(roadmapFeedDefinition);
  registerTile(musicDefinition);
  registerTile(documentDefinition);
  registerTile(brandDefinition);
}

// Self-register on module evaluation so tiles are available to any
// downstream module that imports createTileContent at the top level.
registerAllTiles();

export {
  textDefinition,
  smartTextDefinition,
  chatDefinition,
  imageDefinition,
  videoDefinition,
  linkDefinition,
  embedDefinition,
  mapDefinition,
  campfireDefinition,
  suggestionDefinition,
  profileDefinition,
  youtubeDefinition,
  roadmapFeedDefinition,
  musicDefinition,
  documentDefinition,
  brandDefinition,
};
