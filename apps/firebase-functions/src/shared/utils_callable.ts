import { HttpsError } from "firebase-functions/v1/https";

type CallableContextWithAuth = {
  auth?: {
    uid?: string;
  } | null;
};

export function getCallableData<T extends Record<string, unknown>>(
  data: unknown,
): Partial<T> {
  return (data ?? {}) as Partial<T>;
}

export function requireAuth(
  context: CallableContextWithAuth,
  message: string,
): string {
  if (!context.auth?.uid) {
    throw new HttpsError("unauthenticated", message);
  }

  return context.auth.uid;
}

export function requireStringFields<const Field extends string>(
  data: unknown,
  fields: readonly Field[],
  message: string,
): Record<Field, string> {
  const payload = getCallableData<Record<Field, unknown>>(data);
  const values = {} as Record<Field, string>;

  for (const field of fields) {
    const value = payload[field];
    if (!value || typeof value !== "string") {
      throw new HttpsError("invalid-argument", message);
    }
    values[field] = value;
  }

  return values;
}
