import type { BadgeDao } from "@/dao/interfaces/BadgeDao";
import type { AnalyticsEventDao } from "@/dao/interfaces/AnalyticsEventDao";
import type { BusinessStatsDao } from "@/dao/interfaces/BusinessStatsDao";
import type { ChatDao } from "@/dao/interfaces/ChatDao";
import type { CloudFunctionsDao } from "@/dao/interfaces/CloudFunctionsDao";
import type { CustomerDao } from "@/dao/interfaces/CustomerDao";
import type { DaoFactory } from "@/dao/interfaces/factory/DaoFactory";
import type { GridStatsDao } from "@/dao/interfaces/GridStatsDao";
import type { LayoutDao } from "@/dao/interfaces/LayoutDao";
import type { RoadmapDao } from "@/dao/interfaces/RoadmapDao";
import type { SlugDao } from "@/dao/interfaces/SlugDao";
import type { StorageDao } from "@/dao/interfaces/StorageDao";
import type { UpvoteDao } from "@/dao/interfaces/UpvoteDao";
import type { UserDao } from "@/dao/interfaces/UserDao";
import type { UserGameDataDao } from "@/dao/interfaces/UserGameDataDao";
import { StubbedBadgeDao } from "../StubbedBadgeDao";
import { StubbedAnalyticsEventDao } from "../StubbedAnalyticsEventDao";
import { StubbedBusinessStatsDao } from "../StubbedBusinessStatsDao";
import { StubbedChatDao } from "../StubbedChatDao";
import { StubbedCloudFunctionsDao } from "../StubbedCloudFunctionsDao";
import { StubbedCustomerDao } from "../StubbedCustomerDao";
import { StubbedGridStatsDao } from "../StubbedGridStatsDao";
import { StubbedLayoutDao } from "../StubbedLayoutDao";
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
  private layoutDao: LayoutDao;
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
    this.layoutDao = new StubbedLayoutDao();
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

  public getLayoutDao(): LayoutDao {
    return this.layoutDao;
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
