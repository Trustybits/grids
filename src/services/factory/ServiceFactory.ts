import { LayoutService } from "../LayoutService";
import { UserService } from "../UserService";
import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IUserService } from "../interfaces/IUserService";
import { MockLayoutService } from "../mocks/MockLayoutService";
import type { IServiceFactory } from "./IServiceFactory";

export class ServiceFactory implements IServiceFactory {
  private useMocks: boolean;
  private layoutService: ILayoutService;
  private userService: IUserService;

  public constructor(useMocks: boolean = false) {
    this.useMocks = useMocks;

    if (this.useMocks) {
      this.layoutService = new MockLayoutService();
      // TODO: add MockUserService when one is created
      this.userService = new UserService();
    } else {
      this.layoutService = new LayoutService();
      this.userService = new UserService();
    }
  }

  public getLayoutService(): ILayoutService {
    return this.layoutService;
  }

  public getUserService(): IUserService {
    return this.userService;
  }
}
