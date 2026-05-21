import * as logger from "firebase-functions/logger";

interface MaintenanceResponse {
  status(code: number): {
    json(body: unknown): unknown;
  };
}

const MAINTENANCE_MODE_VALUE = "true";

export function noopIfMaintenance(functionName: string): boolean {
  if (process.env.MAINTENANCE_MODE !== MAINTENANCE_MODE_VALUE) {
    return false;
  }

  logger.warn("Function skipped because MAINTENANCE_MODE is enabled", {
    functionName,
  });
  return true;
}

export function respondWithMaintenanceIfEnabled(
  functionName: string,
  res: MaintenanceResponse,
): boolean {
  if (!noopIfMaintenance(functionName)) {
    return false;
  }

  res.status(503).json({
    error: "Service temporarily unavailable for maintenance.",
  });
  return true;
}
