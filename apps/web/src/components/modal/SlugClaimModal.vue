<template>
  <BaseModal
    :show="isOpen"
    variant="centered"
    :close-on-backdrop="hasExistingSlug"
    content-class="slug-modal-content"
    @close="handleClose"
  >
    <div class="handle-card">
      <button
        v-if="hasExistingSlug"
        class="close-btn"
        @click="handleClose"
        aria-label="Close"
      >
        <CloseXIcon :size="20" />
      </button>

      <!-- Claimed: a short "it's yours" moment before moving on. -->
      <div v-if="claimedHandle" class="handle-success">
        <div class="handle-success__icon" aria-hidden="true">
          <CheckIcon :size="26" />
        </div>
        <div class="handle-card__intro">
          <h2 ref="successHeading" class="handle-card__title" tabindex="-1">
            {{ hasExistingSlug ? 'Handle Updated' : "It's Yours!" }}
          </h2>
          <p class="handle-card__lead">Your page now lives at</p>
          <p class="handle-success__url">grids.so/<strong>{{ claimedHandle }}</strong></p>
        </div>

        <div class="handle-card__actions">
          <Button class="handle-card__cancel" variant="secondary" block @click="copyLink">
            <template #icon-left>
              <CheckIcon v-if="linkCopied" :size="18" />
              <svg
                v-else
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="12" height="12" rx="2.5" />
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
              </svg>
            </template>
            {{ linkCopied ? 'Copied' : 'Copy link' }}
          </Button>
          <Button class="handle-card__claim" variant="brand" block @click="finishClaim">
            {{ hasExistingSlug ? 'Done' : 'Continue' }}
          </Button>
        </div>
      </div>

      <template v-else>
        <div class="handle-card__intro">
          <h2 class="handle-card__title">
            {{ hasExistingSlug ? 'Change Your Handle' : 'Claim Your Handle' }}
          </h2>
          <p class="handle-card__lead">
            {{ hasExistingSlug
              ? 'Changing it breaks links you have already shared.'
              : 'This is the link people will use to find your page.'
            }}
          </p>
        </div>

        <!-- Live preview: the input reads like a browser address bar. -->
        <label class="handle-input" :class="`is-${status}`" for="slug-input">
          <svg
            class="handle-input__lock"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="11" width="16" height="10" rx="2.5" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span class="handle-input__prefix" aria-hidden="true">grids.so/</span>
          <input
            id="slug-input"
            ref="inputElement"
            :value="slugInput"
            type="text"
            placeholder="your-name"
            aria-label="Handle"
            aria-describedby="handle-status"
            :disabled="isClaiming"
            @input="handleSlugInput"
            @keydown.enter="handleClaim"
            :maxlength="HANDLE_MAX_LENGTH"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          />
          <span class="handle-input__status" aria-hidden="true">
            <span v-if="status === 'checking'" class="handle-spinner" />
            <span v-else-if="status === 'available' || status === 'own'" class="handle-badge">
              <CheckIcon :size="14" />
              {{ status === 'own' ? 'Current' : 'Available' }}
            </span>
            <AlertCircleIcon v-else-if="isProblem" :size="18" />
          </span>
        </label>

        <!-- Always announced; only shown when something needs fixing. -->
        <p
          id="handle-status"
          class="handle-status"
          :class="[`is-${status}`, { 'visually-hidden': !isProblem }]"
          aria-live="polite"
        >
          <strong v-if="statusParts.head" class="handle-status__head">{{ statusParts.head }}</strong>
          <span v-if="statusParts.detail">{{ statusParts.head ? ` — ${statusParts.detail}` : statusParts.detail }}</span>
        </p>

        <p v-if="status === 'format'" class="format-hint">
          Use 3–30 lowercase letters, numbers, or hyphens. No hyphen at the start or end.
        </p>

        <p v-if="claimError" class="handle-error" role="alert">{{ claimError }}</p>

        <p v-if="alternatives.length" class="handle-alternatives">
          <span>Also available:</span>
          <template v-for="(alternative, index) in alternatives" :key="alternative">
            <span v-if="index > 0" class="handle-alternatives__sep" aria-hidden="true">·</span>
            <button
              type="button"
              class="handle-suggestion"
              :class="{ 'is-selected': alternative === handle }"
              :disabled="isClaiming"
              @click="selectHandle(alternative)"
            >
              {{ alternative }}
            </button>
          </template>
        </p>

        <div class="handle-card__actions">
          <Button
            v-if="hasExistingSlug"
            class="handle-card__cancel"
            variant="secondary"
            @click="handleClose"
            :disabled="isClaiming"
            block
          >
            Cancel
          </Button>
          <Button
            class="handle-card__claim"
            variant="brand"
            @click="handleClaim"
            :disabled="!canClaim"
            :loading="isClaiming"
            block
          >
            {{ hasExistingSlug ? 'Update Handle' : 'Claim Handle' }}
          </Button>
        </div>

        <button
          v-if="!hasExistingSlug"
          type="button"
          class="handle-card__skip"
          :disabled="isClaiming"
          @click="handleSkip"
        >
          Skip for now
        </button>
      </template>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import type { SlugAvailabilityResponse } from '@grids/contracts/types';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import {
  HANDLE_MAX_LENGTH,
  getHandleFormatIssue,
  numberedHandles,
  suggestHandles,
  type HandleFormatIssue,
} from '@/utils/handleSuggestions';
import { markHandlePromptSkipped } from '@/utils/handlePrompt';
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

type HandleStatus =
  | 'idle'
  | 'format'
  | 'checking'
  | 'available'
  | 'own'
  | 'taken'
  | 'reserved'
  | 'error';

// The check callable keeps a warm instance (minInstances: 1), so a short
// debounce is enough to coalesce typing without flooding it.
const CHECK_DEBOUNCE_MS = 250;
const MAX_ALTERNATIVES = 3;

const userService = getServiceFactory().getUserService();
const authProvider = getAuthProvider();

const slugInput = ref(props.currentSlug || '');
const status = ref<HandleStatus>('idle');
const formatIssue = ref<HandleFormatIssue | null>(null);
const claimError = ref('');
const isClaiming = ref(false);
const alternatives = ref<string[]>([]);
// Name-based suggestions from when the modal opened; restored once the
// handle in the box is fine again, replacing any "handle-12" variants.
let baseAlternatives: string[] = [];
const inputElement = ref<HTMLInputElement | null>(null);
const successHeading = ref<HTMLElement | null>(null);
// Set once the claim succeeds; shows the "it's yours" step until Continue.
const claimedHandle = ref<string | null>(null);
const linkCopied = ref(false);
let copiedTimer: number | undefined;

// Per-open cache so retyping or tapping a suggestion again is instant and
// doesn't re-hit the server. Claiming is still checked server-side.
const availabilityCache = new Map<string, SlugAvailabilityResponse>();
let checkTimer: number | undefined;
let checkSeq = 0;
let suggestSeq = 0;

const hasExistingSlug = computed(() => !!props.currentSlug);
const handle = computed(() => slugInput.value.trim());
const isProblem = computed(() =>
  ['format', 'taken', 'reserved', 'error'].includes(status.value),
);

const canClaim = computed(() => status.value === 'available' && !isClaiming.value);

// The address bar above already shows the full link, so this line only
// says what's going on with it: a short coloured word, then grey detail.
const statusParts = computed((): { head: string; detail: string } => {
  const tryBelow = alternatives.value.length ? 'try one below' : '';
  switch (status.value) {
    case 'checking':
      return { head: '', detail: 'Checking availability…' };
    case 'available':
      return { head: 'Available', detail: "it's yours to claim" };
    case 'own':
      return { head: 'Current handle', detail: '' };
    case 'taken':
      return { head: 'Already taken', detail: tryBelow };
    case 'reserved':
      return { head: 'Not available', detail: tryBelow };
    case 'error':
      return { head: "Couldn't check", detail: 'try again in a moment' };
    case 'format':
      if (formatIssue.value === 'too-short') return { head: 'Too short', detail: 'use at least 3 characters' };
      if (formatIssue.value === 'too-long') return { head: 'Too long', detail: '30 characters max' };
      return { head: 'Not allowed', detail: 'see the rules below' };
    default:
      return { head: '', detail: 'Type the handle you want' };
  }
});

const applyResult = (value: string, result: SlugAvailabilityResponse) => {
  switch (result.reason) {
    case 'available':
      status.value = 'available';
      break;
    case 'own-slug':
      status.value = 'own';
      break;
    case 'reserved':
      status.value = 'reserved';
      break;
    case 'invalid-format':
      status.value = 'format';
      formatIssue.value = 'invalid-format';
      break;
    default:
      status.value = 'taken';
  }

  if (status.value === 'taken' || status.value === 'reserved') {
    void refreshAlternatives(numberedHandles(value, MAX_ALTERNATIVES + 1));
  } else if (status.value === 'available' || status.value === 'own') {
    suggestSeq += 1; // drop any in-flight variants for an older handle
    // Only keep offering the name-based options while the user is choosing
    // among them; a handle they came up with themselves needs no suggestions.
    alternatives.value = baseAlternatives.includes(value)
      ? baseAlternatives.filter((c) => c !== value).slice(0, MAX_ALTERNATIVES)
      : [];
  }
};

const checkAvailability = async (value: string, seq: number) => {
  try {
    const result = await userService.checkSlugAvailability(value);
    availabilityCache.set(value, result);
    if (seq === checkSeq) applyResult(value, result);
  } catch {
    if (seq === checkSeq) status.value = 'error';
  }
};

const scheduleCheck = (immediate = false) => {
  window.clearTimeout(checkTimer);
  checkSeq += 1;
  claimError.value = '';

  const value = handle.value;
  if (!value) {
    status.value = 'idle';
    formatIssue.value = null;
    return;
  }

  const issue = getHandleFormatIssue(value);
  if (issue) {
    status.value = 'format';
    formatIssue.value = issue;
    return;
  }
  formatIssue.value = null;

  const cached = availabilityCache.get(value);
  if (cached) {
    applyResult(value, cached);
    return;
  }

  status.value = 'checking';
  const seq = checkSeq;
  checkTimer = window.setTimeout(
    () => void checkAvailability(value, seq),
    immediate ? 0 : CHECK_DEBOUNCE_MS,
  );
};

/**
 * Cheap pre-screen for suggestions: one Firestore read per candidate (the
 * same public lookup /:slug pages use), no function calls. The picked
 * handle still goes through the authoritative availability check.
 */
const keepFree = async (candidates: string[]): Promise<string[]> => {
  const userId = authProvider.getCurrentUserId();
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const cached = availabilityCache.get(candidate);
      if (cached) return cached.available ? candidate : null;
      try {
        const owner = await userService.getUserIdBySlug(candidate);
        return owner === null || owner === userId ? candidate : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((candidate): candidate is string => !!candidate);
};

const refreshAlternatives = async (candidates: string[]) => {
  const seq = ++suggestSeq;
  const free = await keepFree(candidates.filter((c) => c !== handle.value));
  if (seq !== suggestSeq) return;
  alternatives.value = free.slice(0, MAX_ALTERNATIVES);
};

const prefillSuggestions = async () => {
  const user = authProvider.getCurrentUser();
  const candidates = suggestHandles({
    displayName: user?.displayName,
    email: user?.email,
  });
  if (!candidates.length) return;

  const seq = ++suggestSeq;
  let free = await keepFree(candidates);
  if (free.length < MAX_ALTERNATIVES + 1) {
    const numbered = await keepFree(numberedHandles(candidates[0], MAX_ALTERNATIVES));
    free = [...new Set([...free, ...numbered])];
  }
  if (seq !== suggestSeq || !props.isOpen) return;

  // Don't overwrite anything the user started typing while we looked.
  if (!slugInput.value && free[0]) {
    slugInput.value = free[0];
    scheduleCheck(true);
    // Caret at the end so it's editable without looking selected/disabled.
    await nextTick();
    const input = inputElement.value;
    input?.setSelectionRange(input.value.length, input.value.length);
  }
  baseAlternatives = free;
  alternatives.value = free.filter((c) => c !== handle.value).slice(0, MAX_ALTERNATIVES);
};

const handleSlugInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const value = input.value.toLowerCase();
  input.value = value;
  slugInput.value = value;
  scheduleCheck();
};

const selectHandle = (value: string) => {
  slugInput.value = value;
  scheduleCheck(true);
  inputElement.value?.focus();
};

const describeClaimError = (message: string, value: string) => {
  if (/reserved/i.test(message)) return `grids.so/${value} isn't available.`;
  if (/sign(ed)? in/i.test(message)) return 'Your session expired. Sign in again to claim a handle.';
  return `Couldn't claim grids.so/${value}. Try again.`;
};

const handleClaim = async () => {
  if (!canClaim.value) return;

  isClaiming.value = true;
  claimError.value = '';
  const claimedSlug = handle.value;

  try {
    const result = await userService.claimSlug(claimedSlug);

    if (result.success) {
      // Prefer the canonical slug returned by the claim; fall back to a
      // locally-normalized value so consumers always get the stored form.
      // The handle is saved now; parents hear about it on Continue.
      claimedHandle.value = result.slug ?? claimedSlug.toLowerCase();
      isClaiming.value = false;
      await nextTick();
      successHeading.value?.focus();
      return;
    }
    claimError.value = describeClaimError(result.message ?? '', claimedSlug);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/taken|already-exists/i.test(message)) {
      // Someone got there first between the check and the claim.
      const taken: SlugAvailabilityResponse = { available: false, reason: 'taken', message };
      availabilityCache.set(claimedSlug, taken);
      applyResult(claimedSlug, taken);
    } else {
      claimError.value = describeClaimError(message, claimedSlug);
    }
  }
  isClaiming.value = false;
};

const finishClaim = () => {
  const finalSlug = claimedHandle.value;
  if (!finalSlug) return;
  emit('close');
  emit('success', finalSlug);
  if (props.onSuccess) {
    props.onSuccess(finalSlug);
  }
};

const copyLink = async () => {
  if (!claimedHandle.value) return;
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/${claimedHandle.value}`);
    linkCopied.value = true;
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => {
      linkCopied.value = false;
    }, 2000);
  } catch {
    // Clipboard blocked; the link is on screen to copy by hand.
  }
};

const handleClose = () => {
  if (isClaiming.value) return;
  // Closing after a successful claim still has to tell the parent.
  if (claimedHandle.value) {
    finishClaim();
    return;
  }
  if (!hasExistingSlug.value) return;

  emit('close');
  if (props.onClose) {
    props.onClose();
  }
};

const handleSkip = () => {
  if (isClaiming.value) return;
  markHandlePromptSkipped();
  emit('skip');
};

watch(() => props.currentSlug, (newSlug) => {
  if (newSlug) {
    slugInput.value = newSlug;
  }
});

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    window.clearTimeout(checkTimer);
    suggestSeq += 1;
    return;
  }

  isClaiming.value = false;
  claimError.value = '';
  claimedHandle.value = null;
  linkCopied.value = false;
  alternatives.value = [];
  baseAlternatives = [];
  availabilityCache.clear();

  if (props.currentSlug) {
    slugInput.value = props.currentSlug;
    scheduleCheck(true);
  } else if (!slugInput.value) {
    status.value = 'idle';
    void prefillSuggestions();
  } else {
    scheduleCheck(true);
  }

  nextTick(() => {
    setTimeout(() => {
      inputElement.value?.focus();
    }, 100);
  });
}, { immediate: true });

onBeforeUnmount(() => {
  window.clearTimeout(checkTimer);
  window.clearTimeout(copiedTimer);
});
</script>

<style scoped>
:deep(.slug-modal-content) {
  padding: 0;
  width: min(480px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background-color: var(--color-content-background);
}

@media (max-width: 600px) {
  :deep(.slug-modal-content) {
    width: calc(100% - var(--spacing-md) * 2);
    max-height: 100dvh;
    margin: var(--spacing-md);
  }
}

.handle-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 36px 32px 24px;
  font-family: var(--mkt-font-sans);
  font-weight: 500;
  line-height: normal;
  color: #6c6c6c;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6c6c6c;
  cursor: pointer;
  transition: color var(--duration-fast) var(--easing-smooth);
}

.close-btn:hover {
  color: #fff;
}

.handle-card__intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 24px;
  text-align: center;
}

.handle-card__title {
  margin: 0;
  font-family: var(--mkt-font-brand);
  font-size: clamp(20px, 5.5vw, 22px);
  font-weight: 600;
  line-height: normal;
  color: #fff;
}

.handle-card__lead {
  margin: 0;
  font-size: 15px;
}

/* Live preview: the input reads like a browser address bar. */
.handle-input {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 12px 0 16px;
  border: 1px solid color-mix(in srgb, #6c6c6c 45%, transparent);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  cursor: text;
  transition: border-color var(--duration-fast) var(--easing-smooth);
}

/* Neutral by default, purple while typing, red only for problems — the
   green check and status word carry "available". No glow rings. */
.handle-input:focus-within {
  border-color: var(--mkt-brand-500);
}

.handle-input.is-format,
.handle-input.is-taken,
.handle-input.is-reserved,
.handle-input.is-error {
  border-color: #f87171;
}

.handle-input__lock {
  flex-shrink: 0;
  color: #6c6c6c;
}

.handle-input__prefix {
  margin-right: -10px;
  color: #6c6c6c;
  font-size: 18px;
  white-space: nowrap;
  user-select: none;
}

.handle-input input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
}

.handle-input input::placeholder {
  color: color-mix(in srgb, #6c6c6c 70%, transparent);
  font-weight: 500;
}

.handle-input__status {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

/* "✓ Available" sits inside the field instead of a line underneath. */
.handle-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.handle-input.is-available .handle-input__status,
.handle-input.is-own .handle-input__status {
  color: #4ade80;
}

.handle-input.is-format .handle-input__status,
.handle-input.is-taken .handle-input__status,
.handle-input.is-reserved .handle-input__status,
.handle-input.is-error .handle-input__status {
  color: #f87171;
}

.handle-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid color-mix(in srgb, #6c6c6c 40%, transparent);
  border-top-color: var(--mkt-brand-400);
  border-radius: 50%;
  animation: handle-spin 700ms linear infinite;
}

@keyframes handle-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Status under the browser: "Available — it's yours to claim" */
.handle-status {
  margin: 10px 0 0 2px;
  font-size: 14px;
}

.handle-status__head {
  font-weight: 600;
  color: #fff;
}

.handle-status.is-available .handle-status__head,
.handle-status.is-own .handle-status__head {
  color: #4ade80;
}

.handle-status.is-format .handle-status__head,
.handle-status.is-taken .handle-status__head,
.handle-status.is-reserved .handle-status__head,
.handle-status.is-error .handle-status__head,
.handle-error {
  color: #f87171;
}

.format-hint {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(248, 113, 113, 0.08);
  color: #d4d4d4;
  font-size: 13px;
  line-height: 1.5;
}

.handle-error {
  margin: 10px 0 0;
  font-size: 14px;
}

/* Alternatives: one quiet line of tappable handles. */
.handle-alternatives {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  margin: 14px 0 0 2px;
  font-size: 13px;
}

.handle-alternatives__sep {
  color: color-mix(in srgb, #6c6c6c 70%, transparent);
}

.handle-suggestion {
  padding: 0;
  border: none;
  background: none;
  color: #d4d4d4;
  font-family: inherit;
  font-size: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, #6c6c6c 70%, transparent);
  text-underline-offset: 3px;
  cursor: pointer;
  transition: color var(--duration-fast) var(--easing-smooth);
}

.handle-suggestion:hover:not(:disabled) {
  color: #fff;
  text-decoration-color: currentColor;
}

.handle-suggestion.is-selected {
  color: var(--mkt-brand-400);
  text-decoration-color: currentColor;
}

.handle-suggestion:focus-visible,
.handle-card__skip:focus-visible {
  outline: 2px solid var(--mkt-brand-400);
  outline-offset: 2px;
  border-radius: 2px;
}

.handle-suggestion:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Actions */
.handle-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
}

/* Two-class selectors so these win over Button's own variant rules. */
.handle-card .handle-card__claim,
.handle-card .handle-card__cancel {
  height: 48px;
  border-radius: 12px;
  font-family: var(--mkt-font-sans);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: normal;
}

/* Flat brand purple when there's something to claim; clearly inactive
   (neutral fill, muted text) otherwise — not a faded purple. */
.handle-card .handle-card__claim {
  box-shadow: none;
}

.handle-card .handle-card__claim.ui-btn--disabled:not(.ui-btn--loading) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
  color: #6c6c6c;
}

.handle-card .handle-card__claim.ui-btn--loading {
  opacity: 1;
}

/* Success step */
.handle-success {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.handle-success__icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 16px;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.handle-success .handle-card__intro {
  margin-bottom: 0;
}

.handle-success__url {
  margin: 8px 0 0;
  padding: 8px 16px;
  border: 1px solid #fff;
  border-radius: 999px;
  color: #fff;
  font-size: 17px;
  overflow-wrap: anywhere;
}

.handle-success__url strong {
  font-weight: 600;
}

.handle-success .handle-card__actions {
  align-self: stretch;
}

.handle-card__skip {
  align-self: center;
  margin-top: 12px;
  padding: 4px 8px;
  border: none;
  background: none;
  color: #6c6c6c;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.handle-card__skip:hover:not(:disabled) {
  color: #fff;
}

@media (max-width: 600px) {
  .handle-card {
    padding: 28px 20px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .handle-spinner {
    animation-duration: 2s;
  }
}
</style>
