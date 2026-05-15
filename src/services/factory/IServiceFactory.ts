import type { IBadgeService } from "../interfaces/IBadgeService";
import type { IAnalyticsService } from "../interfaces/IAnalyticsService";
import type { IChatService } from "../interfaces/IChatService";
import type { ICloudFunctionsService } from "../interfaces/ICloudFunctionsService";
import type { IGameDataService } from "../interfaces/IGameDataService";
import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IRoadmapService } from "../interfaces/IRoadmapService";
import type { IStorageService } from "../interfaces/IStorageService";
import type { IStripeService } from "../interfaces/IStripeService";
import type { IUpvoteService } from "../interfaces/IUpvoteService";
import type { IUserService } from "../interfaces/IUserService";

export interface IServiceFactory {
  getBadgeService: () => IBadgeService;
  getAnalyticsService: () => IAnalyticsService;
  getChatService: () => IChatService;
  getCloudFunctionsService: () => ICloudFunctionsService;
  getGameDataService: () => IGameDataService;
  getLayoutService: () => ILayoutService;
  getRoadmapService: () => IRoadmapService;
  getStorageService: () => IStorageService;
  getStripeService: () => IStripeService;
  getUpvoteService: () => IUpvoteService;
  getUserService: () => IUserService;
}
