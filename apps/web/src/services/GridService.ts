import { type Grid, type CopyDepth, type Breakpoint, type TilePosition, type Tile } from "@grids/contracts/types";
import { ContentType, type AnyTileContent, type ChatContent, type DocumentsContent, type SuggestionAction } from "@grids/contracts/types";
import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import { getDbUtils } from "@/dao/DbUtilsSingleton";
import type { DbUtils } from "@grids/contracts/dao";
import type { GridDao } from "@grids/contracts/dao";
import type { UserDao } from "@grids/contracts/dao";
import { createDefaultGrid } from "@/utils/GridUtils";
import { createTile, createTileContent } from "@/utils/TileUtils";
import { stripBlobUrlsFromTiles } from "@/utils/GridPersistenceUtils";
import { v4 as uuidv4 } from "uuid";
import heroGif from "@/assets/images/hero.gif";
import type { IGridService } from "./interfaces/IGridService";

// ── Helpers ─────────────────────────────────────────────────────────────

// Maps a real tile content type to the best-matching suggestion action so that
// structure-only copies produce useful placeholder tiles instead of empty
// typed tiles the user can't do anything with.
const contentTypeToSuggestionAction = (type: ContentType): SuggestionAction => {
  switch (type) {
    case ContentType.TEXT:
    case ContentType.CHAT:
    case ContentType.CAMPFIRE:
      return "text";
    case ContentType.IMAGE:
    case ContentType.VIDEO:
    case ContentType.DOCUMENT:
      return "media";
    case ContentType.LINK:
      return "link";
    case ContentType.EMBED:
    case ContentType.YOUTUBE:
    case ContentType.MUSIC:
    case ContentType.MAP:
    case ContentType.ROADMAP_FEED:
      return "embed";
    case ContentType.PROFILE:
      return "profile";
    default:
      return "text";
  }
};

const createTextDoc = (lines: string[]) => {
  const parseInlineMarkdown = (text: string) => {
    const nodes: Array<{
      type: string;
      text?: string;
      marks?: Array<{ type: string }>;
    }> = [];
    const regex = /(\*|_)([^*_]+?)\1/;
    let remaining = text;

    while (remaining.length > 0) {
      const match = regex.exec(remaining);
      if (!match) {
        if (remaining) {
          nodes.push({ type: "text", text: remaining });
        }
        break;
      }

      const [fullMatch, , italicText] = match;
      const matchIndex = match.index;
      if (matchIndex > 0) {
        nodes.push({ type: "text", text: remaining.slice(0, matchIndex) });
      }
      nodes.push({
        type: "text",
        text: italicText,
        marks: [{ type: "italic" }],
      });
      remaining = remaining.slice(matchIndex + fullMatch.length);
    }

    return nodes;
  };

  const content = lines.flatMap((line) => {
    if (line.trim() === "") {
      return [
        {
          type: "paragraph",
          content: [{ type: "hardBreak" }],
        },
      ];
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      return [
        {
          type: "heading",
          attrs: { level },
          content: text ? [{ type: "text", text }] : [],
        },
      ];
    }

    if (line.trim() === "---") {
      return [
        {
          type: "horizontalRule",
        },
      ];
    }

    const parts = line.split("\n");
    const paragraphContent = parts.flatMap((part, index) => {
      const nodes = parseInlineMarkdown(part);
      if (index < parts.length - 1) {
        nodes.push({ type: "hardBreak" });
      }
      return nodes;
    });

    return [
      {
        type: "paragraph",
        content: paragraphContent,
      },
    ];
  });

  return JSON.stringify({
    type: "doc",
    content,
  });
};

export const createStarterTiles = (): Tile[] => {
  const startX = 0;

  return [
    createTile(
      ContentType.SUGGESTION,
      uuidv4(),
      startX,
      6,
      4,
      4,
      { action: "profile", label: "Add Profile" },
      "",
    ),
    createTile(
      ContentType.IMAGE,
      uuidv4(),
      startX + 4,
      0,
      5,
      5,
      { src: heroGif },
      "",
    ),
    {
      ...createTile(
        ContentType.TEXT,
        uuidv4(),
        startX + 9,
        0,
        2,
        3,
        {
          text: createTextDoc([
            "# 👋",
            "#### Welcome to grids.so!",
            "Enjoy your new home.\n\n",
            "---",
            "*you can find more tile types below.*👇",
          ]),
        },
        "",
      ),
      borderEnabled: false,
    },
    createTile(
      ContentType.EMBED,
      uuidv4(),
      startX + 9,
      2,
      3,
      2,
      { src: "https://www.youtube.com/embed/7ccH8u8fj8Y?si=hnB1rbMIsMCWpPO8" },
      "",
    ),
    createTile(ContentType.CHAT, uuidv4(), startX + 4, 5, 3, 4, {}, ""),
    createTile(
      ContentType.SUGGESTION,
      uuidv4(),
      startX + 7,
      5,
      2,
      2,
      { action: "link", label: "Add Link" },
      "",
    ),
  ];
};

// ── GridService ───────────────────────────────────────────────────────

export class GridService implements IGridService {
  private gridDao: GridDao;
  private userDao: UserDao;
  private dbUtils: DbUtils;

  constructor() {
    const factory = getDaoFactory();
    this.gridDao = factory.getGridDao();
    this.userDao = factory.getUserDao();
    this.dbUtils = getDbUtils();
  }

  // ── Core CRUD ──────────────────────────────────────────────────────

  private buildGridPayload(
    grid: Grid,
    mode: "save" | "update",
  ): Record<string, unknown> {
    const editableFields = {
      name: grid.name,
      colNum: grid.colNum,
      verticalCompact: grid.verticalCompact,
      // Safety net: strip any blob: URLs that weren't already resolved
      tiles: stripBlobUrlsFromTiles(grid.tiles as unknown[]),
      backgroundImageSrc: grid.backgroundImageSrc,
      backgroundEmbed: grid.backgroundEmbed,
      backgroundColor: grid.backgroundColor ?? "",
      themeId: grid.themeId ?? "dark",
      overrides: grid.overrides ?? {},
      duplicatable: grid.duplicatable ?? false,
      updatedAt: this.dbUtils.serverTimestamp(),
    };

    if (mode === "update") {
      return this.dbUtils.sanitizeValue(editableFields) as Record<
        string,
        unknown
      >;
    }

    return this.dbUtils.sanitizeValue({
      userId: grid.userId,
      ...editableFields,
      createdAt: grid.createdAt ?? this.dbUtils.serverTimestamp(),
      lastOpenedAt: grid.lastOpenedAt ?? this.dbUtils.serverTimestamp(),
    }) as Record<string, unknown>;
  }

  // Fetch a grid by Grid ID
  async fetchGrid(id: string): Promise<Grid> {
    try {
      const grid = await this.gridDao.getById(id);

      if (!grid) {
        throw new Error(`Grid with ID ${id} does not exist`);
      }

      return grid;
    } catch (error) {
      console.error(`Error fetching grid with ID ${id}:`, error);
      throw error;
    }
  }

  // Save a new grid (or overwrite)
  async saveGrid(grid: Grid): Promise<void> {
    try {
      const payload = this.buildGridPayload(grid, "save");
      await this.gridDao.save(grid.id, payload);
    } catch (error) {
      console.error(`Error saving grid with ID ${grid.id}:`, error);
      throw error;
    }
  }

  // Update an existing grid (partial)
  async updateGrid(grid: Grid): Promise<void> {
    try {
      const payload = this.buildGridPayload(grid, "update");
      await this.gridDao.update(grid.id, payload);
    } catch (error) {
      console.error(`Error updating grid with ID ${grid.id}:`, error);
      throw error;
    }
  }

  // Delete a grid by ID
  async deleteGrid(id: string): Promise<void> {
    try {
      await this.gridDao.delete(id);
    } catch (error) {
      console.error(`Error deleting grid with ID ${id}:`, error);
      throw error;
    }
  }

  // ── Operations extracted from grid.ts store ─────────────────────

  // Fetch all grids belonging to a user
  async fetchGridsByUserId(userId: string): Promise<Grid[]> {
    try {
      return await this.gridDao.findByUserId(userId);
    } catch (error) {
      console.error(`Error fetching grids for user ${userId}:`, error);
      throw error;
    }
  }

  // Generate a new unique grid document ID
  generateId(): string {
    return this.gridDao.generateId();
  }

  // Create a new grid for a user.
  // Accepts pre-built tiles so the store can inject starter content.
  // Returns the new grid object with its generated ID.
  async createGrid(
    userId: string,
    name: string,
    starterTiles: Grid["tiles"] = [],
  ): Promise<Grid> {
    try {
      const newGrid = createDefaultGrid(userId, name);
      newGrid.tiles = starterTiles;
      newGrid.id = this.gridDao.generateId();

      await this.saveGrid(newGrid);
      return { ...newGrid };
    } catch (error) {
      console.error("Error creating grid:", error);
      throw error;
    }
  }

  // Duplicate an existing grid for a given user.
  // The caller is responsible for cloning tiles (with new IDs) and remapping
  // breakpoint overrides — this method just persists the new grid.
  async duplicateGrid(
    userId: string,
    sourceGrid: Grid,
    clonedTiles: Grid["tiles"],
    newOverrides: Grid["overrides"],
  ): Promise<Grid> {
    try {
      const newGrid: Grid = {
        id: this.gridDao.generateId(),
        userId,
        name: `Copy of ${sourceGrid.name || "Untitled"}`,
        colNum: sourceGrid.colNum,
        verticalCompact: sourceGrid.verticalCompact,
        tiles: clonedTiles,
        backgroundImageSrc: sourceGrid.backgroundImageSrc || "",
        backgroundEmbed: sourceGrid.backgroundEmbed || false,
        themeId: sourceGrid.themeId,
        overrides: newOverrides,
      };

      await this.saveGrid(newGrid);
      return { ...newGrid };
    } catch (error) {
      console.error("Error duplicating grid:", error);
      throw error;
    }
  }

  // Update the lastOpenedAt timestamp for a grid
  async touchLastOpenedAt(gridId: string): Promise<void> {
    try {
      await this.gridDao.updateLastOpenedAt(gridId);
    } catch (error) {
      console.error("Failed to update lastOpenedAt:", error);
      // Non-critical — don't rethrow
    }
  }

  // ── Recent grids (user document) ────────────────────────────────

  // Load the user's recent grid IDs from their user document
  async loadRecentGridIds(userId: string): Promise<string[]> {
    try {
      const userData = await this.userDao.getById(userId);
      if (!userData) return [];

      const arr = Array.isArray(userData.recentGridIds)
        ? ((userData.recentGridIds as unknown[]).filter(
            (x: unknown) => typeof x === "string",
          ) as string[])
        : [];

      return arr.slice(0, 3);
    } catch (error) {
      console.error("Failed to load recent grids:", error);
      return [];
    }
  }

  // Persist the user's recent grid IDs to their user document
  async saveRecentGridIds(userId: string, ids: string[]): Promise<void> {
    try {
      await this.userDao.save(userId, {
        recentGridIds: ids.slice(0, 3),
      });
    } catch (error) {
      console.error("Failed to save recent grids:", error);
      // Non-critical — don't rethrow
    }
  }

  // ── Starter tile creation ─────────────────────────────────────────

  // Create a new grid pre-populated with the default starter tiles.
  // Returns the persisted grid with its generated ID.
  async createGridWithStarterTiles(
    userId: string,
    name: string,
  ): Promise<Grid> {
    return this.createGrid(userId, name, createStarterTiles());
  }

  // ── Duplication with full clone logic ─────────────────────────────

  // Duplicate an existing grid, handling tile cloning, UUID reassignment,
  // content-type-based cleanup, and breakpoint override remapping.
  //
  // copyDepth controls what gets carried over:
  //   'full'      → all tile content (media URLs shared by reference, chat cleared)
  //   'structure' → tile type/size/position only, content reset to suggestion placeholders
  async cloneAndPersistGrid(
    userId: string,
    sourceGrid: Grid,
    copyDepth: CopyDepth = "full",
  ): Promise<Grid> {
    // Deep-clone tiles so mutations don't affect the source grid.
    // Each tile gets a fresh UUID to avoid ID collisions.
    const clonedTiles = (
      JSON.parse(
        JSON.stringify(sourceGrid.tiles),
      ) as typeof sourceGrid.tiles
    ).map((tile) => {
      const oldId = tile.i;
      tile.i = uuidv4();

      if (copyDepth === "structure") {
        // Structure-only: replace each tile with a SUGGESTION placeholder whose
        // action hint matches the original content type. This gives the new owner
        // useful "Add Media" / "Add Text" / etc. prompts instead of empty typed
        // tiles they can't do anything with.
        const action = contentTypeToSuggestionAction(tile.content.type);
        tile.content = createTileContent(ContentType.SUGGESTION, {
          action,
        });
      } else {
        // Full copy: preserve content, but clear ephemeral/user-generated data
        if (tile.content.type === ContentType.CHAT) {
          (tile.content as ChatContent).messages = [];
        }
      }

      return { tile, oldId };
    });

    // Rebuild breakpoint overrides with the new tile IDs so saved
    // mobile/tablet grids carry over correctly.
    let newOverrides: Grid["overrides"];
    if (sourceGrid.overrides) {
      newOverrides = {} as NonNullable<Grid["overrides"]>;
      // Build a mapping from old tile ID → new tile ID
      const idMap: Record<string, string> = {};
      for (const { tile, oldId } of clonedTiles) {
        idMap[oldId] = tile.i;
      }
      for (const [bp, positions] of Object.entries(sourceGrid.overrides)) {
        if (!positions) continue;
        const remapped: Record<string, TilePosition> = {};
        for (const [oldTileId, pos] of Object.entries(positions)) {
          const newTileId = idMap[oldTileId];
          if (newTileId && pos) {
            remapped[newTileId] = { ...pos };
          }
        }
        if (newOverrides) newOverrides[bp as Breakpoint] = remapped;
      }
    }

    return this.duplicateGrid(
      userId,
      sourceGrid,
      clonedTiles.map(({ tile }) => tile),
      newOverrides,
    );
  }

  // ── Save serialization queue ──────────────────────────────────────
  //
  // Multiple callers (map moveend, style toggle, addTile, etc.) can invoke
  // saves in rapid succession.  Each call snapshots the reactive grid and
  // writes to the database.  Without serialization, an earlier snapshot can
  // land *after* a later one (async race), reverting changes.
  //
  // Solution: only one write may be in-flight at a time.  If a new save is
  // requested while one is running, we set a flag.  When the in-flight
  // write finishes, the caller re-snapshots the (now-latest) grid and
  // writes again — guaranteeing the final persisted state matches the
  // current in-memory state.

  private _saveInFlight = false;
  private _saveQueued = false;
  private _pendingSnapshot: Grid | null = null;

  // Deep-clone a grid and swap any blob: preview URLs with their resolved
  // Storage URLs so we never persist temporary blob references.
  // Returns a plain (non-reactive) Grid safe for persistence.
  private createPersistableSnapshot(
    grid: Grid,
    resolvedUrls: Record<string, string> = {},
    resolvedDocumentItemUrls: Record<string, Record<string, string>> = {},
  ): Grid {
    const clonedTiles = (
      JSON.parse(JSON.stringify(grid.tiles)) as typeof grid.tiles
    ).map((tile) => {
      const content = tile.content as AnyTileContent;
      const src = (content as { src?: string }).src;
      if (typeof src === "string" && src.startsWith("blob:")) {
        const realUrl = resolvedUrls[tile.i];
        if (realUrl) {
          (tile.content as { src?: string }).src = realUrl;
        }
      }
      if (content.type === ContentType.DOCUMENT) {
        const doc = content as DocumentsContent;
        const itemMap = resolvedDocumentItemUrls[tile.i];
        if (doc.items?.length && itemMap && Object.keys(itemMap).length > 0) {
          const items = doc.items.map((item) => {
            const resolved = itemMap[item.id];
            if (
              typeof item.url === "string" &&
              item.url.startsWith("blob:") &&
              resolved
            ) {
              return { ...item, url: resolved };
            }
            return item;
          });
          (tile.content as DocumentsContent).items = items;
        }
      }
      return tile;
    });

    return {
      ...JSON.parse(JSON.stringify({ ...grid, tiles: undefined })),
      tiles: clonedTiles,
    } as Grid;
  }

  // Queue a grid save. Accepts the current (potentially reactive) grid
  // and optional resolved-URL maps for blob → storage URL substitution.
  // The service deep-clones and sanitises the grid internally.
  // Returns immediately if a write is already in-flight; the queued snapshot
  // will be flushed when the current write completes.
  async queueSave(
    grid: Grid,
    resolvedUrls: Record<string, string> = {},
    resolvedDocumentItemUrls: Record<string, Record<string, string>> = {},
  ): Promise<void> {
    const snapshot = this.createPersistableSnapshot(
      grid,
      resolvedUrls,
      resolvedDocumentItemUrls,
    );

    if (this._saveInFlight) {
      this._saveQueued = true;
      this._pendingSnapshot = snapshot;
      return;
    }

    this._saveInFlight = true;

    try {
      await this.saveGrid(snapshot);
    } catch (err) {
      console.error("Failed to save grid.", err);
    } finally {
      this._saveInFlight = false;

      // If another save was requested while we were writing,
      // flush it now with the latest snapshot.
      if (this._saveQueued && this._pendingSnapshot) {
        this._saveQueued = false;
        const next = this._pendingSnapshot;
        this._pendingSnapshot = null;
        await this.queueSave(next);
      }
    }
  }
}
