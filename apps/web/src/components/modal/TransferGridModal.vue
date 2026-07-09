<template>
  <BaseModal :show="show" variant="centered" mobile-sheet @close="handleClose">
    <div class="tg">
      <h3 class="tg__title">Transfer Grid</h3>
      <p class="tg__subtitle">
        Give <strong>{{ gridName }}</strong> to another Grids user.
      </p>

      <div class="tg__warning" role="alert">
        <WarningTriangleIcon :size="18" class="tg__warning-icon" />
        <span>
          Transferring is permanent. Once the recipient accepts, the grid and
          its files move to them and you lose access — this can't be undone.
        </span>
      </div>

      <label class="tg__field">
        <span class="tg__label">Recipient email or slug</span>
        <input
          ref="inputEl"
          v-model="recipientInput"
          type="text"
          class="tg__input"
          placeholder="name@example.com or their-slug"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          @keyup.enter="handleConfirm"
          @keyup.esc="handleClose"
          @input="errorMsg = null"
        />
      </label>

      <div class="tg__remove">
        <Toggle
          v-model="removeFiles"
          label="Remove files used only in this grid"
        />
        <FloatingTooltip
          text="Permanently deletes files from your File Archive that appear only on this grid. Files you also use in your other grids are always kept."
          placement="top"
        >
          <button type="button" class="tg__info" aria-label="What does this do?">
            <InfoCircleIcon :size="16" />
          </button>
        </FloatingTooltip>
      </div>
      <p class="tg__remove-hint">
        {{
          removeFiles
            ? "Files used only here will be removed from your archive after the transfer."
            : "You'll keep a copy of every file in your File Archive (default)."
        }}
      </p>

      <p v-if="errorMsg" class="tg__error">{{ errorMsg }}</p>

      <div class="tg__actions">
        <Button variant="secondary" :disabled="submitting" @click="handleClose">
          Cancel
        </Button>
        <Button
          variant="primary"
          :disabled="!canConfirm"
          :loading="submitting"
          @click="handleConfirm"
        >
          Send Transfer
        </Button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useToastStore } from "@/stores/toast";
import { describeCallableError } from "@/utils/CallableError";
import type {
  CreateGridTransferResponse,
  GridTransferRecipientRef,
} from "@grids/contracts/types";
import BaseModal from "./BaseModal.vue";
import Button from "@/components/ui-elements/Button.vue";
import Toggle from "@/components/ui-controls/Toggle.vue";
import FloatingTooltip from "@/components/ui-elements/FloatingTooltip.vue";
import WarningTriangleIcon from "@/components/icons/WarningTriangleIcon.vue";
import InfoCircleIcon from "@/components/icons/InfoCircleIcon.vue";

const props = defineProps<{
  show: boolean;
  gridId: string;
  gridName: string;
}>();

const emit = defineEmits<{
  close: [];
  sent: [response: CreateGridTransferResponse];
}>();

const toast = useToastStore();

const recipientInput = ref("");
const removeFiles = ref(false);
const submitting = ref(false);
const errorMsg = ref<string | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);

const canConfirm = computed(
  () => !submitting.value && recipientInput.value.trim().length > 0,
);

watch(
  () => props.show,
  async (open) => {
    if (!open) return;
    recipientInput.value = "";
    removeFiles.value = false;
    errorMsg.value = null;
    submitting.value = false;
    await nextTick();
    setTimeout(() => inputEl.value?.focus(), 50);
  },
);

const handleClose = () => {
  if (submitting.value) return;
  emit("close");
};

const handleConfirm = async () => {
  const raw = recipientInput.value.trim();
  if (!raw || submitting.value) return;

  // A single field accepts either an email or a slug: the presence of "@"
  // decides which; the server resolves and validates the recipient.
  const recipient: GridTransferRecipientRef = raw.includes("@")
    ? { email: raw }
    : { slug: raw };

  submitting.value = true;
  errorMsg.value = null;
  try {
    const response = await getServiceFactory()
      .getGridTransferService()
      .createTransfer(props.gridId, recipient, removeFiles.value);
    toast.addToast(`Transfer invitation sent to ${raw}`, "success");
    emit("sent", response);
    emit("close");
  } catch (err) {
    errorMsg.value = describeCallableError(
      err,
      "Couldn't send the transfer. Double-check the email or slug and try again.",
    );
  } finally {
    submitting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.tg {
  display: flex;
  flex-direction: column;
}

.tg__title {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.tg__subtitle {
  margin: 0 0 var(--spacing-lg);
  color: var(--color-content-default);
  font-size: var(--font-size-md);
  line-height: 1.5;

  strong {
    color: var(--color-text-primary);
  }
}

.tg__warning {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-md);
  background-color: color-mix(
    in srgb,
    var(--color-figma-red) 12%,
    transparent
  );
  border: var(--border-width) solid
    color-mix(in srgb, var(--color-figma-red) 30%, transparent);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.45;
}

.tg__warning-icon {
  flex-shrink: 0;
  color: var(--color-figma-red);
  margin-top: 1px;
}

.tg__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-lg);
}

.tg__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-content-low);
}

.tg__input {
  width: 100%;
  padding: var(--spacing-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--duration-fast) var(--easing-smooth);

  &:focus {
    border-color: var(--color-content-default);
    background-color: var(--color-tile-background);
  }

  &::placeholder {
    color: var(--color-content-default);
    opacity: 0.6;
  }
}

.tg__remove {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.tg__remove :deep(.toggle) {
  flex: 1;
  min-width: 0;
}

.tg__info {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-low);
  cursor: help;
  transition: color var(--duration-fast) var(--easing-smooth);

  &:hover {
    color: var(--color-text-primary);
  }
}

.tg__remove-hint {
  margin: var(--spacing-xs) 0 0 var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-content-low);
  line-height: 1.4;
}

.tg__error {
  margin: var(--spacing-md) 0 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-figma-red) 12%, transparent);
  color: var(--color-figma-red);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.tg__actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
  margin-top: var(--spacing-xl);
}
</style>
