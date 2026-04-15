import type { ILayoutService } from "../LayoutService";

export interface IServiceFactory {
  getLayoutService: () => ILayoutService;
}
