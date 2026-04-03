import type { ChatDao } from "@/dao/interfaces/ChatDao";
import type { CustomerDao } from "@/dao/interfaces/CustomerDao";
import type { DaoFactory } from "@/dao/interfaces/factory/DaoFactory";
import type { LayoutDao } from "@/dao/interfaces/LayoutDao";
import type { SlugDao } from "@/dao/interfaces/SlugDao";
import type { UpvoteDao } from "@/dao/interfaces/UpvoteDao";
import type { UserDao } from "@/dao/interfaces/UserDao";
import type { UserGameDataDao } from "@/dao/interfaces/UserGameDataDao";
import { FirestoreChatDao } from "../FirestoreChatDao";
import { FirestoreCustomerDao } from "../FirestoreCustomerDao";
import { FirestoreLayoutDao } from "../FirestoreLayoutDao";
import { FirestoreSlugDao } from "../FirestoreSlugDao";
import { FirestoreUpvoteDao } from "../FirestoreUpvoteDao";
import { FirestoreUserDao } from "../FirestoreUserDao";
import { FirestoreUserGameDataDao } from "../FirestoreUserGameDataDao";

class FirestoreDaoFactory implements DaoFactory {
  private chatDao: ChatDao;
  private customerDao: CustomerDao;
  private layoutDao: LayoutDao;
  private slugDao: SlugDao;
  private upvoteDao: UpvoteDao;
  private userDao: UserDao;
  private userGameDataDao: UserGameDataDao;
  
  public constructor() {
    this.chatDao = new FirestoreChatDao();
    this.customerDao = new FirestoreCustomerDao();
    this.layoutDao = new FirestoreLayoutDao();
    this.slugDao = new FirestoreSlugDao();
    this.upvoteDao = new FirestoreUpvoteDao();
    this.userDao = new FirestoreUserDao();
    this.userGameDataDao = new FirestoreUserGameDataDao();
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
}
