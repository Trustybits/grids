import type { AuthProvider } from "@/auth/AuthProvider";

export class StubbedAuthProvider implements AuthProvider {
  getCurrentUserId(): string | null {
    return "stubbed-user-id";
  }
}
