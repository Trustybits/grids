import { LayoutService } from "../LayoutService";
import { StorageService } from "../StorageService";
import { UserService } from "../UserService";
import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IStorageService } from "../interfaces/IStorageService";
import type { IUserService } from "../interfaces/IUserService";
import { MockLayoutService } from "../mocks/MockLayoutService";
import { MockStorageService } from "../mocks/MockStorageService";
import { MockUserService } from "../mocks/MockUserService";
import type { IServiceFactory } from "./IServiceFactory";

export class ServiceFactory implements IServiceFactory {
  private useMocks: boolean;
  private layoutService: ILayoutService;
  private storageService: IStorageService;
  private userService: IUserService;

  public constructor(useMocks: boolean = false) {
    this.useMocks = useMocks;

    if (this.useMocks) {
      this.layoutService = new MockLayoutService();
      this.storageService = new MockStorageService();
      this.userService = new MockUserService();
    } else {
      this.layoutService = new LayoutService();
      this.storageService = new StorageService();
      this.userService = new UserService();
    }
  }

  public getLayoutService(): ILayoutService {
    return this.layoutService;
  }

  public getStorageService(): IStorageService {
    return this.storageService;
  }

  public getUserService(): IUserService {
    return this.userService;
  }
}
