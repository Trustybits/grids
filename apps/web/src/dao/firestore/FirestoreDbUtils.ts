import { serverTimestamp } from "firebase/firestore";
import type { DbUtils } from "@grids/contracts/dao";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export class FirestoreDbUtils implements DbUtils {
  sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const sanitized = this.sanitizeValue(item);
        return sanitized === undefined ? null : sanitized;
      });
    }

    if (isPlainObject(value)) {
      const entries = Object.entries(value)
        .map(([key, val]) => [key, this.sanitizeValue(val)] as const)
        .filter(([, val]) => val !== undefined);
      return Object.fromEntries(entries);
    }

    return value;
  }

  serverTimestamp(): unknown {
    return serverTimestamp();
  }
}
