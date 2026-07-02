import type { Grid } from "@grids/contracts/types";
import type {
  GridPersistenceScope,
  GridPersistenceSchedulerInterface,
} from "@/services/interfaces/GridPersistenceSchedulerInterface";

type WriteGridSnapshot = (snapshot: Grid) => Promise<Grid | void>;

interface FlushWaiter {
  resolve: (snapshot: Grid | null) => void;
  reject: (error: unknown) => void;
  error: unknown | null;
}

interface PersistenceLane {
  inFlight: Promise<void> | null;
  pendingSnapshot: Grid | null;
  flushWaiters: FlushWaiter[];
  lastError: unknown | null;
  lastSavedSnapshot: Grid | null;
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

  flush(scope: GridPersistenceScope): Promise<Grid | null> {
    const key = scopeKey(scope);
    const lane = this.lanes.get(key);

    if (!lane) {
      return Promise.resolve(null);
    }

    if (!lane.inFlight && !lane.pendingSnapshot) {
      if (lane.lastError) {
        const error = lane.lastError;
        this.lanes.delete(key);
        return Promise.reject(error);
      }
      const snapshot = lane.lastSavedSnapshot
        ? cloneSnapshot(lane.lastSavedSnapshot)
        : null;
      this.lanes.delete(key);
      return Promise.resolve(snapshot);
    }

    return new Promise<Grid | null>((resolve, reject) => {
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
      lastSavedSnapshot: null,
    };
    this.lanes.set(key, lane);
    return lane;
  }

  private startWrite(key: string, lane: PersistenceLane, snapshot: Grid): void {
    let writePromise: Promise<Grid | void>;
    try {
      writePromise = this.write(snapshot);
    } catch (error) {
      writePromise = Promise.reject(error);
    }

    lane.inFlight = writePromise
      .then((savedSnapshot) => {
        const resolvedSnapshot = savedSnapshot ?? snapshot;
        lane.lastError = null;
        lane.lastSavedSnapshot = cloneSnapshot(resolvedSnapshot);
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
          if (typeof lane.lastSavedSnapshot?.rev === "number") {
            next.rev = lane.lastSavedSnapshot.rev;
          }
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
        waiter.resolve(
          lane.lastSavedSnapshot ? cloneSnapshot(lane.lastSavedSnapshot) : null,
        );
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
