import type {
  GridControllerDependencies,
  GridControllerStores,
} from "../GridControllerTypes";

export class GridUiController {
  constructor(
    private readonly stores: GridControllerStores,
    private readonly dependencies: GridControllerDependencies,
  ) {}

  setMenuActive(tileId: string): void {
    this.stores.ui.setMenuActive(tileId);
  }

  setPanelActive(tileId: string, panelId: string): void {
    this.stores.ui.setPanelActive(tileId, panelId);
  }

  toggleMenuActive(tileId: string): void {
    this.stores.ui.toggleMenuActive(tileId);
  }

  togglePanelActive(tileId: string, panelId: string): void {
    this.stores.ui.togglePanelActive(tileId, panelId);
  }

  closeMenus(): void {
    this.stores.ui.closeMenus();
  }

  setMobileEditTile(tileId: string | null): void {
    this.stores.ui.setMobileEditTile(tileId);
  }

  setMobileArrangeTile(tileId: string | null): void {
    this.stores.ui.setMobileArrangeTile(tileId);
  }

  finishMobileArrange(): void {
    this.stores.ui.finishMobileArrange();
  }

  setMobileOpenTool(toolId: string | null): void {
    this.stores.ui.setMobileOpenTool(toolId);
  }

  setMobileSheetExpanded(expanded: boolean): void {
    this.stores.ui.setMobileSheetExpanded(expanded);
  }

  enterMobileMultiSelect(): void {
    this.stores.ui.enterMobileMultiSelect();
  }

  toggleMobileMultiSelectTile(tileId: string): void {
    this.stores.ui.toggleMobileMultiSelectTile(tileId);
  }

  clearMobileEditor(): void {
    this.stores.ui.clearMobileEditor();
  }

  pruneMobileEditor(existingIds: ReadonlySet<string>): void {
    this.stores.ui.pruneMobileEditor(existingIds);
  }

  setShowMetaData(value: boolean): void {
    this.stores.ui.setShowMetaData(value);
    this.dependencies.setCookieValue(
      "showMetaData",
      value.toString(),
    );
  }

  setShowMetaDataVerbose(value: boolean): void {
    this.stores.ui.setShowMetaDataVerbose(value);
    this.dependencies.setCookieValue(
      "showMetaDataVerbose",
      value.toString(),
    );
  }

  getCookieValue(name: string): string | null {
    return this.dependencies.getCookieValue(name);
  }

  setCookieValue(name: string, value: string, days = 365): void {
    this.dependencies.setCookieValue(name, value, days);
  }
}
