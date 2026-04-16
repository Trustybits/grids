import { type Layout, type CopyDepth } from "@/types/Layout";
import type { TilePosition, Tile } from "@/types/Tile";
import { ContentType, type SuggestionAction } from "@/types/TileContent";
import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import { getDbUtils } from "@/dao/DbUtilsSingleton";
import type { DbUtils } from "@/dao/interfaces/DbUtils";
import type { LayoutDao } from "@/dao/interfaces/LayoutDao";
import type { UserDao } from "@/dao/interfaces/UserDao";
import { createDefaultLayout } from "@/utils/LayoutUtils";
import { createTile, createTileContent } from "@/utils/TileUtils";
import { v4 as uuidv4 } from "uuid";
import heroGif from "@/assets/images/hero.gif";
import type { ILayoutService } from "./interfaces/ILayoutService";

// ── Helpers ─────────────────────────────────────────────────────────────

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Safety net: strip any remaining blob: URLs before persisting.
 * Normally the layout store substitutes resolved Firebase URLs before calling
 * the service, but this catches any edge cases where a blob URL slips through.
 */
const stripBlobUrls = (tiles: unknown[]): unknown[] => {
  return tiles.map((tile) => {
    if (!isPlainObject(tile)) return tile;
    const content = tile.content;
    if (!isPlainObject(content)) return tile;
    const src = content.src;
    if (typeof src === "string" && src.startsWith("blob:")) {
      return {
        ...tile,
        content: { ...content, src: "" },
      };
    }
    return tile;
  });
};

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

// ── LayoutService ───────────────────────────────────────────────────────

export class LayoutService implements ILayoutService {
  private layoutDao: LayoutDao;
  private userDao: UserDao;
  private dbUtils: DbUtils;

  constructor() {
    const factory = getDaoFactory();
    this.layoutDao = factory.getLayoutDao();
    this.userDao = factory.getUserDao();
    this.dbUtils = getDbUtils();
  }

  // ── Core CRUD (mirrors FirestoreLayoutService) ──────────────────────

  // Fetch a layout by Layout ID
  async fetchLayout(id: string): Promise<Layout> {
    try {
      const layout = await this.layoutDao.getById(id);

      if (!layout) {
        throw new Error(`Layout with ID ${id} does not exist`);
      }

      return layout;
    } catch (error) {
      console.error(`Error fetching layout with ID ${id}:`, error);
      throw error;
    }
  }

  // Save a new layout (or overwrite)
  async saveLayout(layout: Layout): Promise<void> {
    try {
      const payload = this.dbUtils.sanitizeValue({
        userId: layout.userId,
        name: layout.name,
        colNum: layout.colNum,
        verticalCompact: layout.verticalCompact,
        // Safety net: strip any blob: URLs that weren't already resolved
        tiles: stripBlobUrls(layout.tiles as unknown[]),
        backgroundImageSrc: layout.backgroundImageSrc,
        backgroundEmbed: layout.backgroundEmbed,
        themeId: layout.themeId ?? "dark",
        overrides: layout.overrides ?? {},
        duplicatable: layout.duplicatable ?? false,
        createdAt: layout.createdAt ?? this.dbUtils.serverTimestamp(),
        updatedAt: this.dbUtils.serverTimestamp(),
        lastOpenedAt: layout.lastOpenedAt ?? this.dbUtils.serverTimestamp(),
      }) as Record<string, unknown>;
      await this.layoutDao.save(layout.id, payload);
    } catch (error) {
      console.error(`Error saving layout with ID ${layout.id}:`, error);
      throw error;
    }
  }

  // Update an existing layout (partial)
  async updateLayout(layout: Layout): Promise<void> {
    try {
      const payload = this.dbUtils.sanitizeValue({
        name: layout.name,
        colNum: layout.colNum,
        verticalCompact: layout.verticalCompact,
        // Safety net: strip any blob: URLs that weren't already resolved
        tiles: stripBlobUrls(layout.tiles as unknown[]),
        backgroundImageSrc: layout.backgroundImageSrc,
        backgroundEmbed: layout.backgroundEmbed,
        themeId: layout.themeId ?? "dark",
        overrides: layout.overrides ?? {},
        duplicatable: layout.duplicatable ?? false,
        updatedAt: this.dbUtils.serverTimestamp(),
      }) as Record<string, unknown>;
      await this.layoutDao.update(layout.id, payload);
    } catch (error) {
      console.error(`Error updating layout with ID ${layout.id}:`, error);
      throw error;
    }
  }

  // Delete a layout by ID
  async deleteLayout(id: string): Promise<void> {
    try {
      await this.layoutDao.delete(id);
    } catch (error) {
      console.error(`Error deleting layout with ID ${id}:`, error);
      throw error;
    }
  }

  // ── Operations extracted from layout.ts store ─────────────────────

  // Fetch all layouts belonging to a user
  async fetchLayoutsByUserId(userId: string): Promise<Layout[]> {
    try {
      return await this.layoutDao.findByUserId(userId);
    } catch (error) {
      console.error(`Error fetching layouts for user ${userId}:`, error);
      throw error;
    }
  }

  // Generate a new unique layout document ID
  generateId(): string {
    return this.layoutDao.generateId();
  }

  // Create a new layout for a user.
  // Accepts pre-built tiles so the store can inject starter content.
  // Returns the new layout object with its generated ID.
  async createLayout(
    userId: string,
    name: string,
    starterTiles: Layout["tiles"] = [],
  ): Promise<Layout> {
    try {
      const newLayout = createDefaultLayout(userId, name);
      newLayout.tiles = starterTiles;
      newLayout.id = this.layoutDao.generateId();

      await this.saveLayout(newLayout);
      return { ...newLayout };
    } catch (error) {
      console.error("Error creating layout:", error);
      throw error;
    }
  }

  // Duplicate an existing layout for a given user.
  // The caller is responsible for cloning tiles (with new IDs) and remapping
  // breakpoint overrides — this method just persists the new layout.
  async duplicateLayout(
    userId: string,
    sourceLayout: Layout,
    clonedTiles: Layout["tiles"],
    newOverrides: Layout["overrides"],
  ): Promise<Layout> {
    try {
      const newLayout: Layout = {
        id: this.layoutDao.generateId(),
        userId,
        name: `Copy of ${sourceLayout.name || "Untitled"}`,
        colNum: sourceLayout.colNum,
        verticalCompact: sourceLayout.verticalCompact,
        tiles: clonedTiles,
        backgroundImageSrc: sourceLayout.backgroundImageSrc || "",
        backgroundEmbed: sourceLayout.backgroundEmbed || false,
        themeId: sourceLayout.themeId,
        overrides: newOverrides,
      };

      await this.saveLayout(newLayout);
      return { ...newLayout };
    } catch (error) {
      console.error("Error duplicating layout:", error);
      throw error;
    }
  }

  // Update the lastOpenedAt timestamp for a layout
  async touchLastOpenedAt(layoutId: string): Promise<void> {
    try {
      await this.layoutDao.updateLastOpenedAt(layoutId);
    } catch (error) {
      console.error("Failed to update lastOpenedAt:", error);
      // Non-critical — don't rethrow
    }
  }

  // ── Recent layouts (user document) ────────────────────────────────

  // Load the user's recent layout IDs from their user document
  async loadRecentLayoutIds(userId: string): Promise<string[]> {
    try {
      const userData = await this.userDao.getById(userId);
      if (!userData) return [];

      const arr = Array.isArray(userData.recentLayoutIds)
        ? ((userData.recentLayoutIds as unknown[]).filter(
            (x: unknown) => typeof x === "string",
          ) as string[])
        : [];

      return arr.slice(0, 3);
    } catch (error) {
      console.error("Failed to load recent layouts:", error);
      return [];
    }
  }

  // Persist the user's recent layout IDs to their user document
  async saveRecentLayoutIds(userId: string, ids: string[]): Promise<void> {
    try {
      await this.userDao.save(userId, {
        recentLayoutIds: ids.slice(0, 3),
      });
    } catch (error) {
      console.error("Failed to save recent layouts:", error);
      // Non-critical — don't rethrow
    }
  }

  // ── Starter tile creation ─────────────────────────────────────────

  // Create a new layout pre-populated with the default starter tiles.
  // Returns the persisted layout with its generated ID.
  async createLayoutWithStarterTiles(
    userId: string,
    name: string,
  ): Promise<Layout> {
    return this.createLayout(userId, name, createStarterTiles());
  }

  // ── Duplication with full clone logic ─────────────────────────────

  // Duplicate an existing layout, handling tile cloning, UUID reassignment,
  // content-type-based cleanup, and breakpoint override remapping.
  //
  // copyDepth controls what gets carried over:
  //   'full'      → all tile content (media URLs shared by reference, chat cleared)
  //   'structure' → tile type/size/position only, content reset to suggestion placeholders
  async cloneAndPersistLayout(
    userId: string,
    sourceLayout: Layout,
    copyDepth: CopyDepth = "full",
  ): Promise<Layout> {
    // Deep-clone tiles so mutations don't affect the source layout.
    // Each tile gets a fresh UUID to avoid ID collisions.
    const clonedTiles = (
      JSON.parse(
        JSON.stringify(sourceLayout.tiles),
      ) as typeof sourceLayout.tiles
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
          (tile.content as any).messages = [];
        }
      }

      return { tile, oldId };
    });

    // Rebuild breakpoint overrides with the new tile IDs so saved
    // mobile/tablet layouts carry over correctly.
    let newOverrides: Layout["overrides"];
    if (sourceLayout.overrides) {
      newOverrides = {} as NonNullable<Layout["overrides"]>;
      // Build a mapping from old tile ID → new tile ID
      const idMap: Record<string, string> = {};
      for (const { tile, oldId } of clonedTiles) {
        idMap[oldId] = tile.i;
      }
      for (const [bp, positions] of Object.entries(sourceLayout.overrides)) {
        if (!positions) continue;
        const remapped: Record<string, TilePosition> = {};
        for (const [oldTileId, pos] of Object.entries(positions)) {
          const newTileId = idMap[oldTileId];
          if (newTileId && pos) {
            remapped[newTileId] = { ...pos };
          }
        }
        (newOverrides as any)[bp] = remapped;
      }
    }

    return this.duplicateLayout(
      userId,
      sourceLayout,
      clonedTiles.map(({ tile }) => tile),
      newOverrides,
    );
  }

  // ── Save serialization queue ──────────────────────────────────────
  //
  // Multiple callers (map moveend, style toggle, addTile, etc.) can invoke
  // saves in rapid succession.  Each call snapshots the reactive layout and
  // writes to the database.  Without serialization, an earlier snapshot can
  // land *after* a later one (async race), reverting changes.
  //
  // Solution: only one write may be in-flight at a time.  If a new save is
  // requested while one is running, we set a flag.  When the in-flight
  // write finishes, the caller re-snapshots the (now-latest) layout and
  // writes again — guaranteeing the final persisted state matches the
  // current in-memory state.

  private _saveInFlight = false;
  private _saveQueued = false;
  private _pendingSnapshot: Layout | null = null;

  // Deep-clone a layout and swap any blob: preview URLs with their resolved
  // Firebase URLs so we never persist temporary blob references.
  // Returns a plain (non-reactive) Layout safe for Firestore.
  private createPersistableSnapshot(
    layout: Layout,
    resolvedUrls: Record<string, string> = {},
  ): Layout {
    const clonedTiles = (
      JSON.parse(JSON.stringify(layout.tiles)) as typeof layout.tiles
    ).map((tile) => {
      const src = (tile.content as any)?.src;
      if (typeof src === "string" && src.startsWith("blob:")) {
        const realUrl = resolvedUrls[tile.i];
        if (realUrl) {
          (tile.content as any).src = realUrl;
        }
      }
      return tile;
    });

    return {
      ...JSON.parse(JSON.stringify({ ...layout, tiles: undefined })),
      tiles: clonedTiles,
    } as Layout;
  }

  // Queue a layout save. Accepts the current (potentially reactive) layout
  // and an optional resolved-URL map for blob → Firebase URL substitution.
  // The service deep-clones and sanitises the layout internally.
  // Returns immediately if a write is already in-flight; the queued snapshot
  // will be flushed when the current write completes.
  async queueSave(
    layout: Layout,
    resolvedUrls: Record<string, string> = {},
  ): Promise<void> {
    const snapshot = this.createPersistableSnapshot(layout, resolvedUrls);

    if (this._saveInFlight) {
      this._saveQueued = true;
      this._pendingSnapshot = snapshot;
      return;
    }

    this._saveInFlight = true;

    try {
      await this.saveLayout(snapshot);
    } catch (err) {
      console.error("Failed to save layout.", err);
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
