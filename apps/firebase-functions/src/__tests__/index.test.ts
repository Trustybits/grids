import { beforeEach, describe, expect, it, vi } from "vitest";

const { exportsByModule, adminImportSpy } = vi.hoisted(() => {
  const adminImportSpy = vi.fn();
  const exportsByModule = {
    assignDefaultGridOnCreate: { functionName: "assignDefaultGridOnCreate" },
    checkSlugAvailability: { functionName: "checkSlugAvailability" },
    claimSlug: { functionName: "claimSlug" },
    updateDefaultGrid: { functionName: "updateDefaultGrid" },
    trackGridViewEndBeacon: { functionName: "trackGridViewEndBeacon" },
    onAnalyticsEventCreated: { functionName: "onAnalyticsEventCreated" },
    fetchNotionRoadmap: { functionName: "fetchNotionRoadmap" },
    listNotionDatabases: { functionName: "listNotionDatabases" },
    notionOAuthExchange: { functionName: "notionOAuthExchange" },
    upvoteRoadmapItem: { functionName: "upvoteRoadmapItem" },
    onGridCreated: { functionName: "onGridCreated" },
    onGridDeleted: { functionName: "onGridDeleted" },
    onGridUpdated: { functionName: "onGridUpdated" },
    onNewUserSignup: { functionName: "onNewUserSignup" },
    onUserLogin: { functionName: "onUserLogin" },
    getLinkPreview: { functionName: "getLinkPreview" },
    getMusicTrackMetadata: { functionName: "getMusicTrackMetadata" },
    getYouTubeMetadata: { functionName: "getYouTubeMetadata" },
    authorizeStorageUpload: { functionName: "authorizeStorageUpload" },
    deleteStorageUpload: { functionName: "deleteStorageUpload" },
    ensureDocumentItemThumbnail: { functionName: "ensureDocumentItemThumbnail" },
    getStorageUploadDownloadUrl: { functionName: "getStorageUploadDownloadUrl" },
    prepareGridDuplicateStorage: { functionName: "prepareGridDuplicateStorage" },
    setStorageUploadDisplayName: { functionName: "setStorageUploadDisplayName" },
    setStorageUploadShareable: { functionName: "setStorageUploadShareable" },
    generateThumbnail: { functionName: "generateThumbnail" },
    generateOgImage: { functionName: "generateOgImage" },
    onFileDeleted: { functionName: "onFileDeleted" },
    onFileUploaded: { functionName: "onFileUploaded" },
    onGridStorageReferencesCreated: { functionName: "onGridStorageReferencesCreated" },
    onGridStorageReferencesDeleted: { functionName: "onGridStorageReferencesDeleted" },
    onGridStorageReferencesUpdated: { functionName: "onGridStorageReferencesUpdated" },
    grantSupporterBadgeOnPayment: { functionName: "grantSupporterBadgeOnPayment" },
  };

  return { exportsByModule, adminImportSpy };
});

vi.mock("../admin.js", () => {
  adminImportSpy();
  return { default: { initialized: true } };
});

vi.mock("../accounts/onTrigger_gridCreated_assignDefaultGrid.js", () => ({
  assignDefaultGridOnCreate: exportsByModule.assignDefaultGridOnCreate,
}));
vi.mock("../accounts/onCall_checkSlugAvailability.js", () => ({
  checkSlugAvailability: exportsByModule.checkSlugAvailability,
}));
vi.mock("../accounts/onCall_claimSlug.js", () => ({
  claimSlug: exportsByModule.claimSlug,
}));
vi.mock("../accounts/onCall_updateDefaultGrid.js", () => ({
  updateDefaultGrid: exportsByModule.updateDefaultGrid,
}));
vi.mock("../analytics/onRequest_trackGridViewEndBeacon.js", () => ({
  trackGridViewEndBeacon: exportsByModule.trackGridViewEndBeacon,
}));
vi.mock("../analytics/onTrigger_analyticsEventCreated.js", () => ({
  onAnalyticsEventCreated: exportsByModule.onAnalyticsEventCreated,
}));
vi.mock("../integrations/onCall_fetchNotionRoadmap.js", () => ({
  fetchNotionRoadmap: exportsByModule.fetchNotionRoadmap,
}));
vi.mock("../integrations/onCall_listNotionDatabases.js", () => ({
  listNotionDatabases: exportsByModule.listNotionDatabases,
}));
vi.mock("../integrations/onCall_notionOAuthExchange.js", () => ({
  notionOAuthExchange: exportsByModule.notionOAuthExchange,
}));
vi.mock("../integrations/onCall_upvoteRoadmapItem.js", () => ({
  upvoteRoadmapItem: exportsByModule.upvoteRoadmapItem,
}));
vi.mock("../notifications/onTrigger_gridCreated.js", () => ({
  onGridCreated: exportsByModule.onGridCreated,
}));
vi.mock("../notifications/onTrigger_gridDeleted.js", () => ({
  onGridDeleted: exportsByModule.onGridDeleted,
}));
vi.mock("../notifications/onTrigger_gridUpdated.js", () => ({
  onGridUpdated: exportsByModule.onGridUpdated,
}));
vi.mock("../notifications/onTrigger_newUserSignup.js", () => ({
  onNewUserSignup: exportsByModule.onNewUserSignup,
}));
vi.mock("../notifications/onTrigger_userLogin.js", () => ({
  onUserLogin: exportsByModule.onUserLogin,
}));
vi.mock("../scraping/onCall_getLinkPreview.js", () => ({
  getLinkPreview: exportsByModule.getLinkPreview,
}));
vi.mock("../scraping/onCall_getMusicTrackMetadata.js", () => ({
  getMusicTrackMetadata: exportsByModule.getMusicTrackMetadata,
}));
vi.mock("../scraping/onCall_getYouTubeMetadata.js", () => ({
  getYouTubeMetadata: exportsByModule.getYouTubeMetadata,
}));
vi.mock("../storage/onCall_ensureDocumentItemThumbnail.js", () => ({
  ensureDocumentItemThumbnail: exportsByModule.ensureDocumentItemThumbnail,
}));
vi.mock("../storage/onCall_authorizeStorageUpload.js", () => ({
  authorizeStorageUpload: exportsByModule.authorizeStorageUpload,
}));
vi.mock("../storage/onCall_deleteStorageUpload.js", () => ({
  deleteStorageUpload: exportsByModule.deleteStorageUpload,
}));
vi.mock("../storage/onCall_getStorageUploadDownloadUrl.js", () => ({
  getStorageUploadDownloadUrl: exportsByModule.getStorageUploadDownloadUrl,
}));
vi.mock("../storage/onCall_prepareGridDuplicateStorage.js", () => ({
  prepareGridDuplicateStorage: exportsByModule.prepareGridDuplicateStorage,
}));
vi.mock("../storage/onCall_setStorageUploadDisplayName.js", () => ({
  setStorageUploadDisplayName: exportsByModule.setStorageUploadDisplayName,
}));
vi.mock("../storage/onCall_setStorageUploadShareable.js", () => ({
  setStorageUploadShareable: exportsByModule.setStorageUploadShareable,
}));
vi.mock("../storage/onRequest_generateBreakpointThumbnail.js", () => ({
  generateThumbnail: exportsByModule.generateThumbnail,
}));
vi.mock("../storage/onRequest_generateOgImage.js", () => ({
  generateOgImage: exportsByModule.generateOgImage,
}));
vi.mock("../storage/onTrigger_fileDeleted.js", () => ({
  onFileDeleted: exportsByModule.onFileDeleted,
}));
vi.mock("../storage/onTrigger_fileUploaded.js", () => ({
  onFileUploaded: exportsByModule.onFileUploaded,
}));
vi.mock("../storage/onTrigger_gridStorageReferences.js", () => ({
  onGridStorageReferencesCreated:
    exportsByModule.onGridStorageReferencesCreated,
  onGridStorageReferencesDeleted:
    exportsByModule.onGridStorageReferencesDeleted,
  onGridStorageReferencesUpdated:
    exportsByModule.onGridStorageReferencesUpdated,
}));
vi.mock("../badges/grantSupporterBadge.js", () => ({
  grantSupporterBadgeOnPayment: exportsByModule.grantSupporterBadgeOnPayment,
}));

beforeEach(() => {
  vi.resetModules();
  adminImportSpy.mockClear();
});

describe("functions export barrel", () => {
  it("imports the Admin bootstrap before exposing Cloud Function exports", async () => {
    await import("../index.js");

    expect(adminImportSpy).toHaveBeenCalledTimes(1);
  });

  it("re-exports the expected deploy surface", async () => {
    const module = await import("../index.js");

    expect(Object.keys(module).sort()).toEqual(Object.keys(exportsByModule).sort());
    for (const key of Object.keys(exportsByModule) as Array<keyof typeof exportsByModule>) {
      expect(module[key]).toBe(exportsByModule[key]);
    }
  });
});
