import type { LayoutDao } from '../LayoutDao';
import type { UserDao } from '../UserDao';
import type { SlugDao } from '../SlugDao';
import type { UserGameDataDao } from '../UserGameDataDao';
import type { ChatDao } from '../ChatDao';
import type { UpvoteDao } from '../UpvoteDao';
import type { CustomerDao } from '../CustomerDao';
import type { StorageDao } from '../StorageDao';

export interface DaoFactory {
  getLayoutDao: () => LayoutDao;
  getUserDao: () => UserDao;
  getSlugDao: () => SlugDao;
  getUserGameDataDao: () => UserGameDataDao;
  getChatDao: () => ChatDao;
  getUpvoteDao: () => UpvoteDao;
  getCustomerDao: () => CustomerDao;
  getStorageDao: () => StorageDao;
}
