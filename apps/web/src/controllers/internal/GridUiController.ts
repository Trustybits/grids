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
