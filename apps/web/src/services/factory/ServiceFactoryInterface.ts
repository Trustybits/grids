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

export interface ServiceFactoryInterface {
  getBadgeService: () => BadgeServiceInterface;
  getAnalyticsService: () => AnalyticsServiceInterface;
  getChatService: () => ChatServiceInterface;
  getCloudFunctionsService: () => CloudFunctionsServiceInterface;
  getGameDataService: () => GameDataServiceInterface;
  getGridService: () => GridServiceInterface;
  getGridTransferService: () => GridTransferServiceInterface;
  getRoadmapService: () => RoadmapServiceInterface;
  getStorageService: () => StorageServiceInterface;
  getStripeService: () => StripeServiceInterface;
  getUpvoteService: () => UpvoteServiceInterface;
  getUserService: () => UserServiceInterface;
}
