import {
  resolveResponsiveLayoutVersion,
  type Grid,
  type ConfirmedGridDuplicateStorage,
  type CopyDepth,
  type Breakpoint,
  type TilePosition,
  type Tile,
} from "@grids/contracts/types";
import {
  ContentType,
  type ChatContent,
  type SuggestionAction,
} from "@grids/contracts/types";
import {
  rewriteArchiveBackedContent,
  rewriteBackgroundImage,
} from "@grids/contracts/storage";
import { getDaoFactory } from "@/dao/DaoFactorySingleton";
import { getDbUtils } from "@/dao/DbUtilsSingleton";
import type { DbUtils } from "@grids/contracts/dao";
import type { GridDao } from "@grids/contracts/dao";
import type { UserDao } from "@grids/contracts/dao";
import { isGridRevisionConflictError } from "@grids/contracts/dao";
import {
  ACTIVE_NEW_GRID_RESPONSIVE_LAYOUT_VERSION,
  createDefaultGrid,
} from "@/utils/GridUtils";
import { createTile, createTileContent } from "@/utils/TileUtils";
import { stripBlobUrlsFromTiles } from "@/utils/GridPersistenceUtils";
import { v4 as uuidv4 } from "uuid";
import heroGif from "@/assets/images/hero.gif";
import type { GridServiceInterface } from "./interfaces/GridServiceInterface";

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
      3,
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

export class GridService implements GridServiceInterface {
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

  private readGridRev(grid: Grid): number {
    return typeof grid.rev === "number" && Number.isFinite(grid.rev)
      ? grid.rev
      : 0;
  }

  private buildGridPayload(
    grid: Grid,
    mode: "save" | "update",
    nextRev: number,
  ): Record<string, unknown> {
    const editableFields: Record<string, unknown> = {
      rev: nextRev,
      name: grid.name,
      colNum: grid.colNum,
      verticalCompact: grid.verticalCompact,
      // Safety net: strip any blob: URLs that weren't already resolved
      tiles: stripBlobUrlsFromTiles(grid.tiles as unknown[]),
      backgroundImageSrc: grid.backgroundImageSrc,
      backgroundImageHash: grid.backgroundImageHash ?? "",
      backgroundEmbed: grid.backgroundEmbed,
      backgroundColor: grid.backgroundColor ?? "",
      ogImageSrc: grid.ogImageSrc ?? "",
      themeId: grid.themeId ?? "dark",
      overrides: grid.overrides ?? {},
      duplicatable: grid.duplicatable ?? false,
      // Publish lifecycle. Default to "published" so legacy/unspecified grids
      // stay publicly readable — the draft/publish feature only ever writes
      // "draft" through the explicit draft lifecycle in GridService.
      status: grid.status ?? "published",
      updatedAt: this.dbUtils.serverTimestamp(),
    };

    // Hidden-draft marker + publish timestamp are only written when present, so
    // ordinary published grids never carry these fields.
    if (grid.draftOf) {
      editableFields.draftOf = grid.draftOf;
    }
    if (grid.publishedAt) {
      editableFields.publishedAt = grid.publishedAt;
    }

    // Every current value renders through Griddle v1, but an older client must
    // not downgrade an unknown future compatibility marker on ordinary save.
    if (grid.responsiveLayoutVersionStatus !== "unsupported") {
      editableFields.responsiveLayoutVersion = resolveResponsiveLayoutVersion(
        grid.responsiveLayoutVersion,
      );
    }

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

  // Subscribe to realtime updates for a single grid document.
  subscribeToGrid(
    id: string,
    callback: (grid: Grid | null) => void,
  ): () => void {
    return this.gridDao.subscribeToGrid(id, callback);
  }

  // Save a new grid (or overwrite)
  async saveGrid(grid: Grid): Promise<Grid> {
    try {
      const expectedRev = this.readGridRev(grid);
      const nextRev = expectedRev + 1;
      const payload = this.buildGridPayload(grid, "save", nextRev);
      await this.gridDao.save(grid.id, payload, expectedRev);
      grid.rev = nextRev;
      return { ...grid };
    } catch (error) {
      console.error(`Error saving grid with ID ${grid.id}:`, error);
      throw error;
    }
  }

  // Update an existing grid (partial)
  async updateGrid(grid: Grid): Promise<Grid> {
    try {
      const expectedRev = this.readGridRev(grid);
      const nextRev = expectedRev + 1;
      const payload = this.buildGridPayload(grid, "update", nextRev);
      await this.gridDao.update(grid.id, payload, expectedRev);
      grid.rev = nextRev;
      return { ...grid };
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
      const newGrid = createDefaultGrid(
        userId,
        name,
        ACTIVE_NEW_GRID_RESPONSIVE_LAYOUT_VERSION,
      );
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
    storagePlan?: ConfirmedGridDuplicateStorage,
  ): Promise<Grid> {
    try {
      const background = rewriteBackgroundImage(sourceGrid, storagePlan);
      const newGrid: Grid = {
        id: this.gridDao.generateId(),
        userId,
        rev: 0,
        name: `Copy of ${sourceGrid.name || "Untitled"}`,
        colNum: sourceGrid.colNum,
        responsiveLayoutVersion: resolveResponsiveLayoutVersion(
          sourceGrid.responsiveLayoutVersion,
        ),
        verticalCompact: sourceGrid.verticalCompact,
        tiles: clonedTiles,
        backgroundImageSrc: background.backgroundImageSrc,
        backgroundImageHash: background.backgroundImageHash,
        backgroundEmbed: sourceGrid.backgroundEmbed || false,
        themeId: sourceGrid.themeId,
        overrides: newOverrides,
        // Mark provenance so the assign-default trigger skips duplicates — only
        // a user's first/fresh grid should auto-become their default.
        clonedFrom: sourceGrid.id,
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
    storagePlan?: ConfirmedGridDuplicateStorage,
  ): Promise<Grid> {
    const replacementTileIds = new Set(storagePlan?.replacementTileIds ?? []);
    // Deep-clone tiles so mutations don't affect the source grid.
    // Each tile gets a fresh UUID to avoid ID collisions.
    const clonedTiles = (
      JSON.parse(JSON.stringify(sourceGrid.tiles)) as typeof sourceGrid.tiles
    ).map((tile) => {
      const oldId = tile.i;
      tile.i = uuidv4();

      if (copyDepth === "structure" || replacementTileIds.has(oldId)) {
        // Structure-only: replace each tile with a SUGGESTION placeholder whose
        // action hint matches the original content type. This gives the new owner
        // useful "Add Media" / "Add Text" / etc. prompts instead of empty typed
        // tiles they can't do anything with.
        const action = contentTypeToSuggestionAction(tile.content.type);
        tile.content = createTileContent(ContentType.SUGGESTION, {
          action,
        });
      } else {
        rewriteArchiveBackedContent(tile, storagePlan);
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
      storagePlan,
    );
  }

  // ── Draft / publish lifecycle ─────────────────────────────────────────
  //
  // A published grid stays the public document. Editing it opens a hidden
  // DRAFT duplicate (a real grids/{id} doc marked status:"draft" + draftOf).
  // Publishing copies the draft's content back into the original and deletes
  // the draft; publishing as a copy promotes the draft into its own listed
  // public grid instead. See the implementation brief for the full model.

  // Deterministic id for a grid's hidden draft. Keying the draft on its
  // original's id (rather than a fresh auto-id) makes getOrCreateDraft a single
  // point read and guarantees at most one draft per original even under a
  // create race — concurrent creates collide on the same doc/rev instead of
  // producing two drafts.
  private draftIdFor(originalId: string): string {
    return `draft__${originalId}`;
  }

  // Create a hidden draft duplicate of a published grid. Unlike a normal
  // duplicate this PRESERVES tile ids (no UUID reassignment) and the name (no
  // "Copy of" rename) so publishing is a clean whole-content write-back. It
  // sets draftOf + status:"draft" and never sets clonedFrom. Background images
  // are shared by reference (same owner) — not re-uploaded.
  async createDraft(original: Grid): Promise<Grid> {
    const draft: Grid = {
      id: this.draftIdFor(original.id),
      userId: original.userId,
      rev: 0,
      name: original.name,
      colNum: original.colNum,
      responsiveLayoutVersion: resolveResponsiveLayoutVersion(
        original.responsiveLayoutVersion,
      ),
      verticalCompact: original.verticalCompact,
      // Deep-clone so draft edits never mutate the original in memory; tile ids
      // are intentionally kept identical for a clean write-back on publish.
      tiles: JSON.parse(JSON.stringify(original.tiles)) as Grid["tiles"],
      backgroundImageSrc: original.backgroundImageSrc,
      backgroundImageHash: original.backgroundImageHash,
      backgroundEmbed: original.backgroundEmbed,
      backgroundColor: original.backgroundColor,
      backgroundActiveSource: original.backgroundActiveSource,
      ogImageSrc: original.ogImageSrc,
      themeId: original.themeId,
      overrides: original.overrides
        ? (JSON.parse(JSON.stringify(original.overrides)) as Grid["overrides"])
        : undefined,
      duplicatable: original.duplicatable,
      status: "draft",
      draftOf: original.id,
    };

    return this.saveGrid(draft);
  }

  // Idempotently return the hidden draft for a published grid, creating it on
  // first edit. Enforces one draft per original: a point read on the
  // deterministic draft id, then a guarded create that tolerates losing a race
  // to a concurrent creator.
  async getOrCreateDraft(originalId: string): Promise<Grid> {
    const draftId = this.draftIdFor(originalId);
    const existing = await this.gridDao.getById(draftId);
    if (existing && existing.draftOf === originalId) {
      return existing;
    }

    const original = await this.fetchGrid(originalId);
    try {
      return await this.createDraft(original);
    } catch (error) {
      // Lost the create race — another caller created the draft between our
      // point read and save (both saved at rev 0). Adopt the winner's draft.
      if (isGridRevisionConflictError(error)) {
        const raced = await this.gridDao.getById(draftId);
        if (raced && raced.draftOf === originalId) return raced;
      }
      throw error;
    }
  }

  // Publish a draft: overwrite the original document's content with the draft's
  // (whole-content, no merge — so no stale tiles remain), stamp it published,
  // then delete the draft. Respects the ORIGINAL's rev so a concurrent edit of
  // the original surfaces as GridRevisionConflictError; on conflict the draft
  // is left intact for a retry.
  async publishDraft(draftId: string): Promise<void> {
    const draft = await this.fetchGrid(draftId);
    const originalId = draft.draftOf;
    if (!originalId) {
      throw new Error(`Grid ${draftId} is not a draft (no draftOf).`);
    }

    const original = await this.fetchGrid(originalId);
    const expectedRev = this.readGridRev(original);
    const nextRev = expectedRev + 1;

    const payload = this.dbUtils.sanitizeValue({
      rev: nextRev,
      name: draft.name,
      colNum: draft.colNum,
      responsiveLayoutVersion: resolveResponsiveLayoutVersion(
        draft.responsiveLayoutVersion,
      ),
      verticalCompact: draft.verticalCompact,
      tiles: stripBlobUrlsFromTiles(draft.tiles as unknown[]),
      backgroundImageSrc: draft.backgroundImageSrc,
      backgroundImageHash: draft.backgroundImageHash ?? "",
      backgroundEmbed: draft.backgroundEmbed,
      backgroundColor: draft.backgroundColor ?? "",
      backgroundActiveSource: draft.backgroundActiveSource,
      ogImageSrc: draft.ogImageSrc ?? "",
      themeId: draft.themeId ?? "dark",
      overrides: draft.overrides ?? {},
      duplicatable: draft.duplicatable ?? false,
      status: "published",
      publishedAt: this.dbUtils.serverTimestamp(),
      updatedAt: this.dbUtils.serverTimestamp(),
    }) as Record<string, unknown>;

    // Write-back first; only reclaim the draft once the original is safely
    // updated. A rev conflict here throws before the draft is touched.
    await this.gridDao.update(originalId, payload, expectedRev);
    await this.gridDao.delete(draftId);
  }

  // Promote a draft into its own listed public grid (today's "duplicate"
  // outcome). Keeps the document but clears draftOf and flips it to published,
  // so it appears in the dashboard and never resolves as a draft again.
  async publishAsCopy(draftId: string, name?: string): Promise<Grid> {
    const draft = await this.fetchGrid(draftId);
    const expectedRev = this.readGridRev(draft);
    const nextRev = expectedRev + 1;

    const payload = this.dbUtils.sanitizeValue({
      rev: nextRev,
      status: "published",
      // Remove the hidden-draft marker entirely so the doc becomes a normal
      // listed grid (a blanked-but-present draftOf would still read as a draft).
      draftOf: this.dbUtils.deleteField(),
      publishedAt: this.dbUtils.serverTimestamp(),
      updatedAt: this.dbUtils.serverTimestamp(),
      ...(name ? { name } : {}),
    }) as Record<string, unknown>;

    await this.gridDao.update(draftId, payload, expectedRev);

    return {
      ...draft,
      rev: nextRev,
      status: "published",
      draftOf: undefined,
      name: name ?? draft.name,
    };
  }

  // Take a published grid private again by flipping its status to "draft".
  // Respects the grid's rev (surfaces GridRevisionConflictError on a concurrent
  // edit). Content is untouched.
  async unpublishGrid(gridId: string): Promise<void> {
    const grid = await this.fetchGrid(gridId);
    const expectedRev = this.readGridRev(grid);
    const nextRev = expectedRev + 1;

    const payload = this.dbUtils.sanitizeValue({
      rev: nextRev,
      status: "draft",
      updatedAt: this.dbUtils.serverTimestamp(),
    }) as Record<string, unknown>;

    await this.gridDao.update(gridId, payload, expectedRev);
  }
}
