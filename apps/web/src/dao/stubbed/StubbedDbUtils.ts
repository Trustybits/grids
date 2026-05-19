import type { DbUtils } from "../interfaces/DbUtils";

export class StubbedDbUtils implements DbUtils {
  sanitizeValue(value: unknown): unknown {
    return value;
  }

  serverTimestamp(): unknown {
    return new Date().toISOString();
  }
}
