import type { BadgeDao } from '../BadgeDao.js';
import type { AnalyticsEventDao } from '../AnalyticsEventDao.js';
import type { BusinessStatsDao } from '../BusinessStatsDao.js';
import type { ChatDao } from '../ChatDao.js';
import type { CloudFunctionsDao } from '../CloudFunctionsDao.js';
import type { CustomerDao } from '../CustomerDao.js';
import type { GridStatsDao } from '../GridStatsDao.js';
import type { GridDao } from '../GridDao.js';
import type { GridTransferDao } from '../GridTransferDao.js';
import type { RoadmapDao } from '../RoadmapDao.js';
import type { SlugDao } from '../SlugDao.js';
import type { StorageDao } from '../StorageDao.js';
import type { UploadArchiveDao } from '../UploadArchiveDao.js';
import type { UpvoteDao } from '../UpvoteDao.js';
import type { UserDao } from '../UserDao.js';
import type { UserGameDataDao } from '../UserGameDataDao.js';

export interface DaoFactory {
  getBadgeDao: () => BadgeDao;
  getAnalyticsEventDao: () => AnalyticsEventDao;
  getBusinessStatsDao: () => BusinessStatsDao;
  getChatDao: () => ChatDao;
  getCloudFunctionsDao: () => CloudFunctionsDao;
  getCustomerDao: () => CustomerDao;
  getGridStatsDao: () => GridStatsDao;
  getGridDao: () => GridDao;
  getGridTransferDao: () => GridTransferDao;
  getRoadmapDao: () => RoadmapDao;
  getSlugDao: () => SlugDao;
  getStorageDao: () => StorageDao;
  getUploadArchiveDao: () => UploadArchiveDao;
  getUpvoteDao: () => UpvoteDao;
  getUserDao: () => UserDao;
  getUserGameDataDao: () => UserGameDataDao;
}
