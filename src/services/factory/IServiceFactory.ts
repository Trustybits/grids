import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IStorageService } from "../interfaces/IStorageService";
import type { IUserService } from "../interfaces/IUserService";

export interface IServiceFactory {
  getLayoutService: () => ILayoutService;
  getStorageService: () => IStorageService;
  getUserService: () => IUserService;
}
