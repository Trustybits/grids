import { describe, expect, it } from "vitest";
import type { firestore } from "firebase-admin";
import {
  EMAIL_RECOVERY_CODES_COLLECTION,
  EMAIL_RECOVERY_REQUESTS_COLLECTION,
  RecoveryCodeRejectedError,
  consumeRecoveryCode,
  formatRecoveryCode,
  generateRecoveryCode,
  hasRecentPendingRequest,
  hashRecoveryCode,
  issueRecoveryCode,
  normalizeEmail,
  normalizeRecoveryCode,
  normalizeText,
  recoveryDedupeKey,
  releaseRecoveryCode,
  revokeRecoveryCodes,
} from "../utils_emailRecovery.js";

// ── Minimal in-memory Firestore ────────────────────────────────────────────

type Data = Record<string, unknown>;

function createFakeDb() {
  const docs = new Map<string, Data>();
  let autoId = 0;

  const docRef = (path: string) => ({
    path,
    id: path.split("/").pop() as string,
    get: async () => snapshot(path),
    update: async (data: Data) => {
      const existing = docs.get(path);
      if (!existing) throw new Error(`No document at ${path}`);
      docs.set(path, { ...existing, ...data });
    },
  });

  const snapshot = (path: string) => {
    const data = docs.get(path);
    return {
      exists: data !== undefined,
      id: path.split("/").pop(),
      ref: docRef(path),
      data: () => data,
    };
  };

  const collection = (name: string) => ({
    doc: (id: string) => docRef(`${name}/${id}`),
    add: async (data: Data) => {
      const path = `${name}/auto-${++autoId}`;
      docs.set(path, data);
      return docRef(path);
    },
    where: (field: string, _op: "==", value: unknown) => ({
      get: async () => {
        const matches = [...docs.entries()]
          .filter(([path, data]) => path.startsWith(`${name}/`) && data[field] === value)
          .map(([path]) => snapshot(path));
        return { empty: matches.length === 0, docs: matches };
      },
    }),
  });

  const db = {
    collection,
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        create: (ref: { path: string }, data: Data) => {
          ops.push(() => {
            if (docs.has(ref.path)) throw new Error("already exists");
            docs.set(ref.path, data);
          });
        },
        update: (ref: { path: string }, data: Data) => {
          ops.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...data }));
        },
        commit: async () => ops.forEach((op) => op()),
      };
    },
    runTransaction: async <T>(callback: (tx: unknown) => Promise<T>) => {
      const writes: Array<() => void> = [];
      const result = await callback({
        get: async (ref: { path: string }) => snapshot(ref.path),
        update: (ref: { path: string }, data: Data) => {
          writes.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...data }));
        },
      });
      writes.forEach((write) => write());
      return result;
    },
  };

  return { db: db as unknown as firestore.Firestore, docs };
}

const timestamp = (date: Date) =>
  ({ toMillis: () => date.getTime(), toDate: () => date }) as unknown as firestore.Timestamp;
const SERVER_TS = { __op: "serverTimestamp" };
const serverTimestamp = () => SERVER_TS;

// ── Codes ──────────────────────────────────────────────────────────────────

describe("recovery codes", () => {
  it("generates 12-character Crockford base32 codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/);
    }
  });

  it("formats codes in dashed groups of four", () => {
    expect(formatRecoveryCode("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
  });

  it("normalizes case, separators, and look-alike characters", () => {
    expect(normalizeRecoveryCode(" abcd-efgh-jkmn ")).toBe("ABCDEFGHJKMN");
    expect(normalizeRecoveryCode("ABCD EFGH JKMO")).toBe("ABCDEFGHJKM0");
    expect(normalizeRecoveryCode("ABCD-EFGH-JKMI")).toBe("ABCDEFGHJKM1");
    expect(normalizeRecoveryCode("abcd-efgh-jkml")).toBe("ABCDEFGHJKM1");
  });

  it("rejects malformed codes", () => {
    expect(normalizeRecoveryCode("ABCD-EFGH")).toBeNull();
    expect(normalizeRecoveryCode("ABCD-EFGH-JKMU")).toBeNull();
    expect(normalizeRecoveryCode(12345)).toBeNull();
    expect(normalizeRecoveryCode(undefined)).toBeNull();
  });

  it("hashes deterministically without exposing the code", () => {
    const hash = hashRecoveryCode("ABCDEFGHJKMN");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashRecoveryCode("ABCDEFGHJKMN"));
    expect(hash).not.toContain("ABCD");
  });
});

// ── Input normalization ────────────────────────────────────────────────────

describe("input normalization", () => {
  it("normalizes valid emails and rejects invalid ones", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@x.io`)).toBeNull();
  });

  it("trims and truncates free text", () => {
    expect(normalizeText("  hi  ", 10)).toBe("hi");
    expect(normalizeText("abcdef", 3)).toBe("abc");
    expect(normalizeText(42, 10)).toBe("");
  });

  it("keys dedupe by uid when known, otherwise by email", () => {
    expect(recoveryDedupeKey("uid-1", "a@b.co")).toBe("uid:uid-1");
    expect(recoveryDedupeKey(null, "a@b.co")).toBe("email:a@b.co");
  });
});

// ── Request dedupe ─────────────────────────────────────────────────────────

describe("hasRecentPendingRequest", () => {
  const now = new Date("2026-10-01T12:00:00Z").getTime();

  it("is true for a pending request inside the window", async () => {
    const { db, docs } = createFakeDb();
    docs.set(`${EMAIL_RECOVERY_REQUESTS_COLLECTION}/r1`, {
      dedupeKey: "uid:u1",
      status: "pending",
      createdAt: timestamp(new Date(now - 60 * 60 * 1000)),
    });
    expect(await hasRecentPendingRequest(db, "uid:u1", now)).toBe(true);
  });

  it("ignores old, resolved, or unrelated requests", async () => {
    const { db, docs } = createFakeDb();
    docs.set(`${EMAIL_RECOVERY_REQUESTS_COLLECTION}/old`, {
      dedupeKey: "uid:u1",
      status: "pending",
      createdAt: timestamp(new Date(now - 25 * 60 * 60 * 1000)),
    });
    docs.set(`${EMAIL_RECOVERY_REQUESTS_COLLECTION}/done`, {
      dedupeKey: "uid:u1",
      status: "code-issued",
      createdAt: timestamp(new Date(now)),
    });
    docs.set(`${EMAIL_RECOVERY_REQUESTS_COLLECTION}/other`, {
      dedupeKey: "uid:u2",
      status: "pending",
      createdAt: timestamp(new Date(now)),
    });
    expect(await hasRecentPendingRequest(db, "uid:u1", now)).toBe(false);
  });
});

// ── Issue / consume / revoke ───────────────────────────────────────────────

describe("issue and consume", () => {
  const issuedAt = new Date("2026-10-01T12:00:00Z");

  async function issue(db: firestore.Firestore, requestId: string | null = null) {
    return issueRecoveryCode(db, timestamp, serverTimestamp, {
      uid: "uid-1",
      requestId,
      ttlHours: 24,
      now: issuedAt,
    });
  }

  it("stores only the hash and returns the plaintext once", async () => {
    const { db, docs } = createFakeDb();
    const issued = await issue(db);

    expect(issued.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(issued.expiresAt.toISOString()).toBe("2026-10-02T12:00:00.000Z");

    const canonical = normalizeRecoveryCode(issued.code) as string;
    const stored = docs.get(
      `${EMAIL_RECOVERY_CODES_COLLECTION}/${hashRecoveryCode(canonical)}`,
    );
    expect(stored).toMatchObject({ uid: "uid-1", usedAt: null, requestId: null });
    expect(JSON.stringify([...docs.entries()])).not.toContain(canonical);
  });

  it("marks the linked request as code-issued", async () => {
    const { db, docs } = createFakeDb();
    docs.set(`${EMAIL_RECOVERY_REQUESTS_COLLECTION}/req-1`, {
      status: "pending",
      uid: null,
    });
    await issue(db, "req-1");
    expect(docs.get(`${EMAIL_RECOVERY_REQUESTS_COLLECTION}/req-1`)).toMatchObject({
      status: "code-issued",
      uid: "uid-1",
    });
  });

  it("consumes a valid code exactly once", async () => {
    const { db } = createFakeDb();
    const code = normalizeRecoveryCode((await issue(db)).code) as string;
    const now = issuedAt.getTime() + 1000;

    await expect(consumeRecoveryCode(db, serverTimestamp, code, null, now)).resolves.toBe("uid-1");
    await expect(
      consumeRecoveryCode(db, serverTimestamp, code, null, now),
    ).rejects.toMatchObject({ reason: "used" });
  });

  it("lets the signed-in owner redeem but rejects another account", async () => {
    const { db } = createFakeDb();
    const code = normalizeRecoveryCode((await issue(db)).code) as string;
    const now = issuedAt.getTime() + 1000;

    await expect(
      consumeRecoveryCode(db, serverTimestamp, code, "someone-else", now),
    ).rejects.toMatchObject({ reason: "wrong-account" });
    await expect(
      consumeRecoveryCode(db, serverTimestamp, code, "uid-1", now),
    ).resolves.toBe("uid-1");
  });

  it("rejects expired and unknown codes", async () => {
    const { db } = createFakeDb();
    const code = normalizeRecoveryCode((await issue(db)).code) as string;
    const afterExpiry = issuedAt.getTime() + 25 * 60 * 60 * 1000;

    const expired = await consumeRecoveryCode(db, serverTimestamp, code, null, afterExpiry).catch(
      (e: unknown) => e,
    );
    expect(expired).toBeInstanceOf(RecoveryCodeRejectedError);
    expect((expired as RecoveryCodeRejectedError).reason).toBe("expired");

    await expect(
      consumeRecoveryCode(db, serverTimestamp, "0000000000ZZ", null, issuedAt.getTime()),
    ).rejects.toMatchObject({ reason: "not-found" });
  });

  it("release makes a consumed code usable again", async () => {
    const { db } = createFakeDb();
    const code = normalizeRecoveryCode((await issue(db)).code) as string;
    const now = issuedAt.getTime() + 1000;

    await consumeRecoveryCode(db, serverTimestamp, code, null, now);
    await releaseRecoveryCode(db, code);
    await expect(consumeRecoveryCode(db, serverTimestamp, code, null, now)).resolves.toBe("uid-1");
  });

  it("revokes every unused code for the user", async () => {
    const { db } = createFakeDb();
    const first = normalizeRecoveryCode((await issue(db)).code) as string;
    const second = normalizeRecoveryCode((await issue(db)).code) as string;
    const now = issuedAt.getTime() + 1000;
    await consumeRecoveryCode(db, serverTimestamp, first, null, now);

    expect(await revokeRecoveryCodes(db, serverTimestamp, "uid-1")).toBe(1);
    await expect(
      consumeRecoveryCode(db, serverTimestamp, second, null, now),
    ).rejects.toMatchObject({ reason: "used" });
  });
});
