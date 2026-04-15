import { LayoutService, type ILayoutService } from "../LayoutService";
import { MockLayoutService } from "../mocks/MockLayoutService";
import type { IServiceFactory } from "./IServiceFactory";

export class ServiceFactory implements IServiceFactory {
  private useMocks: boolean;
  private layoutService: ILayoutService; 

  public constructor(useMocks: boolean = false) {
    this.useMocks = useMocks;

    if (this.useMocks) {
      this.layoutService = new MockLayoutService();
    } else {
      this.layoutService = new LayoutService();
    }
  }

  public getLayoutService(): ILayoutService {
    return this.layoutService;
  }
}
