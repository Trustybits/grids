import admin from "../admin.js";
import { isDevTeamMember } from "./utils_devTeam.js";

export async function syncDevAccountFlagForUser(
  uid: string,
  email?: string | null,
): Promise<boolean> {
  const isDevAccount = isDevTeamMember(uid, email ?? undefined);
  await admin.firestore().collection("users").doc(uid).set(
    { isDevAccount },
    { merge: true },
  );
  return isDevAccount;
}
