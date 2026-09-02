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
        // Applying an image makes it the active source (the color, if any, is
        // retained and can be re-activated later).
        grid.backgroundActiveSource = "image";
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
        // Fall back to the color if one is retained, otherwise the default.
        if (grid.backgroundActiveSource === "image") {
          grid.backgroundActiveSource = grid.backgroundColor
            ? "color"
            : "default";
        }
      },
    });
  }

  /**
   * Toggle which retained background source (image / color / default) renders,
   * without touching the stored image or color values — this is the radio-style
   * switch behind the mobile GRID BACKGROUND tiles.
   */
  setBackgroundActiveSource(source: Grid["backgroundActiveSource"]): void {
    this.runGridCommand({
      captureHistory: "Change background",
      mutate: (grid) => {
        grid.backgroundActiveSource = source;
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

  /**
   * Persists the OG Image Studio layout (tile placement, background,
   * visibility toggles). Not part of undo/redo history — it's studio
   * configuration, not grid layout content.
   */
  setOgConfig(config: Record<string, unknown>): void {
    this.runGridCommand({
      mutate: (grid) => {
        grid.ogConfig = config;
      },
    });
  }

  setBackgroundColor(color: string): void {
    this.runGridCommand({
      captureHistory: "Change background color",
      mutate: (grid) => {
        grid.backgroundColor = color;
        // Applying a color makes it the active source (the image, if any, is
        // retained and can be re-activated later).
        grid.backgroundActiveSource = "color";
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
        // Keep the color visible live even if the image was the active source.
        grid.backgroundActiveSource = "color";
      },
      persist: false,
    });
  }

  removeBackgroundColor(): void {
    this.runGridCommand({
      captureHistory: "Remove background color",
      mutate: (grid) => {
        grid.backgroundColor = "";
        // Fall back to the image if one is retained, otherwise the default.
        if (grid.backgroundActiveSource === "color") {
          grid.backgroundActiveSource = grid.backgroundImageSrc
            ? "image"
            : "default";
        }
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
