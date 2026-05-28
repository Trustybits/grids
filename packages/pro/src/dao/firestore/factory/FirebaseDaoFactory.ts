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
import type { UpvoteDao } from "@grids/contracts/dao";
import type { UserDao } from "@grids/contracts/dao";
import type { UserGameDataDao } from "@grids/contracts/dao";
import { FirebaseCloudFunctionsDao } from "../FirebaseCloudFunctionsDao.js";
import { FirebaseStorageDao } from "../FirebaseStorageDao.js";
import { FirestoreBadgeDao } from "../FirebaseBadgeDao.js";
import { FirestoreAnalyticsEventDao } from "../FirebaseAnalyticsEventDao.js";
import { FirestoreBusinessStatsDao } from "../FirebaseBusinessStatsDao.js";
import { FirestoreChatDao } from "../FirebaseChatDao.js";
import { FirestoreCustomerDao } from "../FirebaseCustomerDao.js";
import { FirestoreGridStatsDao } from "../FirebaseGridStatsDao.js";
import { FirestoreGridDao } from "../FirebaseGridDao.js";
import { FirestoreRoadmapDao } from "../FirebaseRoadmapDao.js";
import { FirestoreSlugDao } from "../FirebaseSlugDao.js";
import { FirestoreUpvoteDao } from "../FirebaseUpvoteDao.js";
import { FirestoreUserDao } from "../FirebaseUserDao.js";
import { FirestoreUserGameDataDao } from "../FirebaseUserGameDataDao.js";

export class FirestoreDaoFactory implements DaoFactory {
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

  public constructor(deps: {
    db: Firestore;
    functions: Functions;
    storage: FirebaseStorage;
    viewEndAnalyticsBeaconUrl: string | null;
  }) {
    const { db, functions, storage, viewEndAnalyticsBeaconUrl } = deps;
    this.badgeDao = new FirestoreBadgeDao(db);
    this.analyticsEventDao = new FirestoreAnalyticsEventDao(
      db,
      viewEndAnalyticsBeaconUrl,
    );
    this.businessStatsDao = new FirestoreBusinessStatsDao(db);
    this.chatDao = new FirestoreChatDao(db);
    this.cloudFunctionsDao = new FirebaseCloudFunctionsDao(functions);
    this.customerDao = new FirestoreCustomerDao(db);
    this.gridStatsDao = new FirestoreGridStatsDao(db);
    this.gridDao = new FirestoreGridDao(db);
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
