<template>
  <BaseModal
    :show="isOpen"
    variant="centered"
    mobile-sheet
    :close-on-backdrop="!isBusy"
    content-class="change-email-modal-content"
    @close="handleClose"
  >
    <div class="modal-header">
      <h2>{{ title }}</h2>
      <button class="close-btn" aria-label="Close" :disabled="isBusy" @click="handleClose">
        <CloseXIcon :size="20" />
      </button>
    </div>

    <!-- Step 1: enter the new address -->
    <template v-if="step === 'enter'">
      <div class="modal-body">
        <p class="description">
          We'll send a confirmation link to your new address. Your email only
          changes once you open it, and we'll let your current address know.
        </p>
        <div class="current-email">
          <span class="current-email__label">Current email</span>
          <span class="current-email__value">{{ currentEmail || 'Not set' }}</span>
        </div>
        <div class="input-group">
          <label for="change-email-input">New email</label>
          <input
            id="change-email-input"
            ref="inputElement"
            v-model="newEmail"
            class="text-input"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            placeholder="you@example.com"
            :disabled="isBusy"
            @keydown.enter.prevent="submitChange"
          />
          <p
            class="status-text"
            :class="{ 'is-error': !!errorText, 'is-placeholder': !errorText && !validationText }"
            :role="errorText ? 'alert' : undefined"
          >
            {{ errorText || validationText }}
          </p>
        </div>
      </div>
      <div class="modal-footer">
        <Button variant="secondary" block :disabled="isBusy" @click="handleClose">Cancel</Button>
        <Button
          variant="primary"
          block
          :disabled="!canSubmit || isBusy"
          :loading="isBusy"
          @click="submitChange"
        >
          Send confirmation
        </Button>
      </div>
    </template>

    <!-- Step 2: confirm it's really them -->
    <template v-else-if="step === 'reauth'">
      <div class="modal-body">
        <template v-if="reauthLinkSent">
          <p class="description">
            We sent a confirmation link to <strong>{{ currentEmail }}</strong>.
            Open it on this device to continue — we'll then send the
            confirmation to <strong>{{ newEmail.trim() }}</strong>.
          </p>
        </template>
        <template v-else>
          <p class="description">
            For your security, please confirm it's you before changing your
            email to <strong>{{ newEmail.trim() }}</strong>.
          </p>
          <Button
            v-if="signInMethods.includes('google')"
            variant="secondary"
            block
            :disabled="isBusy"
            :loading="isBusy && reauthMethod === 'google'"
            @click="reauthWithGoogle"
          >
            <template #icon-left>
              <i class="fab fa-google"></i>
            </template>
            Confirm with Google
          </Button>
          <Button
            v-if="signInMethods.includes('emailLink') && currentEmail"
            variant="secondary"
            block
            :disabled="isBusy"
            :loading="isBusy && reauthMethod === 'emailLink'"
            @click="reauthWithEmailLink"
          >
            <template #icon-left>
              <EmailIcon width="16" height="16" />
            </template>
            Email a link to {{ currentEmail }}
          </Button>
        </template>
        <p v-if="errorText" class="status-text is-error" role="alert">{{ errorText }}</p>
      </div>
      <div class="modal-footer modal-footer--stacked">
        <Button variant="ghost" block :disabled="isBusy" @click="goToRecovery">
          Lost access to {{ currentEmail || 'your email' }}?
        </Button>
        <Button variant="ghost" block :disabled="isBusy" @click="goBackToEnter">Back</Button>
      </div>
    </template>

    <!-- Step 2b: lost inbox → staff-reviewed recovery -->
    <template v-else-if="step === 'recovery'">
      <div class="modal-body">
        <EmailRecoveryPanel
          :signed-in="true"
          :initial-new-email="newEmail.trim()"
          @redeemed="handleRecoveryRedeemed"
        />
        <p v-if="errorText" class="status-text is-error" role="alert">{{ errorText }}</p>
      </div>
      <div class="modal-footer modal-footer--stacked">
        <Button variant="ghost" block :disabled="isBusy" @click="step = 'reauth'">Back</Button>
      </div>
    </template>

    <!-- Step 3: done -->
    <template v-else>
      <div class="modal-body">
        <div class="sent-state" role="status">
          <EmailIcon width="28" height="28" />
          <p>
            Check <strong>{{ newEmail.trim() }}</strong> for a confirmation link.
            Your email changes once you open it.
          </p>
          <p class="sent-state__hint">
            After confirming you may be asked to sign in again with your new
            email. Didn't get it? Check spam, or try again in a few minutes.
          </p>
        </div>
      </div>
      <div class="modal-footer">
        <Button variant="primary" block @click="handleClose">Done</Button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { isAuthProviderError, type AuthSignInMethod } from '@grids/contracts/auth';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import BaseModal from './BaseModal.vue';
import Button from '@/components/ui-elements/Button.vue';
import CloseXIcon from '@/components/icons/CloseXIcon.vue';
import EmailIcon from '@/components/icons/EmailIcon.vue';
import EmailRecoveryPanel from '@/components/account/EmailRecoveryPanel.vue';
import {
  describeEmailChangeError,
  emailChangeContinueUrl,
  emailChangeReauthUrl,
  isSameEmail,
  isValidEmail,
  writePendingNewEmail,
} from '@/utils/emailChange';

export type ChangeEmailStep = 'enter' | 'reauth' | 'recovery' | 'sent';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    currentEmail?: string | null;
    /** Pre-fill the new address (e.g. when resuming after recovery). */
    initialNewEmail?: string;
  }>(),
  { currentEmail: null, initialNewEmail: '' },
);

const emit = defineEmits<{
  close: [];
  /** The verification email was sent to `newEmail`. */
  sent: [newEmail: string];
}>();

const authProvider = getAuthProvider();

const step = ref<ChangeEmailStep>('enter');
const newEmail = ref(props.initialNewEmail);
const isBusy = ref(false);
const errorText = ref<string | null>(null);
const reauthMethod = ref<AuthSignInMethod | null>(null);
const reauthLinkSent = ref(false);
const signInMethods = ref<AuthSignInMethod[]>([]);
const inputElement = ref<HTMLInputElement | null>(null);

const title = computed(() => {
  switch (step.value) {
    case 'reauth':
      return 'Confirm it’s you';
    case 'recovery':
      return 'Lost access to your email?';
    case 'sent':
      return 'Check your new inbox';
    default:
      return 'Change email';
  }
});

const validationText = computed(() => {
  const value = newEmail.value.trim();
  if (!value) return '';
  if (!isValidEmail(value)) return 'Enter a valid email address.';
  if (isSameEmail(props.currentEmail, value)) return 'That’s already your email.';
  return '';
});

const canSubmit = computed(
  () => newEmail.value.trim().length > 0 && !validationText.value,
);

const reset = () => {
  step.value = 'enter';
  newEmail.value = props.initialNewEmail;
  isBusy.value = false;
  errorText.value = null;
  reauthMethod.value = null;
  reauthLinkSent.value = false;
};

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return;
    reset();
    nextTick(() => {
      setTimeout(() => inputElement.value?.focus(), 100);
    });
  },
  { immediate: true },
);

/** Ask the auth provider to send the verification link to the new address. */
const submitChange = async () => {
  if (!canSubmit.value || (isBusy.value && step.value === 'enter')) return;
  const target = newEmail.value.trim();
  isBusy.value = true;
  errorText.value = null;
  try {
    await authProvider.requestEmailChange(target, emailChangeContinueUrl());
    writePendingNewEmail(null);
    step.value = 'sent';
    emit('sent', target);
  } catch (error) {
    if (isAuthProviderError(error) && error.code === 'requires-recent-login') {
      signInMethods.value = authProvider.getSignInMethods();
      reauthLinkSent.value = false;
      step.value = 'reauth';
    } else {
      errorText.value = describeEmailChangeError(error);
    }
  } finally {
    isBusy.value = false;
    reauthMethod.value = null;
  }
};

const reauthWithGoogle = async () => {
  isBusy.value = true;
  reauthMethod.value = 'google';
  errorText.value = null;
  try {
    await authProvider.reauthenticateWithGoogle();
  } catch (error) {
    errorText.value = describeEmailChangeError(error);
    isBusy.value = false;
    reauthMethod.value = null;
    return;
  }
  await submitChange();
  if (step.value !== 'sent' && !errorText.value) {
    errorText.value = 'Please try again.';
  }
};

const reauthWithEmailLink = async () => {
  if (!props.currentEmail) return;
  isBusy.value = true;
  reauthMethod.value = 'emailLink';
  errorText.value = null;
  try {
    writePendingNewEmail(newEmail.value.trim());
    await authProvider.sendEmailSignInLink(props.currentEmail, emailChangeReauthUrl());
    reauthLinkSent.value = true;
  } catch (error) {
    writePendingNewEmail(null);
    errorText.value = describeEmailChangeError(error);
  } finally {
    isBusy.value = false;
    reauthMethod.value = null;
  }
};

const goToRecovery = () => {
  errorText.value = null;
  step.value = 'recovery';
};

const goBackToEnter = () => {
  errorText.value = null;
  step.value = 'enter';
};

/** A recovery code is a fresh sign-in, so the change can go through now. */
const handleRecoveryRedeemed = async () => {
  if (!canSubmit.value) {
    step.value = 'enter';
    return;
  }
  await submitChange();
};

const handleClose = () => {
  if (isBusy.value) return;
  emit('close');
};

defineExpose({ step });
</script>

<style scoped>
:deep(.change-email-modal-content) {
  padding: 0;
  width: min(460px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  box-sizing: border-box;
}

@media (max-width: 600px) {
  :deep(.change-email-modal-content) {
    max-height: 100dvh;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--color-stroke);
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
  overflow-wrap: anywhere;
}

.description strong {
  color: var(--color-text-primary);
  font-weight: 600;
}

.current-email {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  background-color: var(--color-content-background);
}

.current-email__label {
  font-size: 12px;
  color: var(--color-content-low);
}

.current-email__value {
  font-size: 14px;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
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

.text-input {
  width: 100%;
  box-sizing: border-box;
  background-color: var(--color-content-background);
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm);
  color: var(--color-text-primary);
  font-size: 14px;
  font-family: var(--font-family-base);
  outline: none;
  transition: border-color var(--duration-fast) var(--easing-smooth);
}

.text-input:focus {
  border-color: var(--color-content-high);
}

.text-input::placeholder {
  color: var(--color-content-low);
}

.status-text {
  margin: 0;
  min-height: 20px;
  font-size: 13px;
  color: var(--color-content-default);
}

.status-text.is-placeholder {
  visibility: hidden;
}

.status-text.is-error {
  color: #f87171;
}

.sent-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-sm);
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.sent-state p {
  margin: 0;
}

.sent-state__hint {
  color: var(--color-content-default);
  font-size: 13px;
}

.modal-footer {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-stroke);
}

.modal-footer--stacked {
  flex-direction: column;
  gap: var(--spacing-xs);
}

@media (max-width: 600px) {
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: var(--spacing-md);
  }

  .modal-header h2 {
    font-size: 18px;
  }

  .text-input {
    font-size: 16px;
  }
}
</style>
