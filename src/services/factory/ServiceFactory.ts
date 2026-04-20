import { ChatService } from "../ChatService";
import { LayoutService } from "../LayoutService";
import { RoadmapService } from "../RoadmapService";
import { StorageService } from "../StorageService";
import { UpvoteService } from "../UpvoteService";
import { UserService } from "../UserService";
import type { IChatService } from "../interfaces/IChatService";
import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IRoadmapService } from "../interfaces/IRoadmapService";
import type { IStorageService } from "../interfaces/IStorageService";
import type { IUpvoteService } from "../interfaces/IUpvoteService";
import type { IUserService } from "../interfaces/IUserService";
import { MockChatService } from "../mocks/MockChatService";
import { MockLayoutService } from "../mocks/MockLayoutService";
import { MockRoadmapService } from "../mocks/MockRoadmapService";
import { MockStorageService } from "../mocks/MockStorageService";
import { MockUpvoteService } from "../mocks/MockUpvoteService";
import { MockUserService } from "../mocks/MockUserService";
import type { IServiceFactory } from "./IServiceFactory";

export class ServiceFactory implements IServiceFactory {
  private useMocks: boolean;
  private chatService: IChatService;
  private layoutService: ILayoutService;
  private roadmapService: IRoadmapService;
  private storageService: IStorageService;
  private upvoteService: IUpvoteService;
  private userService: IUserService;

  public constructor(useMocks: boolean = false) {
    this.useMocks = useMocks;

    if (this.useMocks) {
      this.chatService = new MockChatService();
      this.layoutService = new MockLayoutService();
      this.roadmapService = new MockRoadmapService();
      this.storageService = new MockStorageService();
      this.upvoteService = new MockUpvoteService();
      this.userService = new MockUserService();
    } else {
      this.chatService = new ChatService();
      this.layoutService = new LayoutService();
      this.roadmapService = new RoadmapService();
      this.storageService = new StorageService();
      this.upvoteService = new UpvoteService();
      this.userService = new UserService();
    }
  }

  public getChatService(): IChatService {
    return this.chatService;
  }

  public getLayoutService(): ILayoutService {
    return this.layoutService;
  }

  public getRoadmapService(): IRoadmapService {
    return this.roadmapService;
  }

  public getStorageService(): IStorageService {
    return this.storageService;
  }

  public getUpvoteService(): IUpvoteService {
    return this.upvoteService;
  }

  public getUserService(): IUserService {
    return this.userService;
  }
}
