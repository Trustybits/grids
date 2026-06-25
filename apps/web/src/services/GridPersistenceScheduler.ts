import type { Grid } from "@grids/contracts/types";
import type {
  GridPersistenceScope,
  GridPersistenceSchedulerInterface,
} from "@/services/interfaces/GridPersistenceSchedulerInterface";

type WriteGridSnapshot = (snapshot: Grid) => Promise<void>;

interface FlushWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
  error: unknown | null;
}

interface PersistenceLane {
  inFlight: Promise<void> | null;
  pendingSnapshot: Grid | null;
  flushWaiters: FlushWaiter[];
  lastError: unknown | null;
}

function scopeKey(scope: GridPersistenceScope): string {
  return `${scope.gridId}:${scope.sessionGeneration}`;
}

function cloneSnapshot(snapshot: Grid): Grid {
  return JSON.parse(JSON.stringify(snapshot)) as Grid;
}

export class GridPersistenceScheduler implements GridPersistenceSchedulerInterface {
  private readonly lanes = new Map<string, PersistenceLane>();

  constructor(private readonly write: WriteGridSnapshot) {}

  schedule(scope: GridPersistenceScope, snapshot: Grid): void {
    const key = scopeKey(scope);
    const lane = this.getOrCreateLane(key);
    const scheduledSnapshot = cloneSnapshot(snapshot);

    if (lane.inFlight) {
      lane.pendingSnapshot = scheduledSnapshot;
      return;
    }

    lane.lastError = null;
    this.startWrite(key, lane, scheduledSnapshot);
  }

  flush(scope: GridPersistenceScope): Promise<void> {
    const key = scopeKey(scope);
    const lane = this.lanes.get(key);

    if (!lane) {
      return Promise.resolve();
    }

    if (!lane.inFlight && !lane.pendingSnapshot) {
      if (lane.lastError) {
        const error = lane.lastError;
        this.lanes.delete(key);
        return Promise.reject(error);
      }
      this.lanes.delete(key);
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      lane.flushWaiters.push({
        resolve,
        reject,
        error: lane.lastError,
      });
    });
  }

  private getOrCreateLane(key: string): PersistenceLane {
    const existing = this.lanes.get(key);
    if (existing) return existing;

    const lane: PersistenceLane = {
      inFlight: null,
      pendingSnapshot: null,
      flushWaiters: [],
      lastError: null,
    };
    this.lanes.set(key, lane);
    return lane;
  }

  private startWrite(key: string, lane: PersistenceLane, snapshot: Grid): void {
    let writePromise: Promise<void>;
    try {
      writePromise = this.write(snapshot);
    } catch (error) {
      writePromise = Promise.reject(error);
    }

    lane.inFlight = writePromise
      .then(() => {
        lane.lastError = null;
      })
      .catch((error: unknown) => {
        lane.lastError = error;
        for (const waiter of lane.flushWaiters) {
          waiter.error ??= error;
        }
      })
      .finally(() => {
        lane.inFlight = null;

        if (lane.pendingSnapshot) {
          const next = lane.pendingSnapshot;
          lane.pendingSnapshot = null;
          this.startWrite(key, lane, next);
          return;
        }

        this.settleFlushWaiters(lane);
        this.deleteDrainedSuccessfulLane(key, lane);
      });
  }

  private settleFlushWaiters(lane: PersistenceLane): void {
    const waiters = lane.flushWaiters.splice(0);
    for (const waiter of waiters) {
      if (waiter.error) {
        waiter.reject(waiter.error);
      } else {
        waiter.resolve();
      }
    }
  }

  private deleteDrainedSuccessfulLane(
    key: string,
    lane: PersistenceLane,
  ): void {
    if (
      !lane.inFlight &&
      !lane.pendingSnapshot &&
      lane.flushWaiters.length === 0 &&
      !lane.lastError
    ) {
      this.lanes.delete(key);
    }
  }
}
