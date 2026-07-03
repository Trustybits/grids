// Unit tests for ChatService — ChatDao is mocked via the DAO factory singleton
// and the AuthProvider is mocked via its singleton. Date.now() is faked so the
// sendMessage timestamp is deterministic.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { ChatService } from "@/services/ChatService";
import type { ChatDao } from "@grids/contracts/dao";
import type { AuthProvider } from "@grids/contracts/auth";
import type { ChatMessage } from "@grids/contracts/types";
import { registerTestDaoFactory } from "./testHelpers";

let mockChatDao: Record<string, ReturnType<typeof vi.fn>>;
let mockAuthProvider: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  mockChatDao = {
    subscribeToMessages: vi.fn(),
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    deleteAllMessages: vi.fn(),
  };

  mockAuthProvider = {
    getCurrentUserId: vi.fn(() => "author-1"),
  };

  registerTestDaoFactory({
    getChatDao: () => mockChatDao as unknown as ChatDao,
  });

  registerAuthProvider(mockAuthProvider as unknown as AuthProvider);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── subscribeToMessages ─────────────────────────────────────────────────────

describe("subscribeToMessages", () => {
  it("delegates to chatDao.subscribeToMessages and returns the unsubscribe fn", () => {
    const unsub = vi.fn();
    mockChatDao.subscribeToMessages.mockReturnValueOnce(unsub);
    const callback = vi.fn();
    const onError = vi.fn();

    const service = new ChatService();
    const result = service.subscribeToMessages("g1", "t1", callback, onError);

    expect(mockChatDao.subscribeToMessages).toHaveBeenCalledWith(
      "g1",
      "t1",
      callback,
      onError,
    );
    expect(result).toBe(unsub);
  });

  it("passes undefined onError through when not provided", () => {
    mockChatDao.subscribeToMessages.mockReturnValueOnce(vi.fn());
    const callback = vi.fn();

    const service = new ChatService();
    service.subscribeToMessages("g1", "t1", callback);

    expect(mockChatDao.subscribeToMessages).toHaveBeenCalledWith(
      "g1",
      "t1",
      callback,
      undefined,
    );
  });

  it("forwards messages from the DAO to the callback", () => {
    const messages: ChatMessage[] = [
      { id: "m1", text: "hi", createdAt: 1, authorId: "a" } as ChatMessage,
    ];
    mockChatDao.subscribeToMessages.mockImplementation(
      (_g, _t, cb: (m: ChatMessage[]) => void) => {
        cb(messages);
        return vi.fn();
      },
    );
    const callback = vi.fn();

    const service = new ChatService();
    service.subscribeToMessages("g1", "t1", callback);

    expect(callback).toHaveBeenCalledWith(messages);
  });
});

// ── sendMessage ─────────────────────────────────────────────────────────────

describe("sendMessage", () => {
  it("adds a message with the current user id and a timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
    mockChatDao.addMessage.mockResolvedValueOnce("msg-id");

    const service = new ChatService();
    const result = await service.sendMessage("g1", "t1", "hello");

    expect(mockChatDao.addMessage).toHaveBeenCalledWith("g1", "t1", {
      text: "hello",
      createdAt: Date.now(),
      authorId: "author-1",
    });
    expect(result).toBe("msg-id");
  });

  it('falls back to "visitor" when there is no authenticated user', async () => {
    mockAuthProvider.getCurrentUserId.mockReturnValue(null);
    mockChatDao.addMessage.mockResolvedValueOnce("msg-id");

    const service = new ChatService();
    await service.sendMessage("g1", "t1", "anon");

    expect(mockChatDao.addMessage).toHaveBeenCalledWith(
      "g1",
      "t1",
      expect.objectContaining({ authorId: "visitor" }),
    );
  });

  it("preserves an empty-string text payload", async () => {
    mockChatDao.addMessage.mockResolvedValueOnce("msg-id");

    const service = new ChatService();
    await service.sendMessage("g1", "t1", "");

    expect(mockChatDao.addMessage).toHaveBeenCalledWith(
      "g1",
      "t1",
      expect.objectContaining({ text: "" }),
    );
  });

  it("propagates errors from the DAO", async () => {
    mockChatDao.addMessage.mockRejectedValueOnce(new Error("write failed"));

    const service = new ChatService();
    await expect(service.sendMessage("g1", "t1", "x")).rejects.toThrow(
      "write failed",
    );
  });
});

// ── editMessage ─────────────────────────────────────────────────────────────

describe("editMessage", () => {
  it("delegates to chatDao.updateMessage", async () => {
    mockChatDao.updateMessage.mockResolvedValueOnce(undefined);

    const service = new ChatService();
    await service.editMessage("g1", "t1", "m1", "edited");

    expect(mockChatDao.updateMessage).toHaveBeenCalledWith(
      "g1",
      "t1",
      "m1",
      "edited",
    );
  });

  it("propagates errors from the DAO", async () => {
    mockChatDao.updateMessage.mockRejectedValueOnce(new Error("nope"));

    const service = new ChatService();
    await expect(
      service.editMessage("g1", "t1", "m1", "edited"),
    ).rejects.toThrow("nope");
  });
});

// ── deleteMessage ───────────────────────────────────────────────────────────

describe("deleteMessage", () => {
  it("delegates to chatDao.deleteMessage", async () => {
    mockChatDao.deleteMessage.mockResolvedValueOnce(undefined);

    const service = new ChatService();
    await service.deleteMessage("g1", "t1", "m1");

    expect(mockChatDao.deleteMessage).toHaveBeenCalledWith("g1", "t1", "m1");
  });

  it("propagates errors from the DAO", async () => {
    mockChatDao.deleteMessage.mockRejectedValueOnce(new Error("nope"));

    const service = new ChatService();
    await expect(service.deleteMessage("g1", "t1", "m1")).rejects.toThrow(
      "nope",
    );
  });
});

// ── deleteAllMessages ───────────────────────────────────────────────────────

describe("deleteAllMessages", () => {
  it("delegates to chatDao.deleteAllMessages", async () => {
    mockChatDao.deleteAllMessages.mockResolvedValueOnce(undefined);

    const service = new ChatService();
    await service.deleteAllMessages("g1", "t1");

    expect(mockChatDao.deleteAllMessages).toHaveBeenCalledWith("g1", "t1");
  });

  it("propagates errors from the DAO", async () => {
    mockChatDao.deleteAllMessages.mockRejectedValueOnce(new Error("nope"));

    const service = new ChatService();
    await expect(service.deleteAllMessages("g1", "t1")).rejects.toThrow(
      "nope",
    );
  });
});
