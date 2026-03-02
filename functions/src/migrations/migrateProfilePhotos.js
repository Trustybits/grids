/**
 * Migration: move profilePhotoUrl to publicProfiles/{uid} only
 *
 * Steps:
 *   1. Scan layouts for profile tiles with avatarSrc (legacy data)
 *   2. Collect profilePhotoUrl from users/{uid} docs (if exists)
 *   3. Write to publicProfiles/{uid} (single source of truth)
 *   4. Remove profilePhotoUrl from users/{uid} docs
 *   5. Remove profilePhotoUrl from slugs/{slug} docs
 *
 * Safe to re-run.
 *
 * Run in Firebase Cloud Shell:
 *   node migrateProfilePhotos.js
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrateProfilePhotos() {
  console.log("Starting profile photo migration to publicProfiles...");

  // --- Step 1: Scan layouts for legacy avatarSrc on profile tiles ---
  const layoutsSnap = await db.collection("layouts").get();
  console.log(`Scanning ${layoutsSnap.size} layouts for legacy avatarSrc...`);

  const tilePhotoMap = new Map(); // uid → avatarSrc from tile data
  for (const layoutDoc of layoutsSnap.docs) {
    const data = layoutDoc.data();
    if (!data.userId || tilePhotoMap.has(data.userId)) continue;
    for (const tile of (data.tiles || [])) {
      const c = tile && tile.content;
      if (c && c.type === "profile" && typeof c.avatarSrc === "string" && c.avatarSrc.trim()) {
        tilePhotoMap.set(data.userId, c.avatarSrc.trim());
        break;
      }
    }
  }
  console.log(`Found legacy tile avatarSrc for ${tilePhotoMap.size} user(s).`);

  // --- Step 2 & 3: Move to publicProfiles/{uid} ---
  const usersSnap = await db.collection("users").get();
  let publicUpdated = 0;
  let usersCleaned = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const userData = userDoc.data();

    // Determine photo URL: prefer users doc, fall back to tile data
    let photoUrl = userData.profilePhotoUrl || tilePhotoMap.get(uid);
    
    if (photoUrl) {
      // Write to publicProfiles
      await db.collection("publicProfiles").doc(uid).set({ profilePhotoUrl: photoUrl }, { merge: true });
      console.log(`  SET   publicProfiles/${uid} → ${photoUrl.substring(0, 60)}`);
      publicUpdated++;
    }

    // Remove from users doc if it exists there
    if (userData.profilePhotoUrl !== undefined) {
      await db.collection("users").doc(uid).update({
        profilePhotoUrl: admin.firestore.FieldValue.delete()
      });
      console.log(`  CLEANED users/${uid}.profilePhotoUrl`);
      usersCleaned++;
    }
  }

  console.log(`\nMigrated ${publicUpdated} photo(s) to publicProfiles.`);
  console.log(`Cleaned profilePhotoUrl from ${usersCleaned} users doc(s).`);

  // --- Step 4: Remove profilePhotoUrl from slugs docs ---
  console.log("\nCleaning up profilePhotoUrl from slugs docs...");
  const slugsSnap = await db.collection("slugs").get();
  let slugsCleaned = 0;
  for (const slugDoc of slugsSnap.docs) {
    if (slugDoc.data().profilePhotoUrl !== undefined) {
      await db.collection("slugs").doc(slugDoc.id).update({
        profilePhotoUrl: admin.firestore.FieldValue.delete()
      });
      console.log(`  CLEANED slugs/${slugDoc.id}`);
      slugsCleaned++;
    }
  }
  console.log(`Cleaned profilePhotoUrl from ${slugsCleaned} slugs doc(s).`);

  console.log("\n✓ Migration complete. profilePhotoUrl now lives only in publicProfiles/{uid}.");
}

migrateProfilePhotos().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
