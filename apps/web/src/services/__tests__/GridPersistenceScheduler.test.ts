import { describe, expect, it, vi } from "vitest";
import { ContentType, type Grid } from "@grids/contracts/types";
import { GridPersistenceScheduler } from "@/services/GridPersistenceScheduler";
import type { GridPersistenceScope } from "@/services/interfaces/GridPersistenceSchedulerInterface";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeScope(
  gridId: string,
  sessionGeneration: number,
): GridPersistenceScope {
  return { gridId, sessionGeneration };
}

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Test Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    backgroundColor: "",
    ogImageSrc: "",
    themeId: "dark",
    duplicatable: false,
    tiles: [
      {
        i: "tile-1",
        x: 0,
        y: 0,
        w: 2,
        h: 2,
        borderEnabled: true,
        caption: "",
        content: { type: ContentType.TEXT, text: "Hello" },
      },
    ],
    overrides: {},
    ...overrides,
  } as Grid;
}

describe("GridPersistenceScheduler", () => {
  it("writes one scheduled snapshot", async () => {
    const write = vi.fn<(_: Grid) => Promise<void>>().mockResolvedValue();
    const scheduler = new GridPersistenceScheduler(write);
    const scope = makeScope("grid-1", 1);
    const snapshot = makeGrid({ name: "One" });

    scheduler.schedule(scope, snapshot);
    await scheduler.flush(scope);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ name: "One" }));
    expect(write.mock.calls[0]![0]).not.toBe(snapshot);
  });

  it("coalesces same-scope writes to the latest pending snapshot", async () => {
    const firstWrite = deferred<void>();
    const write = vi
      .fn<(_: Grid) => Promise<void>>()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue(undefined);
    const scheduler = new GridPersistenceScheduler(write);
    const scope = makeScope("grid-1", 1);

    scheduler.schedule(scope, makeGrid({ name: "First" }));
    scheduler.schedule(scope, makeGrid({ name: "Second" }));
    scheduler.schedule(scope, makeGrid({ name: "Third" }));
    const flushed = scheduler.flush(scope);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0].name).toBe("First");

    firstWrite.resolve();
    await flushed;

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]![0].name).toBe("Third");
  });

  it("uses independent lanes for different scopes", async () => {
    const firstWrite = deferred<void>();
    const write = vi
      .fn<(_: Grid) => Promise<void>>()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue(undefined);
    const scheduler = new GridPersistenceScheduler(write);
    const firstScope = makeScope("grid-1", 1);
    const secondScope = makeScope("grid-2", 1);

    scheduler.schedule(firstScope, makeGrid({ id: "grid-1", name: "First" }));
    scheduler.schedule(secondScope, makeGrid({ id: "grid-2", name: "Second" }));

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0]![0].id).toBe("grid-1");
    expect(write.mock.calls[1]![0].id).toBe("grid-2");

    firstWrite.resolve();
    await scheduler.flush(firstScope);
    await scheduler.flush(secondScope);
  });

  it("flush waits for in-flight and pending work to drain", async () => {
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const write = vi
      .fn<(_: Grid) => Promise<void>>()
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);
    const scheduler = new GridPersistenceScheduler(write);
    const scope = makeScope("grid-1", 1);
    let resolved = false;

    scheduler.schedule(scope, makeGrid({ name: "First" }));
    scheduler.schedule(scope, makeGrid({ name: "Second" }));
    const flushed = scheduler.flush(scope).then(() => {
      resolved = true;
    });

    firstWrite.resolve();
    await firstWrite.promise;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(resolved).toBe(false);
    expect(write).toHaveBeenCalledTimes(2);

    secondWrite.resolve();
    await flushed;

    expect(resolved).toBe(true);
  });

  it("flush is immediate when no lane work exists", async () => {
    const write = vi.fn<(_: Grid) => Promise<void>>();
    const scheduler = new GridPersistenceScheduler(write);

    await expect(scheduler.flush(makeScope("missing", 1))).resolves.toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects the matching flush when a write fails", async () => {
    const error = new Error("write failed");
    const write = vi.fn<(_: Grid) => Promise<void>>().mockRejectedValue(error);
    const scheduler = new GridPersistenceScheduler(write);
    const scope = makeScope("grid-1", 1);

    scheduler.schedule(scope, makeGrid());

    await expect(scheduler.flush(scope)).rejects.toThrow("write failed");
  });

  it("does not let one scope failure reject another scope flush", async () => {
    const error = new Error("old scope failed");
    const write = vi
      .fn<(_: Grid) => Promise<void>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    const scheduler = new GridPersistenceScheduler(write);
    const oldScope = makeScope("grid-1", 1);
    const newScope = makeScope("grid-2", 1);

    scheduler.schedule(oldScope, makeGrid({ id: "grid-1" }));
    scheduler.schedule(newScope, makeGrid({ id: "grid-2" }));

    await expect(scheduler.flush(oldScope)).rejects.toThrow("old scope failed");
    await expect(scheduler.flush(newScope)).resolves.toBeNull();
  });

  it("freezes queued snapshot contents at schedule time", async () => {
    const firstWrite = deferred<void>();
    const write = vi
      .fn<(_: Grid) => Promise<void>>()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue(undefined);
    const scheduler = new GridPersistenceScheduler(write);
    const scope = makeScope("grid-1", 1);
    const pending = makeGrid({ name: "Queued" });

    scheduler.schedule(scope, makeGrid({ name: "First" }));
    scheduler.schedule(scope, pending);
    pending.name = "Mutated after schedule";
    pending.tiles[0]!.caption = "Mutated";

    firstWrite.resolve();
    await scheduler.flush(scope);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]![0]).toEqual(
      expect.objectContaining({
        name: "Queued",
        tiles: [expect.objectContaining({ caption: "" })],
      }),
    );
  });

  it("resolves all flush waiters and cleans up drained lanes", async () => {
    const firstWrite = deferred<void>();
    const write = vi
      .fn<(_: Grid) => Promise<void>>()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue(undefined);
    const scheduler = new GridPersistenceScheduler(write);
    const scope = makeScope("grid-1", 1);

    scheduler.schedule(scope, makeGrid({ name: "First" }));
    const firstFlush = scheduler.flush(scope);
    const secondFlush = scheduler.flush(scope);

    firstWrite.resolve();

    await expect(firstFlush).resolves.toEqual(
      expect.objectContaining({ name: "First" }),
    );
    await expect(secondFlush).resolves.toEqual(
      expect.objectContaining({ name: "First" }),
    );
    await expect(scheduler.flush(scope)).resolves.toBeNull();

    scheduler.schedule(scope, makeGrid({ name: "After cleanup" }));
    await scheduler.flush(scope);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]![0].name).toBe("After cleanup");
  });

  it("carries the saved rev forward across consecutive queued writes", async () => {
    const firstWrite = deferred<Grid>();
    const write = vi
      .fn<(_: Grid) => Promise<Grid>>()
      .mockReturnValueOnce(firstWrite.promise)
      .mockImplementationOnce(async (snapshot) => ({
        ...snapshot,
        rev: (snapshot.rev ?? 0) + 1,
      }));
    const scheduler = new GridPersistenceScheduler(write);
    const scope = makeScope("grid-1", 1);

    scheduler.schedule(scope, makeGrid({ name: "First", rev: 0 }));
    scheduler.schedule(scope, makeGrid({ name: "Second", rev: 0 }));

    firstWrite.resolve(makeGrid({ name: "First", rev: 1 }));
    const saved = await scheduler.flush(scope);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]![0]).toEqual(
      expect.objectContaining({ name: "Second", rev: 1 }),
    );
    expect(saved).toEqual(expect.objectContaining({ name: "Second", rev: 2 }));
  });
});
