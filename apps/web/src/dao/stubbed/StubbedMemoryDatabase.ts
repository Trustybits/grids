import type {
  AnalyticsEvent,
  BusinessStats,
  ChatMessage,
  DailyBusinessStats,
  DailyGridStats,
  Grid,
  GridTransfer,
  GridStats,
  LeaderboardEntry,
  UserBadges,
  UserGameData,
} from "@grids/contracts/types";
import type { StorageUploadMetadata } from "@grids/contracts/dao";

export const STUBBED_USER_ID = "stubbed-user-id";

export type StoredFile = {
  data: Blob | File;
  metadata?: StorageUploadMetadata;
  url: string;
};

type Subscription = {
  callback: (value: unknown) => void;
  getValue: () => unknown;
};

let idCounter = 0;

export const memoryDatabase = {
  analyticsEvents: [] as AnalyticsEvent[],
  badges: new Map<string, UserBadges>(),
  businessDailyStats: new Map<string, DailyBusinessStats>(),
  businessStats: null as BusinessStats | null,
  checkoutSessions: new Map<string, Record<string, unknown>>(),
  gridDailyStats: new Map<string, DailyGridStats>(),
  gridStats: new Map<string, GridStats>(),
  gridTransfers: new Map<string, GridTransfer>(),
  grids: new Map<string, Grid>(),
  messages: new Map<string, ChatMessage[]>(),
  payments: new Map<string, Array<Record<string, unknown>>>(),
  slugs: new Map<string, Record<string, unknown>>(),
  storageByPath: new Map<string, StoredFile>(),
  storagePathByUrl: new Map<string, string>(),
  subscriptions: new Map<string, Array<Record<string, unknown>>>(),
  upvotes: new Map<string, Set<string>>(),
  userGameData: new Map<string, UserGameData>(),
  users: new Map<string, Record<string, unknown>>(),
};

const listeners = new Map<string, Set<Subscription>>();

export function createId(prefix = "stub"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function sanitizeStubbedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const sanitized = sanitizeStubbedValue(item);
      return sanitized === undefined ? null : sanitized;
    });
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, val]) => [key, sanitizeStubbedValue(val)] as const)
      .filter(([, val]) => val !== undefined);
    return Object.fromEntries(entries);
  }

  return value;
}

export function mergeRecord(
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(existing ? cloneValue(existing) : {}),
    ...(sanitizeStubbedValue(patch) as Record<string, unknown>),
  };
}

export function channel(...parts: string[]): string {
  return parts.join(":");
}

export function subscribeToValue<T>(
  channelName: string,
  getValue: () => T,
  callback: (value: T) => void,
): () => void {
  const subscription: Subscription = {
    callback: callback as (value: unknown) => void,
    getValue,
  };
  let set = listeners.get(channelName);
  if (!set) {
    set = new Set();
    listeners.set(channelName, set);
  }
  set.add(subscription);
  emitOne(channelName, subscription);
  return () => {
    set?.delete(subscription);
    if (set?.size === 0) listeners.delete(channelName);
  };
}

export function emit(channelName: string): void {
  const set = listeners.get(channelName);
  if (!set) return;
  for (const subscription of set) {
    emitOne(channelName, subscription);
  }
}

function emitOne(channelName: string, subscription: Subscription): void {
  const run = () => {
    const set = listeners.get(channelName);
    if (!set?.has(subscription)) return;
    subscription.callback(cloneValue(subscription.getValue()));
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(run);
  } else {
    setTimeout(run, 0);
  }
}

export function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function toGrid(id: string, data: Record<string, unknown>): Grid {
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    rev: typeof data.rev === "number" ? data.rev : 0,
    name: typeof data.name === "string" ? data.name : "Untitled",
    colNum: typeof data.colNum === "number" ? data.colNum : 12,
    verticalCompact:
      typeof data.verticalCompact === "boolean" ? data.verticalCompact : true,
    backgroundImageSrc:
      typeof data.backgroundImageSrc === "string"
        ? data.backgroundImageSrc
        : "",
    backgroundImageHash:
      typeof data.backgroundImageHash === "string"
        ? data.backgroundImageHash
        : undefined,
    backgroundEmbed:
      typeof data.backgroundEmbed === "boolean" ? data.backgroundEmbed : false,
    backgroundColor:
      typeof data.backgroundColor === "string" ? data.backgroundColor : "",
    ogImageSrc: typeof data.ogImageSrc === "string" ? data.ogImageSrc : "",
    themeId: typeof data.themeId === "string" ? data.themeId : undefined,
    tiles: Array.isArray(data.tiles) ? cloneValue(data.tiles) : [],
    overrides: isPlainObject(data.overrides)
      ? cloneValue(data.overrides as Grid["overrides"])
      : undefined,
    duplicatable:
      typeof data.duplicatable === "boolean" ? data.duplicatable : false,
    createdAt: (data.createdAt as Grid["createdAt"]) ?? null,
    updatedAt: (data.updatedAt as Grid["updatedAt"]) ?? null,
    lastOpenedAt: (data.lastOpenedAt as Grid["lastOpenedAt"]) ?? null,
  };
}

export function leaderboardEntries(topN: number): LeaderboardEntry[] {
  return Array.from(memoryDatabase.userGameData.values())
    .map((data) => ({
      userId: data.userId,
      displayName: data.displayName,
      totalClicks: data.totalClicks,
    }))
    .sort((a, b) => b.totalClicks - a.totalClicks)
    .slice(0, topN);
}
