import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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
