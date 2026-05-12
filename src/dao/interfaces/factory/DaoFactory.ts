import type { BadgeDao } from '../BadgeDao';
import type { ChatDao } from '../ChatDao';
import type { CloudFunctionsDao } from '../CloudFunctionsDao';
import type { CustomerDao } from '../CustomerDao';
import type { LayoutDao } from '../LayoutDao';
import type { RoadmapDao } from '../RoadmapDao';
import type { SlugDao } from '../SlugDao';
import type { StorageDao } from '../StorageDao';
import type { UpvoteDao } from '../UpvoteDao';
import type { UserDao } from '../UserDao';
import type { UserGameDataDao } from '../UserGameDataDao';

export interface DaoFactory {
  getBadgeDao: () => BadgeDao;
  getChatDao: () => ChatDao;
  getCloudFunctionsDao: () => CloudFunctionsDao;
  getCustomerDao: () => CustomerDao;
  getLayoutDao: () => LayoutDao;
  getRoadmapDao: () => RoadmapDao;
  getSlugDao: () => SlugDao;
  getStorageDao: () => StorageDao;
  getUpvoteDao: () => UpvoteDao;
  getUserDao: () => UserDao;
  getUserGameDataDao: () => UserGameDataDao;
}
