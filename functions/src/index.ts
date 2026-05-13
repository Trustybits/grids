import "./admin";

// accounts

export { checkSlugAvailability } from "./accounts/onCall_checkSlugAvailability";
export { claimSlug } from "./accounts/onCall_claimSlug";
export { updateDefaultGrid } from "./accounts/onCall_updateDefaultGrid";

// analytics

export { trackGridViewEndBeacon } from "./analytics/onRequest_trackGridViewEndBeacon";
export { onAnalyticsEventCreated } from "./analytics/onTrigger_analyticsEventCreated";

// integrations

export { fetchNotionRoadmap } from "./integrations/onCall_fetchNotionRoadmap";
export { listNotionDatabases } from "./integrations/onCall_listNotionDatabases";
export { notionOAuthExchange } from "./integrations/onCall_notionOAuthExchange";
export { upvoteRoadmapItem } from "./integrations/onCall_upvoteRoadmapItem";

// notifications

export { onGridCreated } from "./notifications/onTrigger_gridCreated";
export { onGridDeleted } from "./notifications/onTrigger_gridDeleted";
export { onGridUpdated } from "./notifications/onTrigger_gridUpdated";
export { onNewUserSignup } from "./notifications/onTrigger_newUserSignup";
export { onUserLogin } from "./notifications/onTrigger_userLogin";

// scraping

export { getLinkPreview } from "./scraping/onCall_getLinkPreview";
export { getMusicTrackMetadata } from "./scraping/onCall_getMusicTrackMetadata";
export { getYouTubeMetadata } from "./scraping/onCall_getYouTubeMetadata";

// storage

export { ensureDocumentItemThumbnail } from "./storage/onCall_ensureDocumentItemThumbnail";
export { generateThumbnail } from "./storage/onRequest_generateBreakpointThumbnail";
export { generateOgImage } from "./storage/onRequest_generateOgImage";
export { onFileDeleted } from "./storage/onTrigger_fileDeleted";
export { onFileUploaded } from "./storage/onTrigger_fileUploaded";
