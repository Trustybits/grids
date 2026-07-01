import type { Firestore } from "firebase/firestore";
import type { Functions } from "firebase/functions";
import type { FirebaseStorage } from "firebase/storage";
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
import type { UploadArchiveDao } from "@grids/contracts/dao";
import type { UpvoteDao } from "@grids/contracts/dao";
import type { UserDao } from "@grids/contracts/dao";
import type { UserGameDataDao } from "@grids/contracts/dao";
import { FirebaseCloudFunctionsDao } from "../FirebaseCloudFunctionsDao.js";
import { FirebaseStorageDao } from "../FirebaseStorageDao.js";
import { FirebaseUploadArchiveDao } from "../FirebaseUploadArchiveDao.js";
import { FirebaseBadgeDao } from "../FirebaseBadgeDao.js";
import { FirebaseAnalyticsEventDao } from "../FirebaseAnalyticsEventDao.js";
import { FirebaseBusinessStatsDao } from "../FirebaseBusinessStatsDao.js";
import { FirebaseChatDao } from "../FirebaseChatDao.js";
import { FirebaseCustomerDao } from "../FirebaseCustomerDao.js";
import { FirebaseGridStatsDao } from "../FirebaseGridStatsDao.js";
import { FirebaseGridDao } from "../FirebaseGridDao.js";
import { FirebaseRoadmapDao } from "../FirebaseRoadmapDao.js";
import { FirebaseSlugDao } from "../FirebaseSlugDao.js";
import { FirebaseUpvoteDao } from "../FirebaseUpvoteDao.js";
import { FirebaseUserDao } from "../FirebaseUserDao.js";
import { FirebaseUserGameDataDao } from "../FirebaseUserGameDataDao.js";

export class FirebaseDaoFactory implements DaoFactory {
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
  private uploadArchiveDao: UploadArchiveDao;
  private upvoteDao: UpvoteDao;
  private userDao: UserDao;
  private userGameDataDao: UserGameDataDao;

  public constructor(deps: {
    db: Firestore;
    functions: Functions;
    storage: FirebaseStorage;
    viewEndAnalyticsBeaconUrl: string | null;
  }) {
    const { db, functions, storage, viewEndAnalyticsBeaconUrl } = deps;
    this.badgeDao = new FirebaseBadgeDao(db);
    this.analyticsEventDao = new FirebaseAnalyticsEventDao(
      db,
      viewEndAnalyticsBeaconUrl,
    );
    this.businessStatsDao = new FirebaseBusinessStatsDao(db);
    this.chatDao = new FirebaseChatDao(db);
    this.cloudFunctionsDao = new FirebaseCloudFunctionsDao(functions);
    this.customerDao = new FirebaseCustomerDao(db);
    this.gridStatsDao = new FirebaseGridStatsDao(db);
    this.gridDao = new FirebaseGridDao(db);
    this.roadmapDao = new FirebaseRoadmapDao(functions);
    this.slugDao = new FirebaseSlugDao(db, functions);
    this.storageDao = new FirebaseStorageDao(storage);
    this.uploadArchiveDao = new FirebaseUploadArchiveDao(db);
    this.upvoteDao = new FirebaseUpvoteDao(db, functions);
    this.userDao = new FirebaseUserDao(db);
    this.userGameDataDao = new FirebaseUserGameDataDao(db);
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

  public getUploadArchiveDao(): UploadArchiveDao {
    return this.uploadArchiveDao;
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
