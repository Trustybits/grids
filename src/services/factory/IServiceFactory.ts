import type { ILayoutService } from "../interfaces/ILayoutService";

export interface IServiceFactory {
  getLayoutService: () => ILayoutService;
}
