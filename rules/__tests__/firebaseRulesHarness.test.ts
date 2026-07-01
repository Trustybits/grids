import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

describe("Firebase rules harness", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "grids-rules-phase-0",
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
        storageUsed: 0,
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
  });

  it("loads storage.rules and enforces current owner upload paths", async () => {
    const alice = testEnv.authenticatedContext("alice").storage();

    await assertSucceeds(
      uploadString(ref(alice, "users/alice/images/photo.png"), "image", "raw", {
        contentType: "image/png",
        customMetadata: { published: "true" },
      }),
    );
    await assertFails(
      uploadString(ref(alice, "users/bob/images/photo.png"), "image", "raw", {
        contentType: "image/png",
      }),
    );
    await assertFails(
      uploadString(ref(alice, "og-images/grid/grid-1.png"), "image", "raw", {
        contentType: "image/png",
      }),
    );
  });
});
