/**
 * One-time migration: copy avatarSrc from profile tiles → users/{uid}.profilePhotoUrl
 *
 * For each layout in Firestore:
 *   1. Find any tile with content.type === "profile" and a non-empty content.avatarSrc
 *   2. If the owning user does NOT already have a profilePhotoUrl set, write it now
 *
 * Safe to re-run — will never overwrite an existing profilePhotoUrl.
 *
 * Usage (from the functions/ directory):
 *
 *   npm run build
 *   node lib/migrations/migrateProfilePhotos.js
 *
 * Or use the convenience script added to package.json:
 *   npm run migrate:profile-photos
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key JSON file.
 * Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key.
 */

import * as admin from "firebase-admin";

// Only initialize if not already done (safe for standalone runs)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrateProfilePhotos(): Promise<void> {
  console.log("Starting profile photo migration...");

  const layoutsSnap = await db.collection("layouts").get();
  console.log(`Found ${layoutsSnap.size} layouts to scan.`);

  // uid → avatarSrc  (first non-empty one wins)
  const photoMap: Map<string, string> = new Map();

  for (const layoutDoc of layoutsSnap.docs) {
    const data = layoutDoc.data();
    const userId: string = data.userId;
    if (!userId) continue;

    // Skip if we already found a photo for this user
    if (photoMap.has(userId)) continue;

    const tiles: any[] = Array.isArray(data.tiles) ? data.tiles : [];
    for (const tile of tiles) {
      const content = tile?.content;
      if (
        content?.type === "profile" &&
        typeof content.avatarSrc === "string" &&
        content.avatarSrc.trim() !== ""
      ) {
        photoMap.set(userId, content.avatarSrc.trim());
        break;
      }
    }
  }

  console.log(`Found profile photos for ${photoMap.size} user(s). Checking which need migration...`);

  let updated = 0;
  let skipped = 0;

  for (const [uid, avatarSrc] of photoMap.entries()) {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (userSnap.exists && userSnap.data()?.profilePhotoUrl) {
      console.log(`  SKIP  ${uid} — profilePhotoUrl already set`);
      skipped++;
      continue;
    }

    await userRef.set({ profilePhotoUrl: avatarSrc }, { merge: true });
    console.log(`  SET   ${uid} → ${avatarSrc.substring(0, 80)}...`);
    updated++;
  }

  console.log(`\nMigration complete. Updated: ${updated}, Skipped: ${skipped}`);
}

migrateProfilePhotos().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
