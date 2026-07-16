import {
  ContentType,
  type Grid,
  type LinkContent,
} from "@grids/contracts/types";
import type { UpdateCaptionInput } from "../GridCommands";
import type { GridControllerStores } from "../GridControllerTypes";

export class GridSettingsController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly pushUndoSnapshot: (actionLabel: string) => void,
    private readonly scheduleSave: () => void,
  ) {}

  setVerticalCompact(value: boolean): void {
    this.runGridCommand({
      captureHistory: "Set gravity",
      mutate: (grid) => {
        grid.verticalCompact = value;
      },
    });
  }

  updateCaption({ tileId, caption }: UpdateCaptionInput): void {
    this.runGridCommand({
      validate: (grid) =>
        grid.tiles.some((candidate) => candidate.i === tileId),
      mutate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === tileId,
        );
        if (tile) tile.caption = caption;
      },
    });
  }

  renameCurrentGrid(name: string): void {
    this.runGridCommand({
      mutate: (grid) => {
        grid.name = name;
        this.stores.collection.updateGrid(grid.id, { name });
      },
    });
  }

  setGridTheme(themeId: string): void {
    this.runGridCommand({
      captureHistory: "Change theme",
      mutate: (grid) => {
        grid.themeId = themeId;
      },
    });
  }

  setDuplicatable(value: boolean): void {
    this.runGridCommand({
      mutate: (grid) => {
        grid.duplicatable = value;
      },
    });
  }

  addBackgroundImage(url: string, embed: boolean, hash?: string): void {
    this.runGridCommand({
      captureHistory: "Change background image",
      mutate: (grid) => {
        grid.backgroundImageSrc = url;
        grid.backgroundEmbed = embed;
        // Only archive-backed (non-embed) uploads carry a hash.
        grid.backgroundImageHash = !embed && hash ? hash : "";
      },
    });
  }

  removeBackgroundImage(): void {
    this.runGridCommand({
      captureHistory: "Remove background image",
      mutate: (grid) => {
        grid.backgroundImageSrc = "";
        grid.backgroundEmbed = false;
        grid.backgroundImageHash = "";
      },
    });
  }

  setCustomOgImage(url: string): void {
    this.runGridCommand({
      captureHistory: "Change social share image",
      mutate: (grid) => {
        grid.ogImageSrc = url;
      },
    });
  }

  removeCustomOgImage(): void {
    this.runGridCommand({
      captureHistory: "Remove social share image",
      mutate: (grid) => {
        grid.ogImageSrc = "";
      },
    });
  }

  setBackgroundColor(color: string): void {
    this.runGridCommand({
      captureHistory: "Change background color",
      mutate: (grid) => {
        grid.backgroundColor = color;
      },
    });
  }

  /**
   * Live preview used while dragging the mobile color picker — mutates the
   * background color for immediate visual feedback WITHOUT recording undo
   * history or scheduling a save. The caller commits the final value once (via
   * `setBackgroundColor`) on gesture end so the drag collapses to a single
   * history entry.
   */
  previewBackgroundColor(color: string): void {
    this.runGridCommand({
      mutate: (grid) => {
        grid.backgroundColor = color;
      },
      persist: false,
    });
  }

  removeBackgroundColor(): void {
    this.runGridCommand({
      captureHistory: "Remove background color",
      mutate: (grid) => {
        grid.backgroundColor = "";
      },
    });
  }

  toggleTileBorder(id: string): void {
    this.runGridCommand({
      validate: (grid) =>
        grid.tiles.some((candidate) => candidate.i === id),
      captureHistory: "Toggle tile border",
      mutate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === id,
        );
        if (tile) tile.borderEnabled = tile.borderEnabled === false;
      },
    });
  }

  toggleLinkBackground(id: string): void {
    this.runGridCommand({
      validate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === id,
        );
        return tile?.content.type === ContentType.LINK;
      },
      captureHistory: "Toggle link background",
      mutate: (grid) => {
        const tile = grid.tiles.find(
          (candidate) => candidate.i === id,
        );
        if (!tile || tile.content.type !== ContentType.LINK) return;
        const link = tile.content as LinkContent;
        link.linkBackgroundEnabled = link.linkBackgroundEnabled === false;
      },
    });
  }

  private runGridCommand<T>(definition: {
    validate?: (grid: Grid) => boolean;
    captureHistory?: string;
    mutate: (grid: Grid) => T;
    persist?: boolean;
  }): T | undefined {
    const grid = this.stores.session.currentGrid;
    if (!grid) return undefined;
    if (definition.validate && !definition.validate(grid)) {
      return undefined;
    }
    if (definition.captureHistory !== undefined) {
      this.pushUndoSnapshot(definition.captureHistory);
    }
    const result = definition.mutate(grid);
    if (definition.persist !== false) {
      this.scheduleSave();
    }
    return result;
  }
}
