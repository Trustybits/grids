import type { ChatDao } from "@/dao/interfaces/ChatDao";
import type { CustomerDao } from "@/dao/interfaces/CustomerDao";
import type { DaoFactory } from "@/dao/interfaces/factory/DaoFactory";
import type { LayoutDao } from "@/dao/interfaces/LayoutDao";
import type { SlugDao } from "@/dao/interfaces/SlugDao";
import type { UpvoteDao } from "@/dao/interfaces/UpvoteDao";
import type { UserDao } from "@/dao/interfaces/UserDao";
import type { UserGameDataDao } from "@/dao/interfaces/UserGameDataDao";
import { StubbedChatDao } from "../StubbedChatDao";
import { StubbedCustomerDao } from "../StubbedCustomerDao";
import { StubbedLayoutDao } from "../StubbedLayoutDao";
import { StubbedSlugDao } from "../StubbedSlugDao";
import { StubbedUpvoteDao } from "../StubbedUpvoteDao";
import { StubbedUserDao } from "../StubbedUserDao";
import { StubbedUserGameDataDao } from "../StubbedUserGameDataDao";

export class StubbedDaoFactory implements DaoFactory {
  private chatDao: ChatDao;
  private customerDao: CustomerDao;
  private layoutDao: LayoutDao;
  private slugDao: SlugDao;
  private upvoteDao: UpvoteDao;
  private userDao: UserDao;
  private userGameDataDao: UserGameDataDao;

  public constructor() {
    this.chatDao = new StubbedChatDao();
    this.customerDao = new StubbedCustomerDao();
    this.layoutDao = new StubbedLayoutDao();
    this.slugDao = new StubbedSlugDao();
    this.upvoteDao = new StubbedUpvoteDao();
    this.userDao = new StubbedUserDao();
    this.userGameDataDao = new StubbedUserGameDataDao();
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
