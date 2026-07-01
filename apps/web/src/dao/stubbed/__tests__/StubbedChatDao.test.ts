// Unit tests for StubbedChatDao — messages are stored per grid/tile key;
// add/update/delete mutate the in-memory list and notify subscribers; subscribe
// delivers the current message list (or empty) and live updates.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StubbedChatDao } from "../StubbedChatDao";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase, flushMicrotasks } from "./memoryTestUtils";

const GRID = "grid-1";
const TILE = "tile-1";
const KEY = `${GRID}/${TILE}`;

function message(overrides: Partial<{ text: string; createdAt: number; authorId: string }> = {}) {
  return { text: "hello", createdAt: 1000, authorId: "author-1", ...overrides };
}

let dao: StubbedChatDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedChatDao();
});

describe("StubbedChatDao.addMessage", () => {
  it("stores the message and returns a generated id", async () => {
    const id = await dao.addMessage(GRID, TILE, message());

    expect(id).toMatch(/^message_/);
    expect(memoryDatabase.messages.get(KEY)).toEqual([
      { id, text: "hello", createdAt: 1000, authorId: "author-1" },
    ]);
  });

  it("appends multiple messages in insertion order", async () => {
    await dao.addMessage(GRID, TILE, message({ text: "first" }));
    await dao.addMessage(GRID, TILE, message({ text: "second" }));

    expect(memoryDatabase.messages.get(KEY)?.map((m) => m.text)).toEqual([
      "first",
      "second",
    ]);
  });

  it("isolates messages by grid/tile key", async () => {
    await dao.addMessage(GRID, TILE, message({ text: "a" }));
    await dao.addMessage("grid-2", "tile-2", message({ text: "b" }));

    expect(memoryDatabase.messages.get(KEY)?.map((m) => m.text)).toEqual(["a"]);
    expect(
      memoryDatabase.messages.get("grid-2/tile-2")?.map((m) => m.text),
    ).toEqual(["b"]);
  });
});

describe("StubbedChatDao.updateMessage", () => {
  it("updates the text of the matching message", async () => {
    const id = await dao.addMessage(GRID, TILE, message({ text: "old" }));
    await dao.updateMessage(GRID, TILE, id, "new");

    expect(memoryDatabase.messages.get(KEY)?.[0].text).toBe("new");
  });

  it("leaves other messages untouched", async () => {
    const id1 = await dao.addMessage(GRID, TILE, message({ text: "one" }));
    await dao.addMessage(GRID, TILE, message({ text: "two" }));
    await dao.updateMessage(GRID, TILE, id1, "edited");

    expect(memoryDatabase.messages.get(KEY)?.map((m) => m.text)).toEqual([
      "edited",
      "two",
    ]);
  });

  it("is a no-op when the message id is not found", async () => {
    await dao.addMessage(GRID, TILE, message({ text: "keep" }));
    await dao.updateMessage(GRID, TILE, "missing", "x");

    expect(memoryDatabase.messages.get(KEY)?.[0].text).toBe("keep");
  });

  it("is a no-op for an unknown grid/tile key", async () => {
    await dao.updateMessage(GRID, TILE, "any", "x");
    expect(memoryDatabase.messages.get(KEY)).toEqual([]);
  });
});

describe("StubbedChatDao.deleteMessage", () => {
  it("removes the matching message", async () => {
    const id = await dao.addMessage(GRID, TILE, message());
    await dao.deleteMessage(GRID, TILE, id);

    expect(memoryDatabase.messages.get(KEY)).toEqual([]);
  });

  it("keeps non-matching messages", async () => {
    const id1 = await dao.addMessage(GRID, TILE, message({ text: "one" }));
    await dao.addMessage(GRID, TILE, message({ text: "two" }));
    await dao.deleteMessage(GRID, TILE, id1);

    expect(memoryDatabase.messages.get(KEY)?.map((m) => m.text)).toEqual([
      "two",
    ]);
  });

  it("is a no-op for an unknown grid/tile key", async () => {
    await dao.deleteMessage(GRID, TILE, "any");
    expect(memoryDatabase.messages.get(KEY)).toEqual([]);
  });
});

describe("StubbedChatDao.deleteAllMessages", () => {
  it("clears every message for the grid/tile key", async () => {
    await dao.addMessage(GRID, TILE, message({ text: "one" }));
    await dao.addMessage(GRID, TILE, message({ text: "two" }));

    await dao.deleteAllMessages(GRID, TILE);

    expect(memoryDatabase.messages.get(KEY)).toBeUndefined();
  });

  it("notifies subscribers after clearing", async () => {
    const callback = vi.fn();
    await dao.addMessage(GRID, TILE, message());
    dao.subscribeToMessages(GRID, TILE, callback);
    await flushMicrotasks();
    callback.mockClear();

    await dao.deleteAllMessages(GRID, TILE);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith([]);
  });

  it("leaves other grid/tile keys untouched", async () => {
    await dao.addMessage(GRID, TILE, message({ text: "a" }));
    await dao.addMessage("grid-2", "tile-2", message({ text: "b" }));

    await dao.deleteAllMessages(GRID, TILE);

    expect(
      memoryDatabase.messages.get("grid-2/tile-2")?.map((m) => m.text),
    ).toEqual(["b"]);
  });

  it("is a no-op but still notifies subscribers for an unknown key", async () => {
    const callback = vi.fn();
    dao.subscribeToMessages(GRID, TILE, callback);
    await flushMicrotasks();
    callback.mockClear();

    await dao.deleteAllMessages(GRID, TILE);
    await flushMicrotasks();

    expect(memoryDatabase.messages.get(KEY)).toBeUndefined();
    expect(callback).toHaveBeenCalledWith([]);
  });
});

describe("StubbedChatDao.subscribeToMessages", () => {
  it("delivers an empty list when there are no messages", async () => {
    const callback = vi.fn();
    dao.subscribeToMessages(GRID, TILE, callback);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith([]);
  });

  it("delivers updates when a message is added", async () => {
    const callback = vi.fn();
    dao.subscribeToMessages(GRID, TILE, callback);
    await flushMicrotasks();

    await dao.addMessage(GRID, TILE, message({ text: "live" }));
    await flushMicrotasks();

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1]?.[0];
    expect(lastCall.map((m: { text: string }) => m.text)).toEqual(["live"]);
  });

  it("stops delivering after unsubscribe", async () => {
    const callback = vi.fn();
    const unsubscribe = dao.subscribeToMessages(GRID, TILE, callback);
    await flushMicrotasks();
    callback.mockClear();

    unsubscribe();
    await dao.addMessage(GRID, TILE, message());
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });
});
