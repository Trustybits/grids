import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IUserService } from "../interfaces/IUserService";

export interface IServiceFactory {
  getLayoutService: () => ILayoutService;
  getUserService: () => IUserService;
}
