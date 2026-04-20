import { ChatService } from "../ChatService";
import { GameDataService } from "../GameDataService";
import { LayoutService } from "../LayoutService";
import { RoadmapService } from "../RoadmapService";
import { StorageService } from "../StorageService";
import { StripeService } from "../StripeService";
import { UpvoteService } from "../UpvoteService";
import { UserService } from "../UserService";
import type { IChatService } from "../interfaces/IChatService";
import type { IGameDataService } from "../interfaces/IGameDataService";
import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IRoadmapService } from "../interfaces/IRoadmapService";
import type { IStorageService } from "../interfaces/IStorageService";
import type { IStripeService } from "../interfaces/IStripeService";
import type { IUpvoteService } from "../interfaces/IUpvoteService";
import type { IUserService } from "../interfaces/IUserService";
import { MockChatService } from "../mocks/MockChatService";
import { MockGameDataService } from "../mocks/MockGameDataService";
import { MockLayoutService } from "../mocks/MockLayoutService";
import { MockRoadmapService } from "../mocks/MockRoadmapService";
import { MockStorageService } from "../mocks/MockStorageService";
import { MockStripeService } from "../mocks/MockStripeService";
import { MockUpvoteService } from "../mocks/MockUpvoteService";
import { MockUserService } from "../mocks/MockUserService";
import type { IServiceFactory } from "./IServiceFactory";

export class ServiceFactory implements IServiceFactory {
  private useMocks: boolean;
  private chatService: IChatService;
  private gameDataService: IGameDataService;
  private layoutService: ILayoutService;
  private roadmapService: IRoadmapService;
  private storageService: IStorageService;
  private stripeService: IStripeService;
  private upvoteService: IUpvoteService;
  private userService: IUserService;

  public constructor(useMocks: boolean = false) {
    this.useMocks = useMocks;

    if (this.useMocks) {
      this.chatService = new MockChatService();
      this.gameDataService = new MockGameDataService();
      this.layoutService = new MockLayoutService();
      this.roadmapService = new MockRoadmapService();
      this.storageService = new MockStorageService();
      this.stripeService = new MockStripeService();
      this.upvoteService = new MockUpvoteService();
      this.userService = new MockUserService();
    } else {
      this.chatService = new ChatService();
      this.gameDataService = new GameDataService();
      this.layoutService = new LayoutService();
      this.roadmapService = new RoadmapService();
      this.storageService = new StorageService();
      this.stripeService = new StripeService();
      this.upvoteService = new UpvoteService();
      this.userService = new UserService();
    }
  }

  public getChatService(): IChatService {
    return this.chatService;
  }

  public getGameDataService(): IGameDataService {
    return this.gameDataService;
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

  public getStripeService(): IStripeService {
    return this.stripeService;
  }

  public getUpvoteService(): IUpvoteService {
    return this.upvoteService;
  }

  public getUserService(): IUserService {
    return this.userService;
  }
}
