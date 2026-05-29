import type { AuthProvider } from "@grids/contracts/auth";

let instance: AuthProvider | null = null;

export function registerAuthProvider(provider: AuthProvider) {
  instance = provider;
}

export function getAuthProvider(): AuthProvider {
  if (!instance) {
    throw new Error(
      "AuthProvider has not been registered. Call registerAuthProvider() at app startup.",
    );
  }

  return instance;
}
