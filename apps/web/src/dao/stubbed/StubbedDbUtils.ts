import type { DbUtils } from "@grids/contracts/dao";
import { sanitizeStubbedValue } from "./StubbedMemoryDatabase";

export class StubbedDbUtils implements DbUtils {
  sanitizeValue(value: unknown): unknown {
    return sanitizeStubbedValue(value);
  }

  serverTimestamp(): unknown {
    return new Date();
  }
}
