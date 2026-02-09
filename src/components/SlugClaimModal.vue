<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="hasExistingSlug ? handleClose() : null">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ hasExistingSlug ? 'Manage Your Handle' : 'Claim Your Handle' }}</h2>
        <button 
          v-if="hasExistingSlug" 
          class="close-btn" 
          @click="handleClose" 
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
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
          
          <div v-if="validationMessage" class="validation-message" :class="validationClass">
            <svg v-if="validationClass === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <svg v-else-if="validationClass === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <span>{{ validationMessage }}</span>
          </div>
        </div>

        <div class="format-hint">
          <strong>Format rules:</strong> 3-30 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.
        </div>
      </div>

      <div class="modal-footer">
        <button 
          v-if="hasExistingSlug" 
          class="btn-secondary" 
          @click="handleClose" 
          :disabled="isClaiming"
        >
          Cancel
        </button>
        <button 
          class="btn-primary" 
          :class="{ 'btn-full-width': !hasExistingSlug }"
          @click="handleClaim" 
          :disabled="!canClaim || isClaiming"
        >
          {{ isClaiming ? 'Claiming...' : hasExistingSlug ? 'Update Handle' : 'Claim Handle' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { checkSlugAvailability, claimSlug } from '@/services/UserProfileService';

const props = defineProps<{
  isOpen: boolean;
  currentSlug?: string;
  onSuccess?: (slug: string) => void;
  onClose?: () => void;
}>();

const emit = defineEmits<{
  close: [];
  success: [slug: string];
}>();

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

/**
 * Handle slug input changes with validation
 */
const handleSlugInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value.toLowerCase();
  slugInput.value = value;

  // Cancel any pending check timeout
  if (checkTimeout.value) {
    clearTimeout(checkTimeout.value);
    checkTimeout.value = null;
  }

  // Cancel any ongoing availability check
  if (checkAbortController.value) {
    checkAbortController.value.abort();
    checkAbortController.value = null;
  }

  // Reset checking state immediately so input stays enabled
  isChecking.value = false;

  // Reset validation state
  validationMessage.value = '';
  validationClass.value = 'info';

  // Basic client-side validation
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

  // Check format
  const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  if (!slugRegex.test(value)) {
    validationMessage.value = 'Invalid format. Use lowercase letters, numbers, and hyphens only';
    validationClass.value = 'error';
    return;
  }

  // Debounce server-side availability check (increased to 800ms for better typing experience)
  checkTimeout.value = window.setTimeout(() => {
    checkAvailability(value);
  }, 800);
};

/**
 * Check slug availability with server
 */
const checkAvailability = async (slug: string) => {
  if (!slug || slug.length < 3) return;

  // Create new abort controller for this check
  checkAbortController.value = new AbortController();
  const currentController = checkAbortController.value;

  isChecking.value = true;
  validationMessage.value = 'Checking availability...';
  validationClass.value = 'info';

  try {
    const result = await checkSlugAvailability(slug);
    
    // Only update UI if this check wasn't aborted
    if (currentController === checkAbortController.value) {
      if (result.available) {
        validationMessage.value = result.message;
        validationClass.value = 'success';
      } else {
        validationMessage.value = result.message;
        validationClass.value = 'error';
      }
    }
  } catch (error: any) {
    // Only show error if this check wasn't aborted
    if (currentController === checkAbortController.value) {
      validationMessage.value = error.message || 'Failed to check availability';
      validationClass.value = 'error';
    }
  } finally {
    // Only clear checking state if this check wasn't aborted
    if (currentController === checkAbortController.value) {
      isChecking.value = false;
      checkAbortController.value = null;
      
      // Refocus the input to maintain typing context
      if (inputElement.value) {
        inputElement.value.focus();
      }
    }
  }
};

/**
 * Claim the slug
 */
const handleClaim = async () => {
  if (!canClaim.value) return;

  isClaiming.value = true;
  const claimedSlug = slugInput.value;
  
  try {
    const result = await claimSlug(claimedSlug);
    
    if (result.success) {
      // Close modal immediately for responsive feel
      emit('close');
      
      // Emit success event after closing (parent handles the rest)
      emit('success', claimedSlug);
      if (props.onSuccess) {
        props.onSuccess(claimedSlug);
      }
    }
  } catch (error: any) {
    validationMessage.value = error.message || 'Failed to claim handle';
    validationClass.value = 'error';
    isClaiming.value = false;
  }
  // Don't reset isClaiming on success - modal is closing anyway
};

/**
 * Close modal - only allowed if user has an existing slug
 */
const handleClose = () => {
  if (isClaiming.value) return;
  // Don't allow closing if this is a required claim (no existing slug)
  if (!hasExistingSlug.value) return;
  
  emit('close');
  if (props.onClose) {
    props.onClose();
  }
};

// Watch for prop changes
watch(() => props.currentSlug, (newSlug) => {
  if (newSlug) {
    slugInput.value = newSlug;
  }
});

// Reset modal state and trigger initial check when opened
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset state to prevent stuck claiming state
    isClaiming.value = false;
    validationMessage.value = '';
    validationClass.value = 'info';
    
    if (props.currentSlug) {
      slugInput.value = props.currentSlug;
      checkAvailability(props.currentSlug);
    }
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-lg);
  backdrop-filter: blur(4px);
}

.modal-content {
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-lg);
  width: min(500px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
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
  padding: var(--spacing-xs) 0;
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

.btn-secondary,
.btn-primary {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
  border: none;
  font-family: var(--font-family-base);
}

.btn-secondary {
  background-color: var(--color-content-background);
  color: var(--color-text-primary);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-tile-background);
  border-color: var(--color-content-high);
}

.btn-primary {
  background-color: var(--primary-color);
  color: var(--color-text-primary);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-content-high);
}

.btn-secondary:disabled,
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-full-width {
  flex: 1 1 100%;
}
</style>
