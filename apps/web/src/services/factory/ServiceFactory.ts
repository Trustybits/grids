import { BadgeService } from "../BadgeService";
import { AnalyticsService } from "../AnalyticsService";
import { ChatService } from "../ChatService";
import { CloudFunctionsService } from "../CloudFunctionsService";
import { GameDataService } from "../GameDataService";
import { GridService } from "../GridService";
import { RoadmapService } from "../RoadmapService";
import { StorageService } from "../StorageService";
import { StripeService } from "../StripeService";
import { UpvoteService } from "../UpvoteService";
import { UserService } from "../UserService";
import type { IBadgeService } from "../interfaces/IBadgeService";
import type { IAnalyticsService } from "../interfaces/IAnalyticsService";
import type { IChatService } from "../interfaces/IChatService";
import type { ICloudFunctionsService } from "../interfaces/ICloudFunctionsService";
import type { IGameDataService } from "../interfaces/IGameDataService";
import type { IGridService } from "../interfaces/IGridService";
import type { IRoadmapService } from "../interfaces/IRoadmapService";
import type { IStorageService } from "../interfaces/IStorageService";
import type { IStripeService } from "../interfaces/IStripeService";
import type { IUpvoteService } from "../interfaces/IUpvoteService";
import type { IUserService } from "../interfaces/IUserService";
import { MockBadgeService } from "../mocks/MockBadgeService";
import { MockAnalyticsService } from "../mocks/MockAnalyticsService";
import { MockChatService } from "../mocks/MockChatService";
import { MockCloudFunctionsService } from "../mocks/MockCloudFunctionsService";
import { MockGameDataService } from "../mocks/MockGameDataService";
import { MockGridService } from "../mocks/MockGridService";
import { MockRoadmapService } from "../mocks/MockRoadmapService";
import { MockStorageService } from "../mocks/MockStorageService";
import { MockStripeService } from "../mocks/MockStripeService";
import { MockUpvoteService } from "../mocks/MockUpvoteService";
import { MockUserService } from "../mocks/MockUserService";
import type { IServiceFactory } from "./IServiceFactory";

export class ServiceFactory implements IServiceFactory {
  private useMocks: boolean;
  private badgeService: IBadgeService;
  private analyticsService: IAnalyticsService;
  private chatService: IChatService;
  private cloudFunctionsService: ICloudFunctionsService;
  private gameDataService: IGameDataService;
  private gridService: IGridService;
  private roadmapService: IRoadmapService;
  private storageService: IStorageService;
  private stripeService: IStripeService;
  private upvoteService: IUpvoteService;
  private userService: IUserService;

  public constructor(useMocks: boolean = false) {
    this.useMocks = useMocks;

    if (this.useMocks) {
      this.badgeService = new MockBadgeService();
      this.analyticsService = new MockAnalyticsService();
      this.chatService = new MockChatService();
      this.cloudFunctionsService = new MockCloudFunctionsService();
      this.gameDataService = new MockGameDataService();
      this.gridService = new MockGridService();
      this.roadmapService = new MockRoadmapService();
      this.storageService = new MockStorageService();
      this.stripeService = new MockStripeService();
      this.upvoteService = new MockUpvoteService();
      this.userService = new MockUserService();
    } else {
      this.badgeService = new BadgeService();
      this.analyticsService = new AnalyticsService();
      this.chatService = new ChatService();
      this.cloudFunctionsService = new CloudFunctionsService();
      this.gameDataService = new GameDataService();
      this.gridService = new GridService();
      this.roadmapService = new RoadmapService();
      this.storageService = new StorageService();
      this.stripeService = new StripeService();
      this.upvoteService = new UpvoteService();
      this.userService = new UserService();
    }
  }

  public getBadgeService(): IBadgeService {
    return this.badgeService;
  }
  
  public getAnalyticsService(): IAnalyticsService {
    return this.analyticsService;
  }

  public getChatService(): IChatService {
    return this.chatService;
  }

  public getCloudFunctionsService(): ICloudFunctionsService {
    return this.cloudFunctionsService;
  }

  public getGameDataService(): IGameDataService {
    return this.gameDataService;
  }

  public getGridService(): IGridService {
    return this.gridService;
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
