import { LayoutService, type ILayoutService } from "../LayoutService";
import type { IServiceFactory } from "./IServiceFactory";

export class ServiceFactory implements IServiceFactory {
  private layoutService: ILayoutService;

  public constructor() {
    this.layoutService = new LayoutService();
  }

  public getLayoutService(): ILayoutService {
    return this.layoutService;
  }
}
