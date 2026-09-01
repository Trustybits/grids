import type { DbUtils } from "@grids/contracts/dao";
import {
  STUBBED_DELETE_FIELD,
  sanitizeStubbedValue,
} from "./StubbedMemoryDatabase";

export class StubbedDbUtils implements DbUtils {
  sanitizeValue(value: unknown): unknown {
    return sanitizeStubbedValue(value);
  }

  serverTimestamp(): unknown {
    return new Date();
  }

  deleteField(): unknown {
    return STUBBED_DELETE_FIELD;
  }
}
