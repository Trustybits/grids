import "./admin.js";

// accounts

export { assignDefaultGridOnCreate } from "./accounts/onTrigger_gridCreated_assignDefaultGrid.js";
export { checkSlugAvailability } from "./accounts/onCall_checkSlugAvailability.js";
export { claimSlug } from "./accounts/onCall_claimSlug.js";
export { updateDefaultGrid } from "./accounts/onCall_updateDefaultGrid.js";

// analytics

export { trackGridViewEndBeacon } from "./analytics/onRequest_trackGridViewEndBeacon.js";
export { onAnalyticsEventCreated } from "./analytics/onTrigger_analyticsEventCreated.js";

// integrations

export { fetchNotionRoadmap } from "./integrations/onCall_fetchNotionRoadmap.js";
export { listNotionDatabases } from "./integrations/onCall_listNotionDatabases.js";
export { notionOAuthExchange } from "./integrations/onCall_notionOAuthExchange.js";
export { upvoteRoadmapItem } from "./integrations/onCall_upvoteRoadmapItem.js";

// notifications

export { onGridCreated } from "./notifications/onTrigger_gridCreated.js";
export { onGridDeleted } from "./notifications/onTrigger_gridDeleted.js";
export { onGridUpdated } from "./notifications/onTrigger_gridUpdated.js";
export { onRecordFirstGridEdit } from "./notifications/onTrigger_recordFirstGridEdit.js";
export { onSendGridEngagementEmails } from "./notifications/onTrigger_sendGridEngagementEmails.js";
export { onNewUserSignup } from "./notifications/onTrigger_newUserSignup.js";
export { onUserLogin } from "./notifications/onTrigger_userLogin.js";

// scraping

export { getLinkPreview } from "./scraping/onCall_getLinkPreview.js";
export { getMusicTrackMetadata } from "./scraping/onCall_getMusicTrackMetadata.js";
export { getYouTubeMetadata } from "./scraping/onCall_getYouTubeMetadata.js";

// storage

export { ensureDocumentItemThumbnail } from "./storage/onCall_ensureDocumentItemThumbnail.js";
export { generateThumbnail } from "./storage/onRequest_generateBreakpointThumbnail.js";
export { generateOgImage } from "./storage/onRequest_generateOgImage.js";
export { onFileDeleted } from "./storage/onTrigger_fileDeleted.js";
export { onFileUploaded } from "./storage/onTrigger_fileUploaded.js";

// badges

export { grantSupporterBadgeOnPayment } from "./badges/grantSupporterBadge.js";
