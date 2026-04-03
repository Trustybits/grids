import type { DaoFactory } from "../interfaces/factory/DaoFactory";
import type { LayoutDao } from "../interfaces/LayoutDao";
import type { UserDao } from "../interfaces/UserDao";
import type { SlugDao } from "../interfaces/SlugDao";
import type { UserGameDataDao } from "../interfaces/UserGameDataDao";
import type { ChatDao } from "../interfaces/ChatDao";
import type { UpvoteDao } from "../interfaces/UpvoteDao";
import type { CustomerDao } from "../interfaces/CustomerDao";
import { FirestoreLayoutDao } from "./FirestoreLayoutDao";
import { FirestoreUserDao } from "./FirestoreUserDao";
import { FirestoreSlugDao } from "./FirestoreSlugDao";
import { FirestoreUserGameDataDao } from "./FirestoreUserGameDataDao";
import { FirestoreChatDao } from "./FirestoreChatDao";
import { FirestoreUpvoteDao } from "./FirestoreUpvoteDao";
import { FirestoreCustomerDao } from "./FirestoreCustomerDao";

export class FirestoreDaoFactory implements DaoFactory {
  public getLayoutDao(): LayoutDao {
    return new FirestoreLayoutDao();
  }

  public getUserDao(): UserDao {
    return new FirestoreUserDao();
  }

  public getSlugDao(): SlugDao {
    return new FirestoreSlugDao();
  }

  public getUserGameDataDao(): UserGameDataDao {
    return new FirestoreUserGameDataDao();
  }

  public getChatDao(): ChatDao {
    return new FirestoreChatDao();
  }

  public getUpvoteDao(): UpvoteDao {
    return new FirestoreUpvoteDao();
  }

  public getCustomerDao(): CustomerDao {
    return new FirestoreCustomerDao();
  }
}
