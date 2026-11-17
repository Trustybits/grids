import { describe, expect, it, vi } from "vitest";
import { applyTileWrites, type TileWriteTarget } from "../applyTileWrites";

const makeTarget = (opens = true) => {
  const calls: string[] = [];
  const target: TileWriteTarget = {
    beginHistoryBatch: vi.fn(() => {
      calls.push("begin");
      return opens;
    }),
    commitHistoryBatch: vi.fn(() => {
      calls.push("commit");
    }),
    patchTileContent: vi.fn((id) => {
      calls.push(`content:${id}`);
    }),
    setTileBorder: vi.fn((id, on) => {
      calls.push(`border:${id}:${on}`);
    }),
    updateCaption: vi.fn(({ tileId }) => {
      calls.push(`caption:${tileId}`);
    }),
  };
  return { target, calls };
};

describe("applyTileWrites", () => {
  it("wraps every write in one history batch", () => {
    const { target, calls } = makeTarget();

    applyTileWrites(
      target,
      [
        { tileId: "a", write: { borderEnabled: false } },
        {
          tileId: "b",
          write: { content: { backgroundColor: "red" }, caption: "x" },
        },
      ],
      "Edit 2 tiles",
    );

    expect(target.beginHistoryBatch).toHaveBeenCalledWith("Edit 2 tiles");
    expect(calls).toEqual([
      "begin",
      "border:a:false",
      "content:b",
      "caption:b",
      "commit",
    ]);
  });

  it("leaves an already-open batch for its opener to commit", () => {
    const { target } = makeTarget(false);
    applyTileWrites(
      target,
      [{ tileId: "a", write: { borderEnabled: true } }],
      "Inside a popover",
    );
    expect(target.commitHistoryBatch).not.toHaveBeenCalled();
  });

  it("does nothing with no writes", () => {
    const { target } = makeTarget();
    applyTileWrites(target, [], "Nothing");
    expect(target.beginHistoryBatch).not.toHaveBeenCalled();
  });

  it("still closes the batch if a write throws", () => {
    const { target } = makeTarget();
    vi.mocked(target.patchTileContent).mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() =>
      applyTileWrites(
        target,
        [{ tileId: "a", write: { content: {} } }],
        "Failing",
      ),
    ).toThrow("boom");
    expect(target.commitHistoryBatch).toHaveBeenCalledTimes(1);
  });
});
