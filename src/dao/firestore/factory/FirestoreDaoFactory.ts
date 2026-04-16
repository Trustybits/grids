import { db, storage } from "@/firebase";
import type { ChatDao } from "@/dao/interfaces/ChatDao";
import type { CustomerDao } from "@/dao/interfaces/CustomerDao";
import type { DaoFactory } from "@/dao/interfaces/factory/DaoFactory";
import type { LayoutDao } from "@/dao/interfaces/LayoutDao";
import type { SlugDao } from "@/dao/interfaces/SlugDao";
import type { StorageDao } from "@/dao/interfaces/StorageDao";
import type { UpvoteDao } from "@/dao/interfaces/UpvoteDao";
import type { UserDao } from "@/dao/interfaces/UserDao";
import type { UserGameDataDao } from "@/dao/interfaces/UserGameDataDao";
import { FirebaseStorageDao } from "../FirebaseStorageDao";
import { FirestoreChatDao } from "../FirestoreChatDao";
import { FirestoreCustomerDao } from "../FirestoreCustomerDao";
import { FirestoreLayoutDao } from "../FirestoreLayoutDao";
import { FirestoreSlugDao } from "../FirestoreSlugDao";
import { FirestoreUpvoteDao } from "../FirestoreUpvoteDao";
import { FirestoreUserDao } from "../FirestoreUserDao";
import { FirestoreUserGameDataDao } from "../FirestoreUserGameDataDao";

export class FirestoreDaoFactory implements DaoFactory {
  private chatDao: ChatDao;
  private customerDao: CustomerDao;
  private layoutDao: LayoutDao;
  private slugDao: SlugDao;
  private storageDao: StorageDao;
  private upvoteDao: UpvoteDao;
  private userDao: UserDao;
  private userGameDataDao: UserGameDataDao;

  public constructor() {
    this.chatDao = new FirestoreChatDao(db);
    this.customerDao = new FirestoreCustomerDao(db);
    this.layoutDao = new FirestoreLayoutDao(db);
    this.slugDao = new FirestoreSlugDao(db);
    this.storageDao = new FirebaseStorageDao(storage);
    this.upvoteDao = new FirestoreUpvoteDao(db);
    this.userDao = new FirestoreUserDao(db);
    this.userGameDataDao = new FirestoreUserGameDataDao(db);
  }

  public getLayoutDao(): LayoutDao {
    return this.layoutDao;
  }

  public getUserDao(): UserDao {
    return this.userDao;
  }

  public getSlugDao(): SlugDao {
    return this.slugDao;
  }

  public getUserGameDataDao(): UserGameDataDao {
    return this.userGameDataDao;
  }

  public getChatDao(): ChatDao {
    return this.chatDao;
  }

  public getUpvoteDao(): UpvoteDao {
    return this.upvoteDao;
  }

  public getCustomerDao(): CustomerDao {
    return this.customerDao;
  }

  public getStorageDao(): StorageDao {
    return this.storageDao;
  }
}
