import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  ref,
  updateMetadata,
  uploadString,
} from "firebase/storage";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const STORAGE_QUOTA_BYTES = 5_368_709_120;

async function seedUser(
  testEnv: RulesTestEnvironment,
  userId: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${userId}`), data);
  });
}

async function seedGrid(
  testEnv: RulesTestEnvironment,
  gridId: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `grids/${gridId}`), data);
  });
}

async function seedTransfer(
  testEnv: RulesTestEnvironment,
  transferId: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `gridTransfers/${transferId}`), data);
  });
}

describe("Firebase rules harness", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "grids-one",
      firestore: {
        rules: readFileSync(resolve("firestore.rules"), "utf8"),
      },
      storage: {
        rules: readFileSync(resolve("storage.rules"), "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("loads firestore.rules and enforces current owner user-doc access", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(
      setDoc(doc(alice, "users/alice"), {
        displayName: "Alice",
      }),
    );
    await assertSucceeds(getDoc(doc(alice, "users/alice")));
    await assertFails(getDoc(doc(bob, "users/alice")));
    await assertFails(
      setDoc(doc(alice, "users/alice"), {
        displayName: "Alice",
        storageUsed: 10,
      }),
    );
    await assertFails(
      setDoc(doc(alice, "users/alice"), {
        displayName: "Alice",
        storageUsed: 0,
      }),
    );
    await assertFails(
      setDoc(doc(alice, "users/alice"), {
        displayName: "Alice",
        isDevAccount: true,
      }),
    );
    await assertFails(
      setDoc(doc(alice, "users/alice"), {
        displayName: "Alice",
        isDevAccount: false,
      }),
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/alice"), {
        displayName: "Alice",
        storageUsed: 0,
        isDevAccount: true,
      });
    });
    await assertFails(updateDoc(doc(alice, "users/alice"), { isDevAccount: false }));
  });

  it("allows owners to read upload archive docs but never write them", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const uploadPath = `users/alice/uploads/${"a".repeat(64)}`;

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), uploadPath), {
        hash: "a".repeat(64),
        status: "active",
      });
    });

    await assertSucceeds(getDoc(doc(alice, uploadPath)));
    await assertFails(getDoc(doc(bob, uploadPath)));
    await assertFails(
      setDoc(doc(alice, uploadPath), {
        hash: "a".repeat(64),
        status: "active",
      }),
    );
    await assertFails(
      updateDoc(doc(alice, uploadPath), {
        shareable: true,
      }),
    );
  });

  it("allows only transfer participants to read grid transfer docs and keeps writes server-only", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    const charlie = testEnv.authenticatedContext("charlie").firestore();
    const guest = testEnv.unauthenticatedContext().firestore();
    const transferPath = "gridTransfers/transfer-1";

    await seedTransfer(testEnv, "transfer-1", {
      id: "transfer-1",
      gridId: "grid-1",
      gridName: "Transferred Grid",
      fromUserId: "alice",
      toUserId: "bob",
      removeOrphanedFiles: false,
      status: "pending",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-15T00:00:00.000Z"),
    });

    await assertSucceeds(getDoc(doc(alice, transferPath)));
    await assertSucceeds(getDoc(doc(bob, transferPath)));
    await assertFails(getDoc(doc(charlie, transferPath)));
    await assertFails(getDoc(doc(guest, transferPath)));

    await assertFails(
      setDoc(doc(alice, "gridTransfers/client-created"), {
        id: "client-created",
        gridId: "grid-1",
        fromUserId: "alice",
        toUserId: "bob",
        status: "pending",
      }),
    );
    await assertFails(updateDoc(doc(alice, transferPath), { status: "cancelled" }));
    await assertFails(deleteDoc(doc(bob, transferPath)));
  });

  it("allows participant-scoped grid transfer queries and rejects unscoped transfer list reads", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    const guest = testEnv.unauthenticatedContext().firestore();

    await seedTransfer(testEnv, "incoming-for-bob", {
      id: "incoming-for-bob",
      gridId: "grid-1",
      gridName: "Incoming",
      fromUserId: "alice",
      toUserId: "bob",
      removeOrphanedFiles: false,
      status: "pending",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      expiresAt: new Date("2026-01-16T00:00:00.000Z"),
    });
    await seedTransfer(testEnv, "outgoing-from-bob", {
      id: "outgoing-from-bob",
      gridId: "grid-2",
      gridName: "Outgoing",
      fromUserId: "bob",
      toUserId: "carol",
      removeOrphanedFiles: true,
      status: "pending",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      expiresAt: new Date("2026-01-17T00:00:00.000Z"),
    });
    await seedTransfer(testEnv, "private-transfer", {
      id: "private-transfer",
      gridId: "grid-3",
      gridName: "Private",
      fromUserId: "charlie",
      toUserId: "dana",
      removeOrphanedFiles: false,
      status: "pending",
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
      updatedAt: new Date("2026-01-04T00:00:00.000Z"),
      expiresAt: new Date("2026-01-18T00:00:00.000Z"),
    });

    const incoming = await assertSucceeds(
      getDocs(
        query(
          collection(bob, "gridTransfers"),
          where("toUserId", "==", "bob"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        ),
      ),
    );
    expect(incoming.docs.map((snap) => snap.id)).toEqual(["incoming-for-bob"]);

    const outgoing = await assertSucceeds(
      getDocs(
        query(
          collection(bob, "gridTransfers"),
          where("fromUserId", "==", "bob"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        ),
      ),
    );
    expect(outgoing.docs.map((snap) => snap.id)).toEqual(["outgoing-from-bob"]);

    await assertFails(
      getDocs(
        query(
          collection(bob, "gridTransfers"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(bob, "gridTransfers"),
          where("toUserId", "==", "charlie"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        ),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(guest, "gridTransfers"),
          where("toUserId", "==", "bob"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        ),
      ),
    );
  });

  it("enforces grid rev on creates and content updates", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(
      setDoc(doc(alice, "grids/new-grid"), {
        userId: "alice",
        rev: 1,
        name: "New Grid",
        tiles: [],
      }),
    );
    await assertFails(
      setDoc(doc(alice, "grids/bad-initial-rev"), {
        userId: "alice",
        rev: 0,
        name: "Bad Grid",
        tiles: [],
      }),
    );

    await seedGrid(testEnv, "grid-1", {
      userId: "alice",
      rev: 3,
      name: "Saved",
      tiles: [],
    });

    await assertSucceeds(
      updateDoc(doc(alice, "grids/grid-1"), {
        rev: 4,
        name: "Fresh Save",
      }),
    );
    await assertFails(
      updateDoc(doc(alice, "grids/grid-1"), {
        rev: 4,
        name: "Stale Save",
      }),
    );
    await assertFails(
      updateDoc(doc(bob, "grids/grid-1"), {
        rev: 5,
        name: "Wrong Owner",
      }),
    );
  });

  it("treats missing stored grid rev as 0 for the first new-client update", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();

    await seedGrid(testEnv, "legacy-grid", {
      userId: "alice",
      name: "Legacy",
      tiles: [],
    });

    await assertSucceeds(
      updateDoc(doc(alice, "grids/legacy-grid"), {
        rev: 1,
        name: "Migrated by new client",
      }),
    );
    await assertFails(
      updateDoc(doc(alice, "grids/legacy-grid"), {
        rev: 1,
        name: "Repeated stale save",
      }),
    );
  });

  it("allows owner lastOpenedAt-only updates without a rev bump", async () => {
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();

    await seedGrid(testEnv, "recent-grid", {
      userId: "alice",
      rev: 7,
      name: "Recent",
      tiles: [],
      lastOpenedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await assertSucceeds(
      updateDoc(doc(alice, "grids/recent-grid"), {
        lastOpenedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
    );
    await assertFails(
      updateDoc(doc(alice, "grids/recent-grid"), {
        lastOpenedAt: new Date("2026-01-03T00:00:00.000Z"),
        name: "Not recency only",
      }),
    );
    await assertFails(
      updateDoc(doc(bob, "grids/recent-grid"), {
        lastOpenedAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
    );
  });

  it("accepts canonical owner uploads within quota", async () => {
    const alice = testEnv.authenticatedContext("alice").storage();
    await seedUser(testEnv, "alice", {
      storageUsed: 0,
      isDevAccount: false,
    });

    await assertSucceeds(
      uploadString(ref(alice, `users/alice/images/${HASH}.png`), "image", "raw", {
        contentType: "image/png",
        customMetadata: { published: "true" },
      }),
    );
  });

  it("rejects original-filename uploads under archive-owned folders", async () => {
    const alice = testEnv.authenticatedContext("alice").storage();
    await seedUser(testEnv, "alice", {
      storageUsed: 0,
      isDevAccount: false,
    });

    await assertFails(
      uploadString(ref(alice, "users/alice/images/photo.png"), "image", "raw", {
        contentType: "image/png",
      }),
    );
  });

  it("rejects uploads to another user's archive path", async () => {
    const alice = testEnv.authenticatedContext("alice").storage();
    await seedUser(testEnv, "bob", {
      storageUsed: 0,
      isDevAccount: false,
    });

    await assertFails(
      uploadString(ref(alice, `users/bob/images/${HASH}.png`), "image", "raw", {
        contentType: "image/png",
      }),
    );
  });

  it("rejects over-quota non-dev uploads and allows dev-account uploads", async () => {
    const alice = testEnv.authenticatedContext("alice").storage();

    await seedUser(testEnv, "alice", {
      storageUsed: STORAGE_QUOTA_BYTES + 1,
      isDevAccount: false,
    });
    await assertFails(
      uploadString(ref(alice, `users/alice/videos/${HASH}.mp4`), "video", "raw", {
        contentType: "video/mp4",
      }),
    );

    await seedUser(testEnv, "alice", {
      storageUsed: STORAGE_QUOTA_BYTES + 1,
      isDevAccount: true,
    });
    await assertSucceeds(
      uploadString(
        ref(alice, `users/alice/videos/${OTHER_HASH}.mp4`),
        "video",
        "raw",
        {
          contentType: "video/mp4",
        },
      ),
    );
  });

  it("rejects direct update and delete of archive-owned objects", async () => {
    const alice = testEnv.authenticatedContext("alice").storage();
    const fileRef = ref(alice, `users/alice/documents/${HASH}.pdf`);
    await seedUser(testEnv, "alice", {
      storageUsed: 0,
      isDevAccount: false,
    });

    await assertSucceeds(
      uploadString(fileRef, "document", "raw", {
        contentType: "application/pdf",
      }),
    );
    await assertFails(
      updateMetadata(fileRef, {
        customMetadata: { published: "true" },
      }),
    );
    await assertFails(deleteObject(fileRef));
  });

  it("keeps fixed-location OG images server-only", async () => {
    const alice = testEnv.authenticatedContext("alice").storage();

    await assertFails(
      uploadString(ref(alice, "og-images/grid/grid-1.png"), "image", "raw", {
        contentType: "image/png",
      }),
    );
  });
});
