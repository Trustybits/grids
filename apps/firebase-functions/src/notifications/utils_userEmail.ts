import * as logger from "firebase-functions/logger";
import admin from "../admin.js";

export type UserEmailInfo = {
  email: string;
  displayName: string | null;
};

export async function getUserEmailInfo(
  uid: string,
): Promise<UserEmailInfo | null> {
  try {
    const userRecord = await admin.auth().getUser(uid);
    if (!userRecord.email) {
      logger.info("User has no email address, skipping user email", { uid });
      return null;
    }

    return {
      email: userRecord.email,
      displayName: userRecord.displayName ?? null,
    };
  } catch (error) {
    logger.error("Failed to load user email for notification", {
      uid,
      error: String(error),
    });
    return null;
  }
}
