import { db, functions, storage } from "@/infrastructure/firebase";
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
import { FirebaseCloudFunctionsDao } from "../FirebaseCloudFunctionsDao";
import { FirebaseStorageDao } from "../FirebaseStorageDao";
import { FirestoreBadgeDao } from "../FirestoreBadgeDao";
import { FirestoreAnalyticsEventDao } from "../FirestoreAnalyticsEventDao";
import { FirestoreBusinessStatsDao } from "../FirestoreBusinessStatsDao";
import { FirestoreChatDao } from "../FirestoreChatDao";
import { FirestoreCustomerDao } from "../FirestoreCustomerDao";
import { FirestoreGridStatsDao } from "../FirestoreGridStatsDao";
import { FirestoreLayoutDao } from "../FirestoreLayoutDao";
import { FirestoreRoadmapDao } from "../FirestoreRoadmapDao";
import { FirestoreSlugDao } from "../FirestoreSlugDao";
import { FirestoreUpvoteDao } from "../FirestoreUpvoteDao";
import { FirestoreUserDao } from "../FirestoreUserDao";
import { FirestoreUserGameDataDao } from "../FirestoreUserGameDataDao";

export class FirestoreDaoFactory implements DaoFactory {
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
    this.badgeDao = new FirestoreBadgeDao(db);
    this.analyticsEventDao = new FirestoreAnalyticsEventDao(db);
    this.businessStatsDao = new FirestoreBusinessStatsDao(db);
    this.chatDao = new FirestoreChatDao(db);
    this.cloudFunctionsDao = new FirebaseCloudFunctionsDao(functions);
    this.customerDao = new FirestoreCustomerDao(db);
    this.gridStatsDao = new FirestoreGridStatsDao(db);
    this.layoutDao = new FirestoreLayoutDao(db);
    this.roadmapDao = new FirestoreRoadmapDao(functions);
    this.slugDao = new FirestoreSlugDao(db, functions);
    this.storageDao = new FirebaseStorageDao(storage);
    this.upvoteDao = new FirestoreUpvoteDao(db, functions);
    this.userDao = new FirestoreUserDao(db);
    this.userGameDataDao = new FirestoreUserGameDataDao(db);
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
