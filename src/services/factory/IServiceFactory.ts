import type { IChatService } from "../interfaces/IChatService";
import type { ILayoutService } from "../interfaces/ILayoutService";
import type { IRoadmapService } from "../interfaces/IRoadmapService";
import type { IStorageService } from "../interfaces/IStorageService";
import type { IUpvoteService } from "../interfaces/IUpvoteService";
import type { IUserService } from "../interfaces/IUserService";
import type { IGameDataService } from "../interfaces/IGameDataService";

export interface IServiceFactory {
  getChatService: () => IChatService;
  getLayoutService: () => ILayoutService;
  getRoadmapService: () => IRoadmapService;
  getStorageService: () => IStorageService;
  getUpvoteService: () => IUpvoteService;
  getUserService: () => IUserService;
  getGameDataService: () => IGameDataService;
}
