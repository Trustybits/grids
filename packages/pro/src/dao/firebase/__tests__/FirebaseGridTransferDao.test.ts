import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { FirebaseGridTransferDao } from "../FirebaseGridTransferDao.js";

const fakeDb = {} as Firestore;

function fakeSnapshot(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  };
}

function fakeQuerySnapshot(docs: ReturnType<typeof fakeSnapshot>[]) {
  return { docs };
}

describe("FirebaseGridTransferDao", () => {
  let dao: FirebaseGridTransferDao;

  beforeEach(() => {
    dao = new FirebaseGridTransferDao(fakeDb);
  });

  it("queries pending incoming transfers ordered by creation time", async () => {
    vi.mocked(collection).mockReturnValue("collectionRef" as any);
    vi.mocked(where)
      .mockReturnValueOnce("toUserClause" as any)
      .mockReturnValueOnce("statusClause" as any);
    vi.mocked(orderBy).mockReturnValue("orderClause" as any);
    vi.mocked(query).mockReturnValue("queryRef" as any);
    vi.mocked(getDocs).mockResolvedValue(
      fakeQuerySnapshot([
        fakeSnapshot("transfer-1", {
          gridId: "grid-1",
          toUserId: "recipient",
          status: "pending",
        }),
      ]) as any,
    );

    const result = await dao.listIncomingTransfers("recipient");

    expect(collection).toHaveBeenCalledWith(fakeDb, "gridTransfers");
    expect(where).toHaveBeenNthCalledWith(1, "toUserId", "==", "recipient");
    expect(where).toHaveBeenNthCalledWith(2, "status", "==", "pending");
    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(query).toHaveBeenCalledWith(
      "collectionRef",
      "toUserClause",
      "statusClause",
      "orderClause",
    );
    expect(getDocs).toHaveBeenCalledWith("queryRef");
    expect(result).toEqual([
      {
        id: "transfer-1",
        gridId: "grid-1",
        toUserId: "recipient",
        status: "pending",
      },
    ]);
  });

  it("queries outgoing transfers for the requested status", async () => {
    vi.mocked(collection).mockReturnValue("collectionRef" as any);
    vi.mocked(where)
      .mockReturnValueOnce("fromUserClause" as any)
      .mockReturnValueOnce("statusClause" as any);
    vi.mocked(orderBy).mockReturnValue("orderClause" as any);
    vi.mocked(query).mockReturnValue("queryRef" as any);
    vi.mocked(getDocs).mockResolvedValue(fakeQuerySnapshot([]) as any);

    await dao.listOutgoingTransfers("sender", "accepted");

    expect(where).toHaveBeenNthCalledWith(1, "fromUserId", "==", "sender");
    expect(where).toHaveBeenNthCalledWith(2, "status", "==", "accepted");
  });

  it("subscribes and maps snapshots to transfer records", () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    vi.mocked(collection).mockReturnValue("collectionRef" as any);
    vi.mocked(where).mockReturnValue("clause" as any);
    vi.mocked(orderBy).mockReturnValue("orderClause" as any);
    vi.mocked(query).mockReturnValue("queryRef" as any);
    vi.mocked(onSnapshot).mockImplementation((_queryRef: any, next: any) => {
      next(
        fakeQuerySnapshot([
          fakeSnapshot("transfer-1", {
            gridId: "grid-1",
            status: "pending",
          }),
        ]),
      );
      return unsubscribe;
    });

    const result = dao.subscribeIncomingTransfers("recipient", callback);

    expect(onSnapshot).toHaveBeenCalledWith(
      "queryRef",
      expect.any(Function),
      expect.any(Function),
    );
    expect(callback).toHaveBeenCalledWith([
      {
        id: "transfer-1",
        gridId: "grid-1",
        status: "pending",
      },
    ]);
    expect(result).toBe(unsubscribe);
  });
});
