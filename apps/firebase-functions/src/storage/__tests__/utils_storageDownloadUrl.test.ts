import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildStorageDownloadUrl,
  storageDownloadOrigin,
} from "../utils_storageDownloadUrl.js";

const PATH = "users/u1/images/abc.png";
const ENCODED = encodeURIComponent(PATH);

describe("utils_storageDownloadUrl", () => {
  let prevStorage: string | undefined;
  let prevFirebase: string | undefined;

  beforeEach(() => {
    prevStorage = process.env.STORAGE_EMULATOR_HOST;
    prevFirebase = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    delete process.env.STORAGE_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  });

  afterEach(() => {
    if (prevStorage === undefined) delete process.env.STORAGE_EMULATOR_HOST;
    else process.env.STORAGE_EMULATOR_HOST = prevStorage;
    if (prevFirebase === undefined)
      delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    else process.env.FIREBASE_STORAGE_EMULATOR_HOST = prevFirebase;
  });

  it("defaults to the production GCS origin", () => {
    expect(storageDownloadOrigin()).toBe(
      "https://firebasestorage.googleapis.com",
    );
  });

  it("uses the emulator host (adding http://) when configured", () => {
    process.env.STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    expect(storageDownloadOrigin()).toBe("http://127.0.0.1:9199");
  });

  it("respects an emulator host that already carries a scheme", () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "http://localhost:9199";
    expect(storageDownloadOrigin()).toBe("http://localhost:9199");
  });

  it("builds an encoded media URL without a token", () => {
    expect(buildStorageDownloadUrl("bucket-x", PATH)).toBe(
      `https://firebasestorage.googleapis.com/v0/b/bucket-x/o/${ENCODED}?alt=media`,
    );
  });

  it("appends an encoded token when provided", () => {
    expect(buildStorageDownloadUrl("bucket-x", PATH, "tok en")).toBe(
      `https://firebasestorage.googleapis.com/v0/b/bucket-x/o/${ENCODED}?alt=media&token=tok%20en`,
    );
  });

  it("points a token URL at the emulator host when configured", () => {
    process.env.STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    expect(buildStorageDownloadUrl("bucket-x", PATH, "t1")).toBe(
      `http://127.0.0.1:9199/v0/b/bucket-x/o/${ENCODED}?alt=media&token=t1`,
    );
  });
});
