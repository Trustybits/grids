import type { DbUtils } from "@grids/contracts/dao";

export class StubbedDbUtils implements DbUtils {
  sanitizeValue(value: unknown): unknown {
    return value;
  }

  serverTimestamp(): unknown {
    return new Date().toISOString();
  }
}
