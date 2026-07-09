<template>
  <section v-if="incoming.length" class="pgt">
    <h3 class="pgt__heading">Incoming Transfers</h3>
    <ul class="pgt__list">
      <li v-for="transfer in incoming" :key="transfer.id" class="pgt__card">
        <div class="pgt__info">
          <span class="pgt__grid-name">{{ transfer.gridName }}</span>
          <span class="pgt__from">from {{ senderLabel(transfer) }}</span>
        </div>
        <div class="pgt__actions">
          <Button
            variant="secondary"
            size="sm"
            :disabled="isBusy(transfer.id)"
            :loading="decliningId === transfer.id"
            @click="onDecline(transfer)"
          >
            Decline
          </Button>
          <Button
            variant="primary"
            size="sm"
            :disabled="isBusy(transfer.id)"
            @click="onAcceptClick(transfer)"
          >
            Accept
          </Button>
        </div>
      </li>
    </ul>
  </section>

  <!-- Accept confirmation: preview quota + files before committing. -->
  <BaseModal
    :show="!!acceptTarget"
    variant="centered"
    mobile-sheet
    @close="closeAccept"
  >
    <div class="pgt-accept">
      <h3 class="pgt-accept__title">Accept transfer</h3>
      <p class="pgt-accept__subtitle" v-if="acceptTarget">
        <strong>{{ acceptTarget.gridName }}</strong> will be added to your grids.
      </p>

      <div v-if="previewLoading" class="pgt-accept__state">
        Checking storage impact…
      </div>

      <div v-else-if="previewError" class="pgt-accept__state pgt-accept__state--error">
        {{ previewError }}
      </div>

      <template v-else-if="preview">
        <div
          class="pgt-accept__quota"
          :class="{ 'is-over': preview.wouldExceedQuota }"
        >
          <div class="pgt-accept__quota-row">
            <span>Storage this will use</span>
            <strong>{{ formatBytes(preview.additionalBytesRequired) }}</strong>
          </div>
          <div class="pgt-accept__quota-row pgt-accept__quota-row--sub">
            <span>Remaining after transfer</span>
            <span>
              {{
                formatBytes(
                  Math.max(
                    0,
                    preview.recipientQuotaRemaining -
                      preview.additionalBytesRequired,
                  ),
                )
              }}
            </span>
          </div>
        </div>

        <p v-if="preview.wouldExceedQuota" class="pgt-accept__over">
          Not enough storage to accept this grid. Free up space in your File
          Archive and try again.
        </p>

        <p v-if="preview.nonCopiableCount > 0" class="pgt-accept__note">
          {{ preview.nonCopiableCount }}
          {{ preview.nonCopiableCount === 1 ? "file" : "files" }} can't be
          copied and will be replaced with placeholders.
        </p>

        <div v-if="preview.files.length" class="pgt-accept__files">
          <div class="pgt-accept__files-label">
            Files copied to your archive
          </div>
          <ul class="pgt-accept__file-list scrollable-thin">
            <li
              v-for="file in preview.files"
              :key="file.hash"
              class="pgt-accept__file"
            >
              <div class="pgt-accept__file-main">
                <span class="pgt-accept__file-name" :title="file.displayName">
                  {{ file.displayName }}
                </span>
                <span class="pgt-accept__file-badge">
                  {{ kindLabel(file.kind) }}
                </span>
              </div>
              <span v-if="file.alreadyOwned" class="pgt-accept__file-owned">
                Already in your archive
              </span>
              <span v-else class="pgt-accept__file-size">
                {{ formatBytes(file.size) }}
              </span>
            </li>
          </ul>
        </div>
      </template>

      <div class="pgt-accept__actions">
        <Button variant="secondary" :disabled="accepting" @click="closeAccept">
          Cancel
        </Button>
        <Button
          variant="primary"
          :disabled="!canConfirm"
          :loading="accepting"
          @click="confirmAccept"
        >
          Confirm Transfer
        </Button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToastStore } from "@/stores/toast";
import { useGridTransfers } from "@/composables/useGridTransfers";
import { formatBytes } from "@/utils/StorageFormat";
import { describeCallableError } from "@/utils/CallableError";
import type {
  GridTransfer,
  PreviewGridTransferAcceptanceResponse,
  UploadKind,
} from "@grids/contracts/types";
import BaseModal from "@/components/modal/BaseModal.vue";
import Button from "@/components/ui-elements/Button.vue";

const emit = defineEmits<{
  accepted: [transfer: GridTransfer];
}>();

const toast = useToastStore();
const {
  incoming,
  previewTransferAcceptance,
  acceptTransfer,
  declineTransfer,
} = useGridTransfers({ outgoing: false });

const KIND_LABELS: Record<UploadKind, string> = {
  images: "Image",
  videos: "Video",
  documents: "Document",
};

const decliningId = ref<string | null>(null);
const acceptTarget = ref<GridTransfer | null>(null);
const preview = ref<PreviewGridTransferAcceptanceResponse | null>(null);
const previewLoading = ref(false);
const previewError = ref<string | null>(null);
const accepting = ref(false);

const canConfirm = computed(
  () =>
    !accepting.value &&
    !previewLoading.value &&
    !!preview.value &&
    !preview.value.wouldExceedQuota,
);

const isBusy = (transferId: string): boolean =>
  decliningId.value === transferId || acceptTarget.value?.id === transferId;

const senderLabel = (transfer: GridTransfer): string => {
  if (transfer.fromSlug) return `@${transfer.fromSlug}`;
  if (transfer.fromEmail) return transfer.fromEmail;
  return "another user";
};

const kindLabel = (kind: UploadKind): string => KIND_LABELS[kind];

const onDecline = async (transfer: GridTransfer) => {
  decliningId.value = transfer.id;
  try {
    await declineTransfer(transfer.id);
    toast.addToast("Transfer declined", "success");
  } catch (err) {
    toast.addToast(
      describeCallableError(err, "Couldn't decline the transfer. Please try again."),
      "error",
    );
  } finally {
    decliningId.value = null;
  }
};

const onAcceptClick = async (transfer: GridTransfer) => {
  acceptTarget.value = transfer;
  preview.value = null;
  previewError.value = null;
  previewLoading.value = true;
  try {
    preview.value = await previewTransferAcceptance(transfer.id);
  } catch (err) {
    previewError.value = describeCallableError(
      err,
      "Couldn't check the storage impact. Please try again.",
    );
  } finally {
    previewLoading.value = false;
  }
};

const closeAccept = () => {
  if (accepting.value) return;
  acceptTarget.value = null;
  preview.value = null;
  previewError.value = null;
};

const confirmAccept = async () => {
  const transfer = acceptTarget.value;
  if (!transfer || !canConfirm.value) return;
  accepting.value = true;
  try {
    await acceptTransfer(transfer.id);
    toast.addToast(`${transfer.gridName} is now yours`, "success");
    emit("accepted", transfer);
    acceptTarget.value = null;
    preview.value = null;
  } catch (err) {
    toast.addToast(
      describeCallableError(err, "Couldn't accept the transfer. Please try again."),
      "error",
    );
  } finally {
    accepting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.pgt {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.pgt__heading {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-content-default);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.pgt__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.pgt__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: var(--border-width) solid
    color-mix(in srgb, var(--color-figma-purple) 35%, var(--color-stroke));
  border-radius: var(--radius-md);
  background-color: color-mix(
    in srgb,
    var(--color-figma-purple) 8%,
    transparent
  );
}

.pgt__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pgt__grid-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pgt__from {
  font-size: var(--font-size-sm);
  color: var(--color-content-low);
}

.pgt__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.pgt-accept {
  display: flex;
  flex-direction: column;
}

.pgt-accept__title {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.pgt-accept__subtitle {
  margin: 0 0 var(--spacing-lg);
  color: var(--color-content-default);
  font-size: var(--font-size-md);
  line-height: 1.5;

  strong {
    color: var(--color-text-primary);
  }
}

.pgt-accept__state {
  padding: var(--spacing-xl) 0;
  text-align: center;
  color: var(--color-content-low);
  font-size: var(--font-size-md);

  &--error {
    color: var(--color-figma-red);
  }
}

.pgt-accept__quota {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--color-content-background);
  border: var(--border-width) solid var(--color-stroke);

  &.is-over {
    border-color: color-mix(in srgb, var(--color-figma-red) 40%, transparent);
  }
}

.pgt-accept__quota-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);

  strong {
    font-variant-numeric: tabular-nums;
  }

  &--sub {
    font-size: var(--font-size-sm);
    color: var(--color-content-low);
  }
}

.pgt-accept__over {
  margin: var(--spacing-md) 0 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-figma-red) 12%, transparent);
  color: var(--color-figma-red);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.pgt-accept__note {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-content-low);
  line-height: 1.4;
}

.pgt-accept__files {
  margin-top: var(--spacing-lg);
}

.pgt-accept__files-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-content-low);
  margin-bottom: var(--spacing-xs);
}

.pgt-accept__file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  max-height: 220px;
  overflow-y: auto;
}

.pgt-accept__file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  background-color: var(--color-content-background);
}

.pgt-accept__file-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.pgt-accept__file-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pgt-accept__file-badge {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 999px;
  background-color: var(--color-tile-background);
  border: var(--border-width) solid var(--color-stroke);
  color: var(--color-content-default);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
}

.pgt-accept__file-size {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--color-content-low);
  font-variant-numeric: tabular-nums;
}

.pgt-accept__file-owned {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-content-low);
  font-style: italic;
}

.pgt-accept__actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
  margin-top: var(--spacing-xl);
}
</style>
