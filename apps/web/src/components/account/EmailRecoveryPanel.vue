<template>
  <div class="recovery-panel">
    <div class="recovery-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="recovery-tab"
        :class="{ 'is-active': tab === 'code' }"
        :aria-selected="tab === 'code'"
        @click="tab = 'code'"
      >
        I have a code
      </button>
      <button
        type="button"
        role="tab"
        class="recovery-tab"
        :class="{ 'is-active': tab === 'request' }"
        :aria-selected="tab === 'request'"
        @click="tab = 'request'"
      >
        Request a code
      </button>
    </div>

    <!-- Redeem a staff-issued code -->
    <form v-if="tab === 'code'" class="recovery-form" @submit.prevent="handleRedeem">
      <p class="recovery-copy">
        Enter the recovery code the Grids team sent you. It works once and
        expires after 24 hours.
      </p>
      <div class="input-group">
        <label for="recovery-code-input">Recovery code</label>
        <input
          id="recovery-code-input"
          v-model="code"
          class="text-input code-input"
          type="text"
          placeholder="XXXX-XXXX-XXXX"
          autocomplete="one-time-code"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="20"
          :disabled="isBusy"
        />
      </div>
      <p v-if="errorText" class="status-text is-error" role="alert">{{ errorText }}</p>
      <Button
        variant="primary"
        block
        :disabled="!canRedeem || isBusy"
        :loading="isBusy"
        @click="handleRedeem"
      >
        Use code
      </Button>
    </form>

    <!-- Ask the team for a code -->
    <div v-else-if="requestSent" class="recovery-done" role="status">
      <CheckIcon :size="20" />
      <p>
        Request sent. We'll review it and reach out via
        <strong>{{ contact.trim() }}</strong>. This usually takes a day or two.
      </p>
    </div>
    <form v-else class="recovery-form" @submit.prevent="handleRequest">
      <p class="recovery-copy">
        Tell us a bit about your account. We'll check it's really you, then send
        you a one-time code to switch your email.
      </p>
      <div v-if="!signedIn" class="input-group">
        <label for="recovery-lost-email">Email on your Grids account</label>
        <input
          id="recovery-lost-email"
          v-model="lostEmail"
          class="text-input"
          type="email"
          inputmode="email"
          autocomplete="off"
          placeholder="the address you can't access"
          :disabled="isBusy"
        />
      </div>
      <div class="input-group">
        <label for="recovery-new-email">New email</label>
        <input
          id="recovery-new-email"
          v-model="requestedEmail"
          class="text-input"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
          :disabled="isBusy"
        />
      </div>
      <div class="input-group">
        <label for="recovery-contact">How can we reach you?</label>
        <input
          id="recovery-contact"
          v-model="contact"
          class="text-input"
          type="text"
          maxlength="200"
          placeholder="Discord username, or the new email"
          :disabled="isBusy"
        />
      </div>
      <div class="input-group">
        <label for="recovery-details">Help us confirm it's you</label>
        <textarea
          id="recovery-details"
          v-model="details"
          class="text-input"
          rows="3"
          maxlength="2000"
          placeholder="Your handle, grid names, what you built, roughly when you joined…"
          :disabled="isBusy"
        />
      </div>
      <p v-if="errorText" class="status-text is-error" role="alert">{{ errorText }}</p>
      <Button
        variant="primary"
        block
        :disabled="!canRequest || isBusy"
        :loading="isBusy"
        @click="handleRequest"
      >
        Send request
      </Button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AuthUser } from '@grids/contracts/auth';
import Button from '@/components/ui-elements/Button.vue';
import CheckIcon from '@/components/icons/CheckIcon.vue';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import { isValidEmail } from '@/utils/emailChange';

const props = withDefaults(
  defineProps<{
    /** Signed-in users don't need to tell us which account they mean. */
    signedIn: boolean;
    /** Pre-fills "New email" when the user already typed one. */
    initialNewEmail?: string;
  }>(),
  { initialNewEmail: '' },
);

const emit = defineEmits<{
  /** The code was accepted and the user is now freshly signed in. */
  redeemed: [user: AuthUser];
}>();

const recoveryService = getServiceFactory().getAccountRecoveryService();

const tab = ref<'code' | 'request'>('code');
const code = ref('');
const lostEmail = ref('');
const requestedEmail = ref(props.initialNewEmail);
const contact = ref('');
const details = ref('');
const isBusy = ref(false);
const errorText = ref<string | null>(null);
const requestSent = ref(false);

watch(
  () => props.initialNewEmail,
  (value) => {
    if (value && !requestedEmail.value) requestedEmail.value = value;
  },
);

watch(tab, () => {
  errorText.value = null;
});

const canRedeem = computed(() => code.value.replace(/[\s-]/g, '').length >= 12);

const canRequest = computed(
  () =>
    isValidEmail(requestedEmail.value) &&
    contact.value.trim().length > 0 &&
    (props.signedIn || isValidEmail(lostEmail.value)),
);

const messageFrom = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const handleRedeem = async () => {
  if (!canRedeem.value || isBusy.value) return;
  isBusy.value = true;
  errorText.value = null;
  try {
    const user = await recoveryService.redeemRecoveryCode(code.value.trim());
    emit('redeemed', user);
  } catch (error) {
    errorText.value = messageFrom(error, 'That code is invalid or has expired.');
  } finally {
    isBusy.value = false;
  }
};

const handleRequest = async () => {
  if (!canRequest.value || isBusy.value) return;
  isBusy.value = true;
  errorText.value = null;
  try {
    await recoveryService.requestEmailRecovery({
      lostEmail: props.signedIn ? undefined : lostEmail.value.trim(),
      requestedEmail: requestedEmail.value.trim(),
      contact: contact.value.trim(),
      details: details.value.trim(),
    });
    requestSent.value = true;
  } catch (error) {
    errorText.value = messageFrom(error, "We couldn't send your request. Please try again.");
  } finally {
    isBusy.value = false;
  }
};
</script>

<style scoped>
.recovery-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.recovery-tabs {
  display: flex;
  gap: var(--spacing-xs);
  padding: 4px;
  border-radius: var(--radius-sm);
  /* Tint from the text color so the track reads on any card/theme. */
  background-color: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}

.recovery-tab {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-content-default);
  font-family: var(--font-family-base);
  font-size: 13px;
  font-weight: 500;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: calc(var(--radius-sm) - 2px);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
}

.recovery-tab:hover {
  color: var(--color-text-primary);
}

.recovery-tab.is-active {
  background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  color: var(--color-text-primary);
}

.recovery-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.recovery-copy {
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
  resize: vertical;
  transition: border-color var(--duration-fast) var(--easing-smooth);
}

.text-input:focus {
  border-color: var(--color-content-high);
}

.text-input::placeholder {
  color: var(--color-content-low);
}

.code-input {
  font-family: var(--font-family-mono, ui-monospace, monospace);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-content-default);
}

.status-text.is-error {
  color: #f87171;
}

.recovery-done {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.5;
}

.recovery-done p {
  margin: 0;
}

.recovery-done :deep(svg) {
  flex-shrink: 0;
  color: #4ade80;
  margin-top: 2px;
}

@media (max-width: 600px) {
  .text-input {
    font-size: 16px;
  }
}
</style>
