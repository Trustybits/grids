import { onMounted, onUnmounted, ref } from "vue";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import type {
  CreateGridTransferResponse,
  GridTransfer,
  GridTransferRecipientRef,
  PreviewGridTransferAcceptanceResponse,
} from "@grids/contracts/types";

type ServiceFactory = ReturnType<typeof getServiceFactory>;
type GridTransferService = ReturnType<ServiceFactory["getGridTransferService"]>;

interface UseGridTransfersOptions {
  /** Subscribe to transfers where the current user is the recipient. */
  incoming?: boolean;
  /** Subscribe to transfers where the current user is the sender. */
  outgoing?: boolean;
}

/**
 * Reactive access to the current user's pending grid transfers plus thin
 * wrappers around the transfer callables. Subscriptions default to pending
 * status (the DAO's default) and are torn down automatically on unmount.
 *
 * Both participants use this: the dashboard watches `incoming` to offer
 * Accept/Decline, and grid settings watch `outgoing` to reflect a pending
 * invitation and offer Cancel.
 */
export function useGridTransfers(options: UseGridTransfersOptions = {}) {
  const { incoming: watchIncoming = true, outgoing: watchOutgoing = true } =
    options;

  const incoming = ref<GridTransfer[]>([]);
  const outgoing = ref<GridTransfer[]>([]);

  let service: GridTransferService | null = null;
  let unsubIncoming: (() => void) | null = null;
  let unsubOutgoing: (() => void) | null = null;

  const getService = (): GridTransferService => {
    service ??= getServiceFactory().getGridTransferService();
    return service;
  };

  const start = (): void => {
    const userId = getAuthProvider().getCurrentUserId();
    if (!userId) return;
    const svc = getService();
    if (watchIncoming) {
      unsubIncoming = svc.subscribeIncomingTransfers(userId, (transfers) => {
        incoming.value = transfers;
      });
    }
    if (watchOutgoing) {
      unsubOutgoing = svc.subscribeOutgoingTransfers(userId, (transfers) => {
        outgoing.value = transfers;
      });
    }
  };

  const stop = (): void => {
    unsubIncoming?.();
    unsubOutgoing?.();
    unsubIncoming = null;
    unsubOutgoing = null;
  };

  onMounted(start);
  onUnmounted(stop);

  const createTransfer = (
    gridId: string,
    recipient: GridTransferRecipientRef,
    removeOrphanedFiles: boolean,
  ): Promise<CreateGridTransferResponse> =>
    getService().createTransfer(gridId, recipient, removeOrphanedFiles);

  const previewTransferAcceptance = (
    transferId: string,
  ): Promise<PreviewGridTransferAcceptanceResponse> =>
    getService().previewTransferAcceptance(transferId);

  const acceptTransfer = (transferId: string) =>
    getService().acceptTransfer(transferId);

  const declineTransfer = (transferId: string) =>
    getService().declineTransfer(transferId);

  const cancelTransfer = (transferId: string) =>
    getService().cancelTransfer(transferId);

  /** The pending outgoing transfer for a given grid, if any. */
  const pendingOutgoingForGrid = (gridId: string): GridTransfer | undefined =>
    outgoing.value.find((t) => t.gridId === gridId && t.status === "pending");

  return {
    incoming,
    outgoing,
    createTransfer,
    previewTransferAcceptance,
    acceptTransfer,
    declineTransfer,
    cancelTransfer,
    pendingOutgoingForGrid,
  };
}
