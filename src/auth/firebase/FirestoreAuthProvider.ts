import type { AuthProvider } from "@/auth/AuthProvider";
import { auth } from "@/firebase";

export class FirestoreAuthProvider implements AuthProvider {
  getCurrentUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  }
}
