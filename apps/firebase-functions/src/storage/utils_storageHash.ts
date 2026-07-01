import { createHash } from "node:crypto";
import admin from "../admin.js";

export async function hashStorageObject(
  path: string,
  bucketName?: string,
): Promise<string> {
  const bucket = bucketName
    ? admin.storage().bucket(bucketName)
    : admin.storage().bucket();
  const stream = bucket.file(path).createReadStream();
  const hash = createHash("sha256");

  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}
