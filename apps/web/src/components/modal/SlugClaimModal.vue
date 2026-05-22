<template>
  <BaseModal
    :show="isOpen"
    variant="centered"
    :close-on-backdrop="hasExistingSlug"
    content-class="slug-modal-content"
    @close="handleClose"
  >
    <div class="modal-header">
      <h2>{{ hasExistingSlug ? 'Manage Your Handle' : 'Claim Your Handle' }}</h2>
      <button
        v-if="hasExistingSlug"
        class="close-btn"
        @click="handleClose"
        aria-label="Close"
      >
        <CloseXIcon :size="20" />
      </button>
    </div>

    <div class="modal-body">
      <p class="description">
        {{ hasExistingSlug
          ? 'Your handle is used in your personal URL. Change it carefully as links may break.'
          : 'Choose a unique handle for your personal URL. This will be used as grids.so/your-handle'
        }}
      </p>

      <div class="input-group">
        <label for="slug-input">Handle</label>
        <div class="slug-input-wrapper">
          <span class="slug-prefix">grids.so/</span>
          <input
            id="slug-input"
            ref="inputElement"
            v-model="slugInput"
            type="text"
            placeholder="your-handle"
            :disabled="isClaiming"
            @input="handleSlugInput"
            @keydown.enter="handleClaim"
            maxlength="30"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div class="validation-message" :class="[validationClass, { 'is-placeholder': !validationMessage }]">
          <template v-if="validationMessage">
            <CheckIcon v-if="validationClass === 'success'" :size="16" />
            <AlertCircleIcon v-else-if="validationClass === 'error'" :size="16" />
            <span>{{ validationMessage }}</span>
          </template>
          <span v-else>&nbsp;</span>
        </div>
      </div>

      <div class="format-hint">
        <strong>Format rules:</strong> 3-30 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.
      </div>
    </div>

    <div class="modal-footer">
      <Button
        v-if="hasExistingSlug"
        variant="secondary"
        @click="handleClose"
        :disabled="isClaiming"
        block
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        @click="handleClaim"
        :disabled="!canClaim || isClaiming"
        :loading="isClaiming"
        block
      >
        {{ hasExistingSlug ? 'Update Handle' : 'Claim Handle' }}
      </Button>
    </div>
    <Button
      v-if="!hasExistingSlug"
      variant="ghost"
      :disabled="isClaiming"
      block
      @click="handleSkip"
    >
      Skip for now
    </Button>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import BaseModal from './BaseModal.vue';
import Button from '@/components/ui-elements/Button.vue';
import CheckIcon from '@/components/icons/CheckIcon.vue';
import CloseXIcon from '@/components/icons/CloseXIcon.vue';
import AlertCircleIcon from '@/components/icons/AlertCircleIcon.vue';

const props = defineProps<{
  isOpen: boolean;
  currentSlug?: string;
  onSuccess?: (slug: string) => void;
  onClose?: () => void;
}>();

const emit = defineEmits<{
  close: [];
  success: [slug: string];
  skip: [];
}>();

const userService = getServiceFactory().getUserService();
const slugInput = ref(props.currentSlug || '');
const isChecking = ref(false);
const isClaiming = ref(false);
const validationMessage = ref('');
const validationClass = ref<'success' | 'error' | 'info'>('info');
const checkTimeout = ref<number | null>(null);
const checkAbortController = ref<AbortController | null>(null);
const inputElement = ref<HTMLInputElement | null>(null);

const hasExistingSlug = computed(() => !!props.currentSlug);

const canClaim = computed(() => {
  return slugInput.value.length >= 3 &&
         validationClass.value === 'success' &&
         !isClaiming.value;
});

const handleSlugInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value.toLowerCase();
  slugInput.value = value;

  if (checkTimeout.value) {
    clearTimeout(checkTimeout.value);
    checkTimeout.value = null;
  }

  if (checkAbortController.value) {
    checkAbortController.value.abort();
    checkAbortController.value = null;
  }

  isChecking.value = false;
  validationMessage.value = '';
  validationClass.value = 'info';

  if (value.length === 0) {
    return;
  }

  if (value.length < 3) {
    validationMessage.value = 'Handle must be at least 3 characters';
    validationClass.value = 'error';
    return;
  }

  if (value.length > 30) {
    validationMessage.value = 'Handle must be 30 characters or less';
    validationClass.value = 'error';
    return;
  }

  const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  if (!slugRegex.test(value)) {
    validationMessage.value = 'Invalid format. Use lowercase letters, numbers, and hyphens only';
    validationClass.value = 'error';
    return;
  }

  checkTimeout.value = window.setTimeout(() => {
    checkAvailability(value);
  }, 800);
};

const checkAvailability = async (slug: string) => {
  if (!slug || slug.length < 3) return;

  checkAbortController.value = new AbortController();
  const currentController = checkAbortController.value;

  isChecking.value = true;
  validationMessage.value = 'Checking availability...';
  validationClass.value = 'info';

  try {
    const result = await userService.checkSlugAvailability(slug);

    if (currentController === checkAbortController.value) {
      if (result.available) {
        validationMessage.value = result.message;
        validationClass.value = 'success';
      } else {
        validationMessage.value = result.message;
        validationClass.value = 'error';
      }
    }
  } catch (error: unknown) {
    if (currentController === checkAbortController.value) {
      validationMessage.value = error instanceof Error ? error.message : 'Failed to check availability';
      validationClass.value = 'error';
    }
  } finally {
    if (currentController === checkAbortController.value) {
      isChecking.value = false;
      checkAbortController.value = null;

      if (inputElement.value) {
        inputElement.value.focus();
      }
    }
  }
};

const handleClaim = async () => {
  if (!canClaim.value) return;

  isClaiming.value = true;
  const claimedSlug = slugInput.value;

  try {
    const result = await userService.claimSlug(claimedSlug);

    if (result.success) {
      emit('close');
      emit('success', claimedSlug);
      if (props.onSuccess) {
        props.onSuccess(claimedSlug);
      }
    }
  } catch (error: unknown) {
    validationMessage.value = error instanceof Error ? error.message : 'Failed to claim handle';
    validationClass.value = 'error';
    isClaiming.value = false;
  }
};

const handleClose = () => {
  if (isClaiming.value) return;
  if (!hasExistingSlug.value) return;

  emit('close');
  if (props.onClose) {
    props.onClose();
  }
};

const handleSkip = () => {
  if (isClaiming.value) return;
  emit('skip');
};

watch(() => props.currentSlug, (newSlug) => {
  if (newSlug) {
    slugInput.value = newSlug;
  }
});

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    isClaiming.value = false;
    validationMessage.value = '';
    validationClass.value = 'info';

    if (props.currentSlug) {
      slugInput.value = props.currentSlug;
      checkAvailability(props.currentSlug);
    }

    nextTick(() => {
      setTimeout(() => {
        inputElement.value?.focus();
      }, 100);
    });
  }
});
</script>

<style scoped>
:deep(.slug-modal-content) {
  padding: 0;
  width: min(500px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  box-sizing: border-box;
}

@media (max-width: 600px) {
  :deep(.slug-modal-content) {
    width: calc(100% - var(--spacing-md) * 2);
    max-height: 100dvh;
    margin: var(--spacing-md);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: var(--tile-border-width) solid var(--color-tile-stroke);
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--color-text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--color-content-default);
  cursor: pointer;
  padding: var(--spacing-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--easing-smooth);
}

.close-btn:hover {
  background-color: var(--color-content-background);
  color: var(--color-text-primary);
}

.modal-body {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.description {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
  line-height: 1.5;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.input-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.slug-input-wrapper {
  display: flex;
  align-items: center;
  background-color: var(--color-content-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  overflow: hidden;
  transition: border-color var(--duration-fast) var(--easing-smooth);
}

.slug-input-wrapper:focus-within {
  border-color: var(--color-content-high);
}

.slug-prefix {
  padding: var(--spacing-sm);
  color: var(--color-content-default);
  font-size: 14px;
  white-space: nowrap;
  user-select: none;
}

.slug-input-wrapper input {
  flex: 1;
  border: none;
  background: transparent;
  padding: var(--spacing-sm);
  padding-left: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-family: var(--font-family-base);
  outline: none;
}

.slug-input-wrapper input::placeholder {
  color: var(--color-content-low);
}

.validation-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 13px;
  min-height: 24px;
  padding: var(--spacing-xs) 0;
}

.validation-message.is-placeholder {
  visibility: hidden;
}

.validation-message.success {
  color: #4ade80;
}

.validation-message.error {
  color: #f87171;
}

.validation-message.info {
  color: var(--color-content-default);
}

.format-hint {
  font-size: 12px;
  color: var(--color-content-low);
  padding: var(--spacing-sm);
  background-color: var(--color-content-background);
  border-radius: var(--radius-sm);
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  border-top: var(--tile-border-width) solid var(--color-tile-stroke);
}

@media (max-width: 600px) {
  .modal-header {
    padding: var(--spacing-md);
  }

  .modal-header h2 {
    font-size: 18px;
  }

  .modal-body {
    padding: var(--spacing-md);
    gap: var(--spacing-sm);
  }

  .modal-footer {
    padding: var(--spacing-md);
  }

  .slug-prefix {
    font-size: 13px;
  }

  .slug-input-wrapper input {
    font-size: 16px;
  }
}
</style>
