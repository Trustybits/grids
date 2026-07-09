import { BadgeService } from "../BadgeService";
import { AnalyticsService } from "../AnalyticsService";
import { ChatService } from "../ChatService";
import { CloudFunctionsService } from "../CloudFunctionsService";
import { GameDataService } from "../GameDataService";
import { GridService } from "../GridService";
import { GridTransferService } from "../GridTransferService";
import { RoadmapService } from "../RoadmapService";
import { StorageService } from "../StorageService";
import { StripeService } from "../StripeService";
import { UpvoteService } from "../UpvoteService";
import { UserService } from "../UserService";
import type { BadgeServiceInterface } from "../interfaces/BadgeServiceInterface";
import type { AnalyticsServiceInterface } from "../interfaces/AnalyticsServiceInterface";
import type { ChatServiceInterface } from "../interfaces/ChatServiceInterface";
import type { CloudFunctionsServiceInterface } from "../interfaces/CloudFunctionsServiceInterface";
import type { GameDataServiceInterface } from "../interfaces/GameDataServiceInterface";
import type { GridServiceInterface } from "../interfaces/GridServiceInterface";
import type { GridTransferServiceInterface } from "../interfaces/GridTransferServiceInterface";
import type { RoadmapServiceInterface } from "../interfaces/RoadmapServiceInterface";
import type { StorageServiceInterface } from "../interfaces/StorageServiceInterface";
import type { StripeServiceInterface } from "../interfaces/StripeServiceInterface";
import type { UpvoteServiceInterface } from "../interfaces/UpvoteServiceInterface";
import type { UserServiceInterface } from "../interfaces/UserServiceInterface";
import { MockBadgeService } from "../mocks/MockBadgeService";
import { MockAnalyticsService } from "../mocks/MockAnalyticsService";
import { MockChatService } from "../mocks/MockChatService";
import { MockCloudFunctionsService } from "../mocks/MockCloudFunctionsService";
import { MockGameDataService } from "../mocks/MockGameDataService";
import { MockGridService } from "../mocks/MockGridService";
import { MockGridTransferService } from "../mocks/MockGridTransferService";
import { MockRoadmapService } from "../mocks/MockRoadmapService";
import { MockStorageService } from "../mocks/MockStorageService";
import { MockStripeService } from "../mocks/MockStripeService";
import { MockUpvoteService } from "../mocks/MockUpvoteService";
import { MockUserService } from "../mocks/MockUserService";
import type { ServiceFactoryInterface } from "./ServiceFactoryInterface";

export class ServiceFactory implements ServiceFactoryInterface {
  private useMocks: boolean;
  private badgeService: BadgeServiceInterface;
  private analyticsService: AnalyticsServiceInterface;
  private chatService: ChatServiceInterface;
  private cloudFunctionsService: CloudFunctionsServiceInterface;
  private gameDataService: GameDataServiceInterface;
  private gridService: GridServiceInterface;
  private gridTransferService: GridTransferServiceInterface;
  private roadmapService: RoadmapServiceInterface;
  private storageService: StorageServiceInterface;
  private stripeService: StripeServiceInterface;
  private upvoteService: UpvoteServiceInterface;
  private userService: UserServiceInterface;

  public constructor(useMocks: boolean = false) {
    this.useMocks = useMocks;

    if (this.useMocks) {
      this.badgeService = new MockBadgeService();
      this.analyticsService = new MockAnalyticsService();
      this.chatService = new MockChatService();
      this.cloudFunctionsService = new MockCloudFunctionsService();
      this.gameDataService = new MockGameDataService();
      this.gridService = new MockGridService();
      this.gridTransferService = new MockGridTransferService();
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
      this.gridTransferService = new GridTransferService();
      this.roadmapService = new RoadmapService();
      this.storageService = new StorageService();
      this.stripeService = new StripeService();
      this.upvoteService = new UpvoteService();
      this.userService = new UserService();
    }
  }

  public getBadgeService(): BadgeServiceInterface {
    return this.badgeService;
  }

  public getAnalyticsService(): AnalyticsServiceInterface {
    return this.analyticsService;
  }

  public getChatService(): ChatServiceInterface {
    return this.chatService;
  }

  public getCloudFunctionsService(): CloudFunctionsServiceInterface {
    return this.cloudFunctionsService;
  }

  public getGameDataService(): GameDataServiceInterface {
    return this.gameDataService;
  }

  public getGridService(): GridServiceInterface {
    return this.gridService;
  }

  public getGridTransferService(): GridTransferServiceInterface {
    return this.gridTransferService;
  }

  public getRoadmapService(): RoadmapServiceInterface {
    return this.roadmapService;
  }

  public getStorageService(): StorageServiceInterface {
    return this.storageService;
  }

  public getStripeService(): StripeServiceInterface {
    return this.stripeService;
  }

  public getUpvoteService(): UpvoteServiceInterface {
    return this.upvoteService;
  }

  public getUserService(): UserServiceInterface {
    return this.userService;
  }
}
