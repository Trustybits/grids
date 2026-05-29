import type { BadgeDao } from "@grids/contracts/dao";
import type { AnalyticsEventDao } from "@grids/contracts/dao";
import type { BusinessStatsDao } from "@grids/contracts/dao";
import type { ChatDao } from "@grids/contracts/dao";
import type { CloudFunctionsDao } from "@grids/contracts/dao";
import type { CustomerDao } from "@grids/contracts/dao";
import type { DaoFactory } from "@grids/contracts/dao";
import type { GridStatsDao } from "@grids/contracts/dao";
import type { GridDao } from "@grids/contracts/dao";
import type { RoadmapDao } from "@grids/contracts/dao";
import type { SlugDao } from "@grids/contracts/dao";
import type { StorageDao } from "@grids/contracts/dao";
import type { UpvoteDao } from "@grids/contracts/dao";
import type { UserDao } from "@grids/contracts/dao";
import type { UserGameDataDao } from "@grids/contracts/dao";
import { StubbedBadgeDao } from "../StubbedBadgeDao";
import { StubbedAnalyticsEventDao } from "../StubbedAnalyticsEventDao";
import { StubbedBusinessStatsDao } from "../StubbedBusinessStatsDao";
import { StubbedChatDao } from "../StubbedChatDao";
import { StubbedCloudFunctionsDao } from "../StubbedCloudFunctionsDao";
import { StubbedCustomerDao } from "../StubbedCustomerDao";
import { StubbedGridStatsDao } from "../StubbedGridStatsDao";
import { StubbedGridDao } from "../StubbedGridDao";
import { StubbedRoadmapDao } from "../StubbedRoadmapDao";
import { StubbedSlugDao } from "../StubbedSlugDao";
import { StubbedStorageDao } from "../StubbedStorageDao";
import { StubbedUpvoteDao } from "../StubbedUpvoteDao";
import { StubbedUserDao } from "../StubbedUserDao";
import { StubbedUserGameDataDao } from "../StubbedUserGameDataDao";

export class StubbedDaoFactory implements DaoFactory {
  private badgeDao: BadgeDao;
  private analyticsEventDao: AnalyticsEventDao;
  private businessStatsDao: BusinessStatsDao;
  private chatDao: ChatDao;
  private cloudFunctionsDao: CloudFunctionsDao;
  private customerDao: CustomerDao;
  private gridStatsDao: GridStatsDao;
  private gridDao: GridDao;
  private roadmapDao: RoadmapDao;
  private slugDao: SlugDao;
  private storageDao: StorageDao;
  private upvoteDao: UpvoteDao;
  private userDao: UserDao;
  private userGameDataDao: UserGameDataDao;

  public constructor() {
    this.badgeDao = new StubbedBadgeDao();
    this.analyticsEventDao = new StubbedAnalyticsEventDao();
    this.businessStatsDao = new StubbedBusinessStatsDao();
    this.chatDao = new StubbedChatDao();
    this.cloudFunctionsDao = new StubbedCloudFunctionsDao();
    this.customerDao = new StubbedCustomerDao();
    this.gridStatsDao = new StubbedGridStatsDao();
    this.gridDao = new StubbedGridDao();
    this.roadmapDao = new StubbedRoadmapDao();
    this.slugDao = new StubbedSlugDao();
    this.storageDao = new StubbedStorageDao();
    this.upvoteDao = new StubbedUpvoteDao();
    this.userDao = new StubbedUserDao();
    this.userGameDataDao = new StubbedUserGameDataDao();
  }

  public getBadgeDao(): BadgeDao {
    return this.badgeDao;
  }
  
  public getAnalyticsEventDao(): AnalyticsEventDao {
    return this.analyticsEventDao;
  }

  public getBusinessStatsDao(): BusinessStatsDao {
    return this.businessStatsDao;
  }

  public getChatDao(): ChatDao {
    return this.chatDao;
  }

  public getCloudFunctionsDao(): CloudFunctionsDao {
    return this.cloudFunctionsDao;
  }

  public getCustomerDao(): CustomerDao {
    return this.customerDao;
  }

  public getGridStatsDao(): GridStatsDao {
    return this.gridStatsDao;
  }

  public getGridDao(): GridDao {
    return this.gridDao;
  }

  public getRoadmapDao(): RoadmapDao {
    return this.roadmapDao;
  }

  public getSlugDao(): SlugDao {
    return this.slugDao;
  }

  public getStorageDao(): StorageDao {
    return this.storageDao;
  }

  public getUpvoteDao(): UpvoteDao {
    return this.upvoteDao;
  }

  public getUserDao(): UserDao {
    return this.userDao;
  }

  public getUserGameDataDao(): UserGameDataDao {
    return this.userGameDataDao;
  }
}
