import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import {
  noopIfMaintenance,
  respondWithMaintenanceIfEnabled,
} from "../maintenance.js";

vi.mock("firebase-functions/logger", () => ({
  warn: vi.fn(),
}));

const originalMaintenanceMode = process.env.MAINTENANCE_MODE;

function restoreMaintenanceMode(): void {
  if (originalMaintenanceMode === undefined) {
    delete process.env.MAINTENANCE_MODE;
    return;
  }

  process.env.MAINTENANCE_MODE = originalMaintenanceMode;
}

function setMaintenanceMode(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.MAINTENANCE_MODE;
    return;
  }

  process.env.MAINTENANCE_MODE = value;
}

function createResponse() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));

  return {
    res: { status },
    status,
    json,
  };
}

describe("noopIfMaintenance", () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });

  afterEach(() => {
    restoreMaintenanceMode();
  });

  it.each([
    ["unset", undefined],
    ["false", "false"],
    ["uppercase TRUE", "TRUE"],
    ["truthy non-matching value", "1"],
    ["true with surrounding whitespace", " true "],
    ["empty string", ""],
  ])("returns false and does not log when MAINTENANCE_MODE is %s", (_label, value) => {
    setMaintenanceMode(value);

    expect(noopIfMaintenance("trackGridViewEndBeacon")).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("returns true and logs function context when MAINTENANCE_MODE is exactly true", () => {
    setMaintenanceMode("true");

    expect(noopIfMaintenance("generateOgImage")).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "Function skipped because MAINTENANCE_MODE is enabled",
      { functionName: "generateOgImage" },
    );
  });
});

describe("respondWithMaintenanceIfEnabled", () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });

  afterEach(() => {
    restoreMaintenanceMode();
  });

  it("returns false and leaves the response untouched when maintenance mode is disabled", () => {
    setMaintenanceMode(undefined);
    const { res, status, json } = createResponse();

    expect(respondWithMaintenanceIfEnabled("getLinkPreview", res)).toBe(false);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("returns true, logs, and sends a 503 JSON response when maintenance mode is enabled", () => {
    setMaintenanceMode("true");
    const { res, status, json } = createResponse();

    expect(respondWithMaintenanceIfEnabled("getLinkPreview", res)).toBe(true);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith({
      error: "Service temporarily unavailable for maintenance.",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "Function skipped because MAINTENANCE_MODE is enabled",
      { functionName: "getLinkPreview" },
    );
  });
});
