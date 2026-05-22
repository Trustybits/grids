import * as logger from "firebase-functions/logger";
import { isDevTeamMember } from "./utils_devTeam.js";

type DevTeamNotificationSkipOptions = {
  userId?: string;
  email?: string;
  lookupUserEmail?: boolean;
  logContext: Record<string, unknown>;
};

async function lookupUserEmail(userId: string | undefined): Promise<string | undefined> {
  if (!userId) return undefined;

  try {
    const { default: admin } = await import("../admin.js");
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();
    return userDoc.data()?.email;
  } catch {
    return undefined;
  }
}

export async function shouldSkipDevTeamNotification({
  userId,
  email,
  lookupUserEmail: shouldLookupUserEmail = false,
  logContext,
}: DevTeamNotificationSkipOptions): Promise<boolean> {
  const resolvedEmail =
    email ?? (shouldLookupUserEmail ? await lookupUserEmail(userId) : undefined);

  if (!isDevTeamMember(userId, resolvedEmail)) {
    return false;
  }

  logger.info("Skipping Discord notification for dev team member", logContext);
  return true;
}
