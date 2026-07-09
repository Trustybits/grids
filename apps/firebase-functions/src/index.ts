import "./admin.js";

// accounts

export { assignDefaultGridOnCreate } from "./accounts/onTrigger_gridCreated_assignDefaultGrid.js";
export { checkSlugAvailability } from "./accounts/onCall_checkSlugAvailability.js";
export { claimSlug } from "./accounts/onCall_claimSlug.js";
export { updateDefaultGrid } from "./accounts/onCall_updateDefaultGrid.js";

// analytics

export { trackGridViewEndBeacon } from "./analytics/onRequest_trackGridViewEndBeacon.js";
export { onAnalyticsEventCreated } from "./analytics/onTrigger_analyticsEventCreated.js";

// grids

export { cleanupGridSubcollectionsOnDelete } from "./grids/onTrigger_gridDeleted_cleanupSubcollections.js";
export { sweepOrphanedSubcollections } from "./grids/onSchedule_sweepOrphanedSubcollections.js";

// transfers

export { acceptGridTransfer } from "./transfers/onCall_acceptGridTransfer.js";
export { cancelGridTransfer } from "./transfers/onCall_cancelGridTransfer.js";
export { createGridTransfer } from "./transfers/onCall_createGridTransfer.js";
export { declineGridTransfer } from "./transfers/onCall_declineGridTransfer.js";
export { previewGridTransferAcceptance } from "./transfers/onCall_previewGridTransferAcceptance.js";
export { sweepExpiredGridTransfers } from "./transfers/onSchedule_sweepExpiredGridTransfers.js";

// integrations

export { fetchNotionRoadmap } from "./integrations/onCall_fetchNotionRoadmap.js";
export { listNotionDatabases } from "./integrations/onCall_listNotionDatabases.js";
export { notionOAuthExchange } from "./integrations/onCall_notionOAuthExchange.js";
export { upvoteRoadmapItem } from "./integrations/onCall_upvoteRoadmapItem.js";

// notifications

export { onGridCreated } from "./notifications/onTrigger_gridCreated.js";
export { onGridDeleted } from "./notifications/onTrigger_gridDeleted.js";
export { onGridUpdated } from "./notifications/onTrigger_gridUpdated.js";
export { onNewUserSignup } from "./notifications/onTrigger_newUserSignup.js";
export { onUserLogin } from "./notifications/onTrigger_userLogin.js";

// scraping

export { getLinkPreview } from "./scraping/onCall_getLinkPreview.js";
export { getMusicTrackMetadata } from "./scraping/onCall_getMusicTrackMetadata.js";
export { getYouTubeMetadata } from "./scraping/onCall_getYouTubeMetadata.js";

// storage

export { authorizeStorageUpload } from "./storage/onCall_authorizeStorageUpload.js";
export { deleteStorageUpload } from "./storage/onCall_deleteStorageUpload.js";
export { ensureDocumentItemThumbnail } from "./storage/onCall_ensureDocumentItemThumbnail.js";
export { getStorageUploadDownloadUrl } from "./storage/onCall_getStorageUploadDownloadUrl.js";
export { prepareGridDuplicateStorage } from "./storage/onCall_prepareGridDuplicateStorage.js";
export { setStorageUploadDisplayName } from "./storage/onCall_setStorageUploadDisplayName.js";
export { setStorageUploadShareable } from "./storage/onCall_setStorageUploadShareable.js";
export { generateThumbnail } from "./storage/onRequest_generateBreakpointThumbnail.js";
export { generateOgImage } from "./storage/onRequest_generateOgImage.js";
export { onFileDeleted } from "./storage/onTrigger_fileDeleted.js";
export { onFileUploaded } from "./storage/onTrigger_fileUploaded.js";
export {
  onGridStorageReferencesCreated,
  onGridStorageReferencesDeleted,
  onGridStorageReferencesUpdated,
} from "./storage/onTrigger_gridStorageReferences.js";

// badges

export { grantSupporterBadgeOnPayment } from "./badges/grantSupporterBadge.js";
