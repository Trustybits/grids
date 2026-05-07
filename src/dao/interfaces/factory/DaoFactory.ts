import type { AnalyticsEventDao } from '../AnalyticsEventDao';
import type { BusinessStatsDao } from '../BusinessStatsDao';
import type { ChatDao } from '../ChatDao';
import type { CloudFunctionsDao } from '../CloudFunctionsDao';
import type { CustomerDao } from '../CustomerDao';
import type { GridStatsDao } from '../GridStatsDao';
import type { LayoutDao } from '../LayoutDao';
import type { RoadmapDao } from '../RoadmapDao';
import type { SlugDao } from '../SlugDao';
import type { StorageDao } from '../StorageDao';
import type { UpvoteDao } from '../UpvoteDao';
import type { UserDao } from '../UserDao';
import type { UserGameDataDao } from '../UserGameDataDao';

export interface DaoFactory {
  getAnalyticsEventDao: () => AnalyticsEventDao;
  getBusinessStatsDao: () => BusinessStatsDao;
  getChatDao: () => ChatDao;
  getCloudFunctionsDao: () => CloudFunctionsDao;
  getCustomerDao: () => CustomerDao;
  getGridStatsDao: () => GridStatsDao;
  getLayoutDao: () => LayoutDao;
  getRoadmapDao: () => RoadmapDao;
  getSlugDao: () => SlugDao;
  getStorageDao: () => StorageDao;
  getUpvoteDao: () => UpvoteDao;
  getUserDao: () => UserDao;
  getUserGameDataDao: () => UserGameDataDao;
}
