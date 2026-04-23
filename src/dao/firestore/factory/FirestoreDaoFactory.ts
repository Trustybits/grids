import { db, functions, storage } from "@/firebase";
import type { ChatDao } from "@/dao/interfaces/ChatDao";
import type { CloudFunctionsDao } from "@/dao/interfaces/CloudFunctionsDao";
import type { CustomerDao } from "@/dao/interfaces/CustomerDao";
import type { DaoFactory } from "@/dao/interfaces/factory/DaoFactory";
import type { LayoutDao } from "@/dao/interfaces/LayoutDao";
import type { RoadmapDao } from "@/dao/interfaces/RoadmapDao";
import type { SlugDao } from "@/dao/interfaces/SlugDao";
import type { StorageDao } from "@/dao/interfaces/StorageDao";
import type { UpvoteDao } from "@/dao/interfaces/UpvoteDao";
import type { UserDao } from "@/dao/interfaces/UserDao";
import type { UserGameDataDao } from "@/dao/interfaces/UserGameDataDao";
import { FirebaseCloudFunctionsDao } from "../FirebaseCloudFunctionsDao";
import { FirebaseStorageDao } from "../FirebaseStorageDao";
import { FirestoreChatDao } from "../FirestoreChatDao";
import { FirestoreCustomerDao } from "../FirestoreCustomerDao";
import { FirestoreLayoutDao } from "../FirestoreLayoutDao";
import { FirestoreRoadmapDao } from "../FirestoreRoadmapDao";
import { FirestoreSlugDao } from "../FirestoreSlugDao";
import { FirestoreUpvoteDao } from "../FirestoreUpvoteDao";
import { FirestoreUserDao } from "../FirestoreUserDao";
import { FirestoreUserGameDataDao } from "../FirestoreUserGameDataDao";

export class FirestoreDaoFactory implements DaoFactory {
  private chatDao: ChatDao;
  private cloudFunctionsDao: CloudFunctionsDao;
  private customerDao: CustomerDao;
  private layoutDao: LayoutDao;
  private roadmapDao: RoadmapDao;
  private slugDao: SlugDao;
  private storageDao: StorageDao;
  private upvoteDao: UpvoteDao;
  private userDao: UserDao;
  private userGameDataDao: UserGameDataDao;

  public constructor() {
    this.chatDao = new FirestoreChatDao(db);
    this.cloudFunctionsDao = new FirebaseCloudFunctionsDao(functions);
    this.customerDao = new FirestoreCustomerDao(db);
    this.layoutDao = new FirestoreLayoutDao(db);
    this.roadmapDao = new FirestoreRoadmapDao(functions);
    this.slugDao = new FirestoreSlugDao(db);
    this.storageDao = new FirebaseStorageDao(storage);
    this.upvoteDao = new FirestoreUpvoteDao(db, functions);
    this.userDao = new FirestoreUserDao(db);
    this.userGameDataDao = new FirestoreUserGameDataDao(db);
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
