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
import { StubbedChatDao } from "../StubbedChatDao";
import { StubbedCloudFunctionsDao } from "../StubbedCloudFunctionsDao";
import { StubbedCustomerDao } from "../StubbedCustomerDao";
import { StubbedLayoutDao } from "../StubbedLayoutDao";
import { StubbedRoadmapDao } from "../StubbedRoadmapDao";
import { StubbedSlugDao } from "../StubbedSlugDao";
import { StubbedStorageDao } from "../StubbedStorageDao";
import { StubbedUpvoteDao } from "../StubbedUpvoteDao";
import { StubbedUserDao } from "../StubbedUserDao";
import { StubbedUserGameDataDao } from "../StubbedUserGameDataDao";

export class StubbedDaoFactory implements DaoFactory {
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
    this.chatDao = new StubbedChatDao();
    this.cloudFunctionsDao = new StubbedCloudFunctionsDao();
    this.customerDao = new StubbedCustomerDao();
    this.layoutDao = new StubbedLayoutDao();
    this.roadmapDao = new StubbedRoadmapDao();
    this.slugDao = new StubbedSlugDao();
    this.storageDao = new StubbedStorageDao();
    this.upvoteDao = new StubbedUpvoteDao();
    this.userDao = new StubbedUserDao();
    this.userGameDataDao = new StubbedUserGameDataDao();
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
