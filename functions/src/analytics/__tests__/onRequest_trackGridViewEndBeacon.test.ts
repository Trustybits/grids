/**
 * Tests for the trackGridViewEndBeacon Cloud Function HTTP handler.
 *
 * The handler is the server-side endpoint behind `navigator.sendBeacon` for
 * `grid_view_end` events. It must:
 *   - respond to CORS preflight (OPTIONS)
 *   - reject non-POST methods (405)
 *   - parse bodies arriving as object, JSON string, or Buffer (body-parser
 *     normally handles JSON, but `sendBeacon`-via-Blob can land as a string
 *     or Buffer)
 *   - validate payload shape (layoutId, sessionId, durationMs, optional userId)
 *   - cap durationMs at 24h (sanity bound)
 *   - delegate the write to `writeServerAnalyticsEvent`, which lands a
 *     `grid_view_end` document in `analyticsEvents` with the expected shape
 *     (eventType, server timestamp, expiresAt = now+90d, metadata)
 *   - return 500 only when the marker pre-check fails; analytics-write
 *     failures are swallowed by `writeServerAnalyticsEvent` so the handler
 *     still responds 204 (analytics must never break the caller)
 *
 * All Firebase IO is mocked: `firebase-admin` provides a fake firestore with
 * recordable transaction reads/writes and `collection().add()`,
 * `firebase-functions/v1` is stubbed so `https.onRequest` returns the raw
 * handler, and the logger is silenced but assertable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as logger from "firebase-functions/logger";
import { createHash } from "node:crypto";

// ── Hoisted shared state (so vi.mock factories can see it) ──────────────

const { firestoreState, FieldValue, Timestamp } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: () => ({ __op: "serverTimestamp" }),
  };
  const Timestamp = {
    fromMillis: (ms: number) => ({
      __isTimestamp: true,
      _millis: ms,
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  };
  // Holder pattern so each test can swap in a fresh recorder/behaviour.
  const firestoreState: {
    addImpl: (data: Record<string, unknown>) => Promise<unknown>;
    addCalls: Array<{ collection: string; data: Record<string, unknown> }>;
    docs: Map<string, Record<string, unknown>>;
    setCalls: Array<{ path: string; data: Record<string, unknown> }>;
    updateCalls: Array<{ path: string; data: Record<string, unknown> }>;
    // Escape hatches for fault-injection tests:
    getThrowPaths: Set<string>;
    runTransactionShouldThrow: boolean;
  } = {
    addImpl: async () => ({ id: "stub" }),
    addCalls: [],
    docs: new Map(),
    setCalls: [],
    updateCalls: [],
    getThrowPaths: new Set(),
    runTransactionShouldThrow: false,
  };
  return { firestoreState, FieldValue, Timestamp };
});

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("firebase-admin", () => {
  function makeSnap(path: string) {
    const data = firestoreState.docs.get(path);
    return {
      exists: data != null,
      data: () => data,
    };
  }

  function makeDocRef(path: string): unknown {
    return {
      path,
      collection: (name: string) => ({
        doc: (id: string) => makeDocRef(`${path}/${name}/${id}`),
      }),
      get: async () => {
        if (firestoreState.getThrowPaths.has(path)) {
          throw new Error(`simulated get failure: ${path}`);
        }
        return makeSnap(path);
      },
    };
  }

  const firestoreFn: (() => unknown) & {
    FieldValue?: typeof FieldValue;
    Timestamp?: typeof Timestamp;
  } = () => ({
    collection: (name: string) => ({
      add: async (data: Record<string, unknown>) => {
        firestoreState.addCalls.push({ collection: name, data });
        return firestoreState.addImpl(data);
      },
      doc: (id: string) => makeDocRef(`${name}/${id}`),
    }),
    runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      if (firestoreState.runTransactionShouldThrow) {
        throw new Error("simulated transaction failure");
      }
      const tx = {
        get: async (ref: { path: string }) => makeSnap(ref.path),
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          firestoreState.setCalls.push({ path: ref.path, data });
          firestoreState.docs.set(ref.path, data);
        },
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          firestoreState.updateCalls.push({ path: ref.path, data });
          firestoreState.docs.set(ref.path, {
            ...(firestoreState.docs.get(ref.path) ?? {}),
            ...data,
          });
        },
      };
      return callback(tx);
    },
  });
  firestoreFn.FieldValue = FieldValue;
  firestoreFn.Timestamp = Timestamp;
  return { firestore: firestoreFn, default: { firestore: firestoreFn } };
});

vi.mock("firebase-functions/v1", () => ({
  https: {
    // Capture the handler so tests can invoke it directly.
    onRequest: (handler: unknown) => handler,
  },
}));

vi.mock("firebase-functions/logger", () => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
}));

// Import AFTER mocks. Cast to the raw onRequest handler shape.
import { trackGridViewEndBeacon as handlerExport } from "../onRequest_trackGridViewEndBeacon";
const handler = handlerExport as unknown as (
  req: FakeReq,
  res: FakeRes,
) => Promise<void>;

// ── Fake req/res ─────────────────────────────────────────────────────────

interface FakeReq {
  method: string;
  body: unknown;
  headers: Record<string, string | string[]>;
  ip?: string;
}
interface FakeRes {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  _statusCode: number | null;
  _jsonBody: unknown;
  _sendBody: unknown;
  _headers: Record<string, string>;
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    _statusCode: null,
    _jsonBody: undefined,
    _sendBody: undefined,
    _headers: {},
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    set: vi.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res._statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res._jsonBody = body;
    return res;
  });
  res.send.mockImplementation((body: unknown) => {
    res._sendBody = body;
    return res;
  });
  res.set.mockImplementation((key: string, value: string) => {
    res._headers[key] = value;
    return res;
  });
  return res;
}

function makeReq(
  method: string,
  body: unknown,
  options: { headers?: Record<string, string | string[]>; ip?: string } = {},
): FakeReq {
  return {
    method,
    body,
    headers: options.headers ?? {},
    ip: options.ip,
  };
}

function expectedRateLimitPath(ip: string, layoutId: string): string {
  const key = createHash("sha256").update(`${ip}\0${layoutId}`).digest("hex");
  return `rateLimits/trackGridViewEndBeacon/gridViewEndEntries/${key}`;
}

function sessionMarkerPath(layoutId: string, sessionId: string): string {
  return `gridStats/${layoutId}/endedSessions/${sessionId}`;
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  firestoreState.addCalls = [];
  firestoreState.addImpl = async () => ({ id: "stub" });
  firestoreState.docs = new Map();
  firestoreState.setCalls = [];
  firestoreState.updateCalls = [];
  firestoreState.getThrowPaths = new Set();
  firestoreState.runTransactionShouldThrow = false;
  vi.mocked(logger.warn).mockClear();
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── CORS / method handling ───────────────────────────────────────────────

describe("CORS and HTTP method handling", () => {
  it("sets CORS headers on every response", async () => {
    const res = makeRes();
    await handler(makeReq("OPTIONS", null), res);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(res._headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    expect(res._headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
  });

  it("responds 204 with empty body to OPTIONS preflight and writes nothing", async () => {
    const res = makeRes();
    await handler(makeReq("OPTIONS", null), res);
    expect(res._statusCode).toBe(204);
    expect(res._sendBody).toBe("");
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("rejects GET with 405 Method not allowed", async () => {
    const res = makeRes();
    await handler(makeReq("GET", null), res);
    expect(res._statusCode).toBe(405);
    expect(res._jsonBody).toEqual({ error: "Method not allowed" });
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("rejects PUT with 405 Method not allowed", async () => {
    const res = makeRes();
    await handler(
      makeReq("PUT", { layoutId: "l", sessionId: "s", durationMs: 1 }),
      res,
    );
    expect(res._statusCode).toBe(405);
    expect(firestoreState.addCalls).toHaveLength(0);
  });
});

// ── Body parsing ─────────────────────────────────────────────────────────
//
// parseBody handles the three shapes that can reach an `https.onRequest`
// handler when the client uses sendBeacon: object (body-parser already
// handled JSON), string (text/plain or unknown content-type), and Buffer
// (raw body). Each must produce either a parsed object or null.

describe("body parsing", () => {
  const validPayload = {
    layoutId: "layout-1",
    sessionId: "sess-1",
    durationMs: 1234,
  };

  it("returns 400 when body is null", async () => {
    const res = makeRes();
    await handler(makeReq("POST", null), res);
    expect(res._statusCode).toBe(400);
    expect(res._jsonBody).toEqual({ error: "Invalid payload" });
    expect(logger.warn).toHaveBeenCalledWith(
      "trackGridViewEndBeacon: invalid payload",
    );
  });

  it("returns 400 when body is undefined", async () => {
    const res = makeRes();
    await handler(makeReq("POST", undefined), res);
    expect(res._statusCode).toBe(400);
  });

  it("returns 400 when body is an empty string", async () => {
    const res = makeRes();
    await handler(makeReq("POST", ""), res);
    expect(res._statusCode).toBe(400);
  });

  it("returns 400 when body is a string containing invalid JSON", async () => {
    const res = makeRes();
    await handler(makeReq("POST", "not valid json {"), res);
    expect(res._statusCode).toBe(400);
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("parses a JSON string body and accepts a valid payload", async () => {
    const res = makeRes();
    await handler(makeReq("POST", JSON.stringify(validPayload)), res);
    expect(res._statusCode).toBe(204);
    expect(firestoreState.addCalls).toHaveLength(1);
  });

  it("parses a Buffer body containing JSON and accepts a valid payload", async () => {
    const res = makeRes();
    const buf = Buffer.from(JSON.stringify(validPayload), "utf8");
    await handler(makeReq("POST", buf), res);
    expect(res._statusCode).toBe(204);
    expect(firestoreState.addCalls).toHaveLength(1);
  });

  it("returns 400 when body is an empty Buffer", async () => {
    const res = makeRes();
    await handler(makeReq("POST", Buffer.alloc(0)), res);
    expect(res._statusCode).toBe(400);
  });

  it("returns 400 when body is a Buffer with invalid JSON", async () => {
    const res = makeRes();
    await handler(makeReq("POST", Buffer.from("garbage{{", "utf8")), res);
    expect(res._statusCode).toBe(400);
  });

  it("accepts an already-parsed object body", async () => {
    const res = makeRes();
    await handler(makeReq("POST", validPayload), res);
    expect(res._statusCode).toBe(204);
  });

  it("returns 400 when body is a number (unsupported type)", async () => {
    const res = makeRes();
    await handler(makeReq("POST", 42), res);
    expect(res._statusCode).toBe(400);
  });
});

// ── Payload validation ──────────────────────────────────────────────────

describe("payload validation", () => {
  const valid = {
    layoutId: "layout-1",
    sessionId: "sess-1",
    durationMs: 1000,
  };

  it("rejects when layoutId is missing", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { sessionId: "s", durationMs: 1 }), res);
    expect(res._statusCode).toBe(400);
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("rejects when layoutId is an empty string", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, layoutId: "" }), res);
    expect(res._statusCode).toBe(400);
  });

  it("rejects when layoutId is not a string", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, layoutId: 123 }), res);
    expect(res._statusCode).toBe(400);
  });

  it("rejects when layoutId is not safe for Firestore document paths", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, layoutId: "layouts/bad" }), res);
    expect(res._statusCode).toBe(400);
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("rejects when sessionId is missing", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { layoutId: "l", durationMs: 1 }), res);
    expect(res._statusCode).toBe(400);
  });

  it("rejects when sessionId is an empty string", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, sessionId: "" }), res);
    expect(res._statusCode).toBe(400);
  });

  it("rejects when sessionId is not a string", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, sessionId: 42 }), res);
    expect(res._statusCode).toBe(400);
  });

  it("rejects when sessionId is not safe for Firestore document paths", async () => {
    const res = makeRes();
    await handler(
      makeReq("POST", { ...valid, sessionId: "sessions/bad" }),
      res,
    );
    expect(res._statusCode).toBe(400);
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("rejects overlong layoutId and sessionId values", async () => {
    const tooLong = "a".repeat(129);

    const layoutRes = makeRes();
    await handler(makeReq("POST", { ...valid, layoutId: tooLong }), layoutRes);
    expect(layoutRes._statusCode).toBe(400);

    const sessionRes = makeRes();
    await handler(
      makeReq("POST", { ...valid, sessionId: tooLong }),
      sessionRes,
    );
    expect(sessionRes._statusCode).toBe(400);
  });

  it.each([
    ["zero", 0],
    ["negative", -100],
    ["NaN", Number.NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["non-numeric string", "abc"],
  ])("rejects when durationMs is %s", async (_label, durationMs) => {
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, durationMs }), res);
    expect(res._statusCode).toBe(400);
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("rejects when durationMs exceeds the 24h sanity cap", async () => {
    const res = makeRes();
    const overCap = 24 * 60 * 60 * 1000 + 1;
    await handler(makeReq("POST", { ...valid, durationMs: overCap }), res);
    expect(res._statusCode).toBe(400);
  });

  it("accepts durationMs exactly at the 24h cap", async () => {
    const res = makeRes();
    const atCap = 24 * 60 * 60 * 1000;
    await handler(makeReq("POST", { ...valid, durationMs: atCap }), res);
    expect(res._statusCode).toBe(204);
    expect(firestoreState.addCalls[0].data.metadata).toMatchObject({
      durationMs: atCap,
    });
  });

  it("rounds non-integer durationMs to the nearest millisecond", async () => {
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, durationMs: 1234.7 }), res);
    expect(res._statusCode).toBe(204);
    expect(firestoreState.addCalls[0].data.metadata).toMatchObject({
      durationMs: 1235,
    });
  });

  it("coerces a numeric-string durationMs and accepts it", async () => {
    // Number("250") is 250, so this passes validation per the implementation.
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, durationMs: "250" }), res);
    expect(res._statusCode).toBe(204);
    expect(firestoreState.addCalls[0].data.metadata).toMatchObject({
      durationMs: 250,
    });
  });

  describe("userId handling", () => {
    it("stores a non-empty string userId", async () => {
      const res = makeRes();
      await handler(makeReq("POST", { ...valid, userId: "user-123" }), res);
      expect(res._statusCode).toBe(204);
      expect(firestoreState.addCalls[0].data.userId).toBe("user-123");
    });

    it("stores null when userId is omitted", async () => {
      const res = makeRes();
      await handler(makeReq("POST", { ...valid }), res);
      expect(res._statusCode).toBe(204);
      expect(firestoreState.addCalls[0].data.userId).toBeNull();
    });

    it("stores null when userId is explicitly null", async () => {
      const res = makeRes();
      await handler(makeReq("POST", { ...valid, userId: null }), res);
      expect(res._statusCode).toBe(204);
      expect(firestoreState.addCalls[0].data.userId).toBeNull();
    });

    it("stores null when userId is the empty string", async () => {
      const res = makeRes();
      await handler(makeReq("POST", { ...valid, userId: "" }), res);
      expect(res._statusCode).toBe(204);
      expect(firestoreState.addCalls[0].data.userId).toBeNull();
    });

    it("rejects when userId is a non-string non-null value (e.g. a number)", async () => {
      const res = makeRes();
      await handler(makeReq("POST", { ...valid, userId: 42 }), res);
      expect(res._statusCode).toBe(400);
    });

    it("rejects when userId is a boolean", async () => {
      const res = makeRes();
      await handler(makeReq("POST", { ...valid, userId: true }), res);
      expect(res._statusCode).toBe(400);
    });
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────

describe("rate limiting", () => {
  it("uses req.ip for the hashed rate-limit key instead of spoofable x-forwarded-for", async () => {
    const res = makeRes();
    await handler(
      makeReq(
        "POST",
        {
          layoutId: "layout-7",
          sessionId: "sess-xyz",
          durationMs: 7500,
        },
        {
          ip: "203.0.113.10",
          headers: { "x-forwarded-for": "198.51.100.99" },
        },
      ),
      res,
    );

    expect(res._statusCode).toBe(204);
    expect(firestoreState.setCalls[0].path).toBe(
      expectedRateLimitPath("203.0.113.10", "layout-7"),
    );
    expect(firestoreState.setCalls[0].path).not.toContain("198.51.100.99");
    expect(firestoreState.setCalls[0].path).not.toContain("layout-7");
  });

  it("writes rate-limit entries with a timestamp expiresAt for TTL cleanup", async () => {
    const NOW = Date.UTC(2026, 4, 7, 12, 0, 0);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const res = makeRes();
    await handler(
      makeReq(
        "POST",
        {
          layoutId: "layout-7",
          sessionId: "sess-xyz",
          durationMs: 7500,
        },
        { ip: "203.0.113.10" },
      ),
      res,
    );

    expect(res._statusCode).toBe(204);
    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(firestoreState.setCalls[0].data).toEqual(
      expect.objectContaining({
        expiresAt: expect.objectContaining({
          __isTimestamp: true,
          _millis: NOW + oneDayMs,
        }),
      }),
    );
  });
});

// ── Happy-path Firestore write shape ─────────────────────────────────────

describe("Firestore write on success", () => {
  it("writes a grid_view_end document with the full expected shape", async () => {
    // Pin Date.now so we can predict expiresAt.
    const NOW = Date.UTC(2026, 4, 7, 12, 0, 0); // 2026-05-07T12:00:00Z
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const res = makeRes();
    await handler(
      makeReq("POST", {
        layoutId: "layout-7",
        sessionId: "sess-xyz",
        durationMs: 7500,
        userId: "user-9",
      }),
      res,
    );

    expect(res._statusCode).toBe(204);
    expect(res._sendBody).toBe("");
    expect(firestoreState.addCalls).toHaveLength(1);

    const call = firestoreState.addCalls[0];
    expect(call.collection).toBe("analyticsEvents");

    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    expect(call.data).toEqual({
      eventType: "grid_view_end",
      timestamp: { __op: "serverTimestamp" },
      expiresAt: expect.objectContaining({
        __isTimestamp: true,
        _millis: NOW + ninetyDaysMs,
      }),
      userId: "user-9",
      layoutId: "layout-7",
      metadata: {
        sessionId: "sess-xyz",
        durationMs: 7500,
      },
    });
  });

  it("does not include error or warn log entries on success", async () => {
    const res = makeRes();
    await handler(
      makeReq("POST", {
        layoutId: "l",
        sessionId: "s",
        durationMs: 1000,
      }),
      res,
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

// ── Firestore failure ────────────────────────────────────────────────────
//
// The handler delegates the analyticsEvents write to writeServerAnalyticsEvent,
// which swallows its own errors so analytics failures never break the caller.
// As a result the handler now responds 204 even when the underlying add()
// rejects — the failure is logged from inside writeServerAnalyticsEvent with
// the message "Failed to write server analytics event".

describe("analytics write failure", () => {
  it("still returns 204 when the underlying analytics write rejects (writeServerAnalyticsEvent swallows the error)", async () => {
    firestoreState.addImpl = async () => {
      throw new Error("transient firestore failure");
    };

    const res = makeRes();
    await handler(
      makeReq("POST", {
        layoutId: "layout-1",
        sessionId: "sess-1",
        durationMs: 100,
        userId: "user-7",
      }),
      res,
    );

    expect(res._statusCode).toBe(204);
    expect(res._sendBody).toBe("");
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to write server analytics event",
      expect.objectContaining({
        eventType: "grid_view_end",
        userId: "user-7",
        layoutId: "layout-1",
        error: expect.stringContaining("transient firestore failure"),
      }),
    );
  });

  it("does not throw out of the handler when the analytics write rejects", async () => {
    firestoreState.addImpl = async () => {
      throw new Error("boom");
    };
    const res = makeRes();
    await expect(
      handler(
        makeReq("POST", {
          layoutId: "l",
          sessionId: "s",
          durationMs: 1,
        }),
        res,
      ),
    ).resolves.toBeUndefined();
    expect(res._statusCode).toBe(204);
  });
});

// ── Body size limit (MAX_BODY_BYTES = 2048) ──────────────────────────────

describe("body size limit", () => {
  const valid = { layoutId: "l", sessionId: "s", durationMs: 100 };

  it("rejects with 413 when Content-Length header exceeds 2048", async () => {
    const res = makeRes();
    await handler(
      makeReq("POST", valid, { headers: { "content-length": "5000" } }),
      res,
    );
    expect(res._statusCode).toBe(413);
    expect(res._jsonBody).toEqual({ error: "Payload too large" });
    expect(firestoreState.addCalls).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      "trackGridViewEndBeacon: payload too large",
    );
  });

  it("rejects with 413 when reconstructed JSON body exceeds 2048 bytes", async () => {
    const big = "x".repeat(3000);
    const res = makeRes();
    await handler(makeReq("POST", { ...valid, padding: big }), res);
    expect(res._statusCode).toBe(413);
    expect(firestoreState.addCalls).toHaveLength(0);
  });

  it("rejects with 413 when a string body exceeds 2048 bytes", async () => {
    const res = makeRes();
    await handler(makeReq("POST", "y".repeat(3000)), res);
    expect(res._statusCode).toBe(413);
  });

  it("rejects with 413 when a Buffer body exceeds 2048 bytes", async () => {
    const res = makeRes();
    await handler(makeReq("POST", Buffer.alloc(3000, 65)), res);
    expect(res._statusCode).toBe(413);
  });

  it("prefers Content-Length over the body size for the size check", async () => {
    // Body itself is tiny, but Content-Length claims it's huge — handler
    // should trust the header and reject. This locks in the documented
    // preference order in bodyByteSize().
    const res = makeRes();
    await handler(
      makeReq("POST", valid, { headers: { "content-length": "10000" } }),
      res,
    );
    expect(res._statusCode).toBe(413);
  });

  it("ignores invalid (non-numeric) Content-Length and uses computed size", async () => {
    const res = makeRes();
    await handler(
      makeReq("POST", valid, { headers: { "content-length": "not-a-number" } }),
      res,
    );
    expect(res._statusCode).toBe(204);
    expect(firestoreState.addCalls).toHaveLength(1);
  });

  it("rejects with 413 when object body size cannot be reconstructed", async () => {
    const circular: Record<string, unknown> = { ...valid };
    circular.self = circular;

    const res = makeRes();
    await handler(makeReq("POST", circular), res);

    expect(res._statusCode).toBe(413);
    expect(res._jsonBody).toEqual({ error: "Payload too large" });
    expect(firestoreState.addCalls).toHaveLength(0);
  });
});

// ── Idempotency via session marker ───────────────────────────────────────

describe("session-end idempotency", () => {
  const payload = {
    layoutId: "layout-9",
    sessionId: "sess-9",
    durationMs: 5000,
  };

  it("returns 204 and skips the analyticsEvents write when the session marker already exists", async () => {
    firestoreState.docs.set(
      sessionMarkerPath(payload.layoutId, payload.sessionId),
      { endedAt: 123 },
    );

    const res = makeRes();
    await handler(makeReq("POST", payload), res);

    expect(res._statusCode).toBe(204);
    expect(res._sendBody).toBe("");
    expect(firestoreState.addCalls).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(
      "trackGridViewEndBeacon: session already ended, skipping",
      expect.objectContaining({
        layoutId: payload.layoutId,
        sessionId: payload.sessionId,
      }),
    );
  });

  it("returns 500 when reading the session marker throws", async () => {
    firestoreState.getThrowPaths.add(
      sessionMarkerPath(payload.layoutId, payload.sessionId),
    );

    const res = makeRes();
    await handler(makeReq("POST", payload), res);

    expect(res._statusCode).toBe(500);
    expect(res._jsonBody).toEqual({ error: "Failed to record event" });
    expect(firestoreState.addCalls).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      "trackGridViewEndBeacon: failed to check session marker",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});

// ── Rate limiting: window behavior ───────────────────────────────────────

describe("rate limiting: window behavior", () => {
  const payload = {
    layoutId: "layout-rl",
    sessionId: "sess-rl",
    durationMs: 1000,
  };
  const ip = "203.0.113.10";

  it("creates a new window with count=1 on first request", async () => {
    const NOW = Date.UTC(2026, 4, 7, 12, 0, 0);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const res = makeRes();
    await handler(makeReq("POST", payload, { ip }), res);

    expect(res._statusCode).toBe(204);
    expect(firestoreState.setCalls).toHaveLength(1);
    expect(firestoreState.setCalls[0].path).toBe(
      expectedRateLimitPath(ip, payload.layoutId),
    );
    expect(firestoreState.setCalls[0].data).toEqual(
      expect.objectContaining({
        windowStart: NOW,
        count: 1,
      }),
    );
    expect(firestoreState.updateCalls).toHaveLength(0);
  });

  it("increments count via update when within the active window", async () => {
    const NOW = Date.UTC(2026, 4, 7, 12, 0, 0);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const path = expectedRateLimitPath(ip, payload.layoutId);
    firestoreState.docs.set(path, {
      windowStart: NOW - 10_000, // 10s into a 60s window
      count: 5,
    });

    const res = makeRes();
    await handler(makeReq("POST", payload, { ip }), res);

    expect(res._statusCode).toBe(204);
    expect(firestoreState.updateCalls).toHaveLength(1);
    expect(firestoreState.updateCalls[0].path).toBe(path);
    expect(firestoreState.updateCalls[0].data).toEqual(
      expect.objectContaining({ count: 6 }),
    );
    expect(firestoreState.setCalls).toHaveLength(0);
  });

  it("returns 429 when the per-window cap (20) is reached", async () => {
    const NOW = Date.UTC(2026, 4, 7, 12, 0, 0);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const path = expectedRateLimitPath(ip, payload.layoutId);
    firestoreState.docs.set(path, {
      windowStart: NOW - 10_000,
      count: 20,
    });

    const res = makeRes();
    await handler(makeReq("POST", payload, { ip }), res);

    expect(res._statusCode).toBe(429);
    expect(res._jsonBody).toEqual({ error: "Too many requests" });
    expect(firestoreState.addCalls).toHaveLength(0);
    expect(firestoreState.updateCalls).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      "trackGridViewEndBeacon: rate limit exceeded",
      expect.objectContaining({ ip, layoutId: payload.layoutId }),
    );
  });

  it("resets the window (set with count=1) when the previous window has expired", async () => {
    const NOW = Date.UTC(2026, 4, 7, 12, 0, 0);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const path = expectedRateLimitPath(ip, payload.layoutId);
    // windowStart 2 minutes ago — well past the 60s window.
    firestoreState.docs.set(path, {
      windowStart: NOW - 120_000,
      count: 19,
    });

    const res = makeRes();
    await handler(makeReq("POST", payload, { ip }), res);

    expect(res._statusCode).toBe(204);
    expect(firestoreState.setCalls).toHaveLength(1);
    expect(firestoreState.setCalls[0].data).toEqual(
      expect.objectContaining({ windowStart: NOW, count: 1 }),
    );
  });

  it("fails open and proceeds with the write when the rate-limit transaction throws", async () => {
    firestoreState.runTransactionShouldThrow = true;

    const res = makeRes();
    await handler(makeReq("POST", payload, { ip }), res);

    expect(res._statusCode).toBe(204);
    expect(firestoreState.addCalls).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(
      "trackGridViewEndBeacon: rate limit check failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});

// ── Client IP extraction ────────────────────────────────────────────────

describe("client IP extraction (rate-limit key derivation)", () => {
  const payload = {
    layoutId: "layout-ip",
    sessionId: "sess-ip",
    durationMs: 1000,
  };

  it("falls back to X-Forwarded-For when req.ip is absent", async () => {
    const res = makeRes();
    await handler(
      makeReq("POST", payload, {
        headers: { "x-forwarded-for": "198.51.100.5" },
      }),
      res,
    );
    expect(res._statusCode).toBe(204);
    expect(firestoreState.setCalls[0].path).toBe(
      expectedRateLimitPath("198.51.100.5", payload.layoutId),
    );
  });

  it("uses the first hop when X-Forwarded-For is a comma-separated list", async () => {
    const res = makeRes();
    await handler(
      makeReq("POST", payload, {
        headers: { "x-forwarded-for": "198.51.100.5, 10.0.0.1, 10.0.0.2" },
      }),
      res,
    );
    expect(res._statusCode).toBe(204);
    expect(firestoreState.setCalls[0].path).toBe(
      expectedRateLimitPath("198.51.100.5", payload.layoutId),
    );
  });

  it("uses the first X-Forwarded-For header value when the header is an array", async () => {
    const res = makeRes();
    await handler(
      makeReq("POST", payload, {
        headers: { "x-forwarded-for": ["198.51.100.8", "203.0.113.20"] },
      }),
      res,
    );
    expect(res._statusCode).toBe(204);
    expect(firestoreState.setCalls[0].path).toBe(
      expectedRateLimitPath("198.51.100.8", payload.layoutId),
    );
  });

  it("falls back to 'unknown' when neither req.ip nor X-Forwarded-For is present", async () => {
    const res = makeRes();
    await handler(makeReq("POST", payload), res);
    expect(res._statusCode).toBe(204);
    expect(firestoreState.setCalls[0].path).toBe(
      expectedRateLimitPath("unknown", payload.layoutId),
    );
  });
});
