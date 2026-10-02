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

      <!-- Claimed: the Claim button flies up into this orb (see handleClaim). -->
      <div
        v-if="claimedHandle"
        class="handle-success"
        @pointermove="tiltOrb"
        @pointerleave="tiltOrb()"
      >
        <div ref="orbElement" class="handle-orb" aria-hidden="true">
          <span
            v-for="(piece, index) in CONFETTI"
            :key="index"
            class="handle-confetti"
            :style="{
              '--x': `${piece.x}px`,
              '--y': `${piece.y}px`,
              '--size': `${piece.size}px`,
              '--color': piece.color,
              animationDelay: `${380 + index * 20}ms`,
            }"
          />
          <img class="handle-orb__check" :src="checkIcon" width="40" height="40" alt="" />
        </div>
        <h2 ref="successHeading" class="handle-success__title" tabindex="-1">
          grids.so/<span>{{ claimedHandle }}</span> is yours!
        </h2>
        <p class="handle-success__lead">Time to build your page.</p>

        <div class="handle-success__actions">
          <button type="button" class="handle-success__primary" @click="finishClaim">
            {{ hasExistingSlug ? 'Done' : 'Start designing' }}
          </button>
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

        <!-- Dull until typing; while checking, bolts fly from the caret into
             the button, and the last hit turns it purple when it's free. -->
        <label ref="fieldElement" class="handle-input" :class="`is-${phase}`" for="slug-input">
          <span class="handle-input__prefix" aria-hidden="true">grids.so/</span>
          <span ref="measureElement" class="handle-input__measure" aria-hidden="true">{{ slugInput }}</span>
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
          <span
            v-for="bolt in bolts"
            :key="bolt.id"
            class="handle-bolt"
            :class="{ 'is-final': bolt.final }"
            :style="{
              left: `${bolt.from}px`,
              width: `${bolt.length}px`,
              '--bolt-distance': `${bolt.distance}px`,
            }"
            aria-hidden="true"
            @animationend="onBoltLanded(bolt)"
          />
          <button
            ref="claimButton"
            type="button"
            class="handle-claim"
            :class="{ 'is-claiming': isClaiming }"
            :disabled="!canClaim && !isClaiming"
            :aria-busy="isClaiming"
            @click="handleClaim"
          >
            <span ref="flashElement" class="handle-claim__flash" aria-hidden="true" />
            <span v-if="isClaiming" class="handle-spinner" aria-hidden="true" />
            <span v-else>{{ hasExistingSlug ? 'Update' : 'Claim' }}<span class="handle-claim__noun"> handle</span></span>
          </button>
        </label>

        <!-- Always announced; only shown when something needs fixing. -->
        <p
          id="handle-status"
          class="handle-status"
          :class="[`is-${status}`, { 'is-hidden': !showStatus }]"
          aria-live="polite"
        >
          <img v-if="isProblem" :src="dotIcon" width="6" height="6" alt="" />
          <CheckIcon v-else-if="showStatus" class="handle-status__check" :size="14" />
          <span>
            <strong v-if="statusParts.head" class="handle-status__head">{{ statusParts.head }}</strong>
            <template v-if="statusParts.detail">{{ statusParts.head ? ` — ${statusParts.detail}` : statusParts.detail }}</template>
          </span>
        </p>

        <p v-if="status === 'format' && isProblem" class="format-hint">
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

        <button
          type="button"
          class="handle-card__skip"
          :disabled="isClaiming"
          @click="hasExistingSlug ? handleClose() : handleSkip()"
        >
          {{ hasExistingSlug ? 'Cancel' : 'Skip for now' }}
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
import CheckIcon from '@/components/icons/CheckIcon.vue';
import CloseXIcon from '@/components/icons/CloseXIcon.vue';
import checkIcon from '@/assets/images/handle/claim-check.svg';
import dotIcon from '@/assets/images/handle/taken-dot.svg';

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
// The hit that lands the handle is longer and brighter than the tries.
const BOLT_LENGTH = 24;
const FINAL_BOLT_LENGTH = 40;
// Pieces that burst out of the orb once it lands.
const CONFETTI = [
  { x: -150, y: -40, size: 8, color: 'var(--mkt-brand-500)' },
  { x: -100, y: -70, size: 6, color: 'var(--mkt-brand-300)' },
  { x: 140, y: -60, size: 10, color: 'var(--mkt-brand-500)' },
  { x: 170, y: 10, size: 4, color: '#fff' },
  { x: -160, y: 60, size: 12, color: 'var(--mkt-brand-500)' },
  { x: 150, y: 80, size: 6, color: 'var(--mkt-brand-300)' },
  { x: 90, y: 50, size: 8, color: 'var(--mkt-brand-500)' },
  { x: -70, y: 90, size: 4, color: '#fff' },
];

/** What the field and button look like; trails `status` by one bolt flight. */
type HandlePhase = 'idle' | 'typing' | 'checking' | 'available' | 'problem';

const userService = getServiceFactory().getUserService();
const authProvider = getAuthProvider();
const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

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
const fieldElement = ref<HTMLElement | null>(null);
const measureElement = ref<HTMLElement | null>(null);
const claimButton = ref<HTMLButtonElement | null>(null);
const flashElement = ref<HTMLElement | null>(null);
const orbElement = ref<HTMLElement | null>(null);
const successHeading = ref<HTMLElement | null>(null);
// Set once the claim succeeds; shows the "it's yours" step until Continue.
const claimedHandle = ref<string | null>(null);
// True while the debounce is pending, so typing doesn't read as checking.
const isTyping = ref(false);
const phase = ref<HandlePhase>('idle');
const bolts = ref<{ id: number; from: number; distance: number; length: number; final: boolean }[]>([]);
let boltId = 0;
// A typed change already fired its bolt; suggestions and prefill haven't.
let lastChangeWasTyped = false;

// Per-open cache so retyping or tapping a suggestion again is instant and
// doesn't re-hit the server. Claiming is still checked server-side.
const availabilityCache = new Map<string, SlugAvailabilityResponse>();
let checkTimer: number | undefined;
let checkSeq = 0;
let suggestSeq = 0;

const hasExistingSlug = computed(() => !!props.currentSlug);
const handle = computed(() => slugInput.value.trim());
// "Too short" is just unfinished typing, not something to flag in red.
const isProblem = computed(() =>
  ['format', 'taken', 'reserved', 'error'].includes(status.value)
  && formatIssue.value !== 'too-short',
);

// Problems, and "Available" once the button has lit up to match.
const showStatus = computed(() =>
  isProblem.value || (status.value === 'available' && phase.value === 'available'),
);

const targetPhase = computed((): HandlePhase => {
  if (!handle.value) return 'idle';
  if (status.value === 'available') return 'available';
  if (status.value === 'checking') return isTyping.value ? 'typing' : 'checking';
  return isProblem.value ? 'problem' : 'typing';
});

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
  isTyping.value = false;

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
  isTyping.value = !immediate;
  const seq = checkSeq;
  checkTimer = window.setTimeout(() => {
    isTyping.value = false;
    void checkAvailability(value, seq);
  }, immediate ? 0 : CHECK_DEBOUNCE_MS);
};

/** Shoots a bolt from the caret to the button's left edge. */
const fireBolt = (final = false): boolean => {
  const input = inputElement.value;
  const button = claimButton.value;
  const measure = measureElement.value;
  if (!input || !button || !measure) return false;
  const caret = Math.min(
    input.offsetLeft + measure.offsetWidth - input.scrollLeft,
    input.offsetLeft + input.clientWidth,
  );
  // Stop with the tip on the button.
  const length = final ? FINAL_BOLT_LENGTH : BOLT_LENGTH;
  const distance = Math.max(button.offsetLeft - caret - length, 0);
  bolts.value.push({ id: ++boltId, from: caret, distance, length, final });
  return true;
};

/** Flash and knock the button back when a bolt hits it. */
const hitButton = (final: boolean) => {
  const kick = final ? 1.08 : 1.04;
  claimButton.value?.animate(
    [
      { transform: 'none' },
      { transform: `translate(5px, -2px) scale(${kick})` },
      { transform: 'translate(-4px, 2px)' },
      { transform: 'translate(2px, -1px)' },
      { transform: 'none' },
    ],
    { duration: 280, easing: 'ease-out' },
  );
  flashElement.value?.animate(
    [{ opacity: 0.92 }, { opacity: 0 }],
    { duration: 220, easing: 'ease-out' },
  );
};

/** Turn the button purple with a ring pulse so "free" can't be missed. */
const lightUp = () => {
  phase.value = 'available';
  if (prefersReducedMotion()) return;
  claimButton.value?.animate(
    [
      { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(108, 77, 254, 0.7)' },
      { transform: 'scale(1.1)', offset: 0.25 },
      { transform: 'scale(1)', boxShadow: '0 0 0 16px rgba(108, 77, 254, 0)' },
    ],
    { duration: 650, easing: 'ease-out' },
  );
};

const onBoltLanded = (bolt: { id: number; final: boolean }) => {
  bolts.value = bolts.value.filter((b) => b.id !== bolt.id);
  hitButton(bolt.final);
  if (bolt.final && targetPhase.value === 'available') lightUp();
};

watch(targetPhase, (next) => {
  if (next === 'idle') bolts.value = [];
  if (next !== 'available' || prefersReducedMotion()) {
    phase.value = next;
    return;
  }
  if (phase.value === 'available') return;
  // One bolt per change: the keystroke's bolt becomes the winning hit if
  // it's still in the air; only an untyped change fires a bolt of its own.
  const flying = bolts.value[bolts.value.length - 1];
  if (flying) {
    flying.final = true;
    return;
  }
  if (!lastChangeWasTyped && fireBolt(true)) return;
  lightUp();
});

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
    await setHandle(free[0]);
  }
  baseAlternatives = free;
  alternatives.value = free.filter((c) => c !== handle.value).slice(0, MAX_ALTERNATIVES);
};

/**
 * Puts a handle chosen for the user (prefill, suggestion) in the box. The
 * caret goes to the end and the field scrolls there, so the whole handle
 * isn't left half-hidden behind the button; then it's checked, once the
 * caret position the bolt starts from is up to date.
 */
const setHandle = async (value: string) => {
  slugInput.value = value;
  lastChangeWasTyped = false;
  await nextTick();
  const input = inputElement.value;
  if (input) {
    input.setSelectionRange(value.length, value.length);
    input.scrollLeft = input.scrollWidth;
  }
  scheduleCheck(true);
};

const handleSlugInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const value = input.value.toLowerCase();
  input.value = value;
  slugInput.value = value;
  lastChangeWasTyped = true;
  // Every keystroke is one try at the button. Fire it before checking (a
  // cached answer can then upgrade it), after a tick so the caret
  // measurement sees the new text.
  if (value && !prefersReducedMotion()) {
    void nextTick(() => {
      fireBolt();
      scheduleCheck();
    });
    return;
  }
  scheduleCheck();
};

const selectHandle = (value: string) => {
  inputElement.value?.focus();
  void setHandle(value);
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

  // Morph the pill into a circle while the claim runs. Width can't
  // transition from auto, so pin the current width first.
  const button = claimButton.value;
  if (button) {
    button.style.width = `${button.offsetWidth}px`;
    void button.offsetWidth;
    button.style.width = `${button.offsetHeight}px`;
  }

  try {
    const result = await userService.claimSlug(claimedSlug);

    if (result.success) {
      const from = claimButton.value?.getBoundingClientRect();
      // Prefer the canonical slug returned by the claim; fall back to a
      // locally-normalized value so consumers always get the stored form.
      // The handle is saved now; parents hear about it on Continue.
      claimedHandle.value = result.slug ?? claimedSlug.toLowerCase();
      isClaiming.value = false;
      await nextTick();
      flyIntoOrb(from);
      successHeading.value?.focus({ preventScroll: true });
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
  if (button) button.style.width = '';
};

/** Lean the orb and slide its highlight toward the cursor. */
const tiltOrb = (event?: PointerEvent) => {
  const orb = orbElement.value;
  if (!orb) return;
  if (!event || prefersReducedMotion()) {
    orb.style.removeProperty('--orb-x');
    orb.style.removeProperty('--orb-y');
    return;
  }
  const box = orb.getBoundingClientRect();
  // Full lean once the cursor is a couple of orb-widths away.
  const reach = box.width * 2.5;
  const lean = (offset: number) => Math.max(-1, Math.min(1, offset / reach)).toFixed(3);
  orb.style.setProperty('--orb-x', lean(event.clientX - (box.left + box.width / 2)));
  orb.style.setProperty('--orb-y', lean(event.clientY - (box.top + box.height / 2)));
};

/** FLIP: start the orb where the circled button was and let it fly up. */
const flyIntoOrb = (from: DOMRect | undefined) => {
  const orb = orbElement.value;
  if (!from || !orb || prefersReducedMotion()) return;
  const to = orb.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  orb.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` },
      { transform: 'none' },
    ],
    { duration: 560, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)' },
  );
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
    bolts.value = [];
    suggestSeq += 1;
    return;
  }

  isClaiming.value = false;
  claimError.value = '';
  claimedHandle.value = null;
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

/* BaseModal pads its content box via `.modal-overlay:not(.is-floating)
   .modal-content`, which outranks the rule above. The card brings its own
   padding, so match that selector to drop the box's; otherwise the two stack
   and squeeze the handle field to a sliver on phones. */
:global(.modal-overlay:not(.is-floating) .modal-content.slug-modal-content) {
  padding: 0;
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

/* Pill field with the Claim button inside it. Dull when empty, a little
   brighter while typing, brand purple once the handle is free. */
.handle-input {
  position: relative;
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 6px 0 22px;
  border: 1.5px solid rgba(255, 255, 255, 0.13);
  border-radius: 28px;
  background: #0d0d0d;
  cursor: text;
  transition:
    border-color var(--duration-fast) var(--easing-smooth),
    box-shadow var(--duration-fast) var(--easing-smooth);
}

.handle-input.is-typing,
.handle-input.is-checking {
  border-color: rgba(255, 255, 255, 0.4);
}

.handle-input.is-available {
  border-color: var(--mkt-brand-500);
  box-shadow: 0 0 6px color-mix(in srgb, var(--mkt-brand-500) 40%, transparent);
}

.handle-input.is-problem {
  border-color: #f87171;
  box-shadow: 0 0 6px rgba(248, 113, 113, 0.2);
  animation: handle-shake 440ms ease-out;
}

.handle-input__prefix {
  color: #444;
  font-size: 16px;
  white-space: nowrap;
  user-select: none;
}

/* Invisible copy of the typed text; its width gives the caret position. */
.handle-input__measure {
  position: absolute;
  visibility: hidden;
  font-size: 16px;
  font-weight: 500;
  white-space: pre;
}

.handle-input input {
  flex: 1;
  min-width: 0;
  height: 100%;
  margin-right: 8px;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #fff;
  caret-color: #fff;
  font-family: inherit;
  font-size: 16px;
  font-weight: 500;
}

.handle-input.is-checking input,
.handle-input.is-available input {
  caret-color: var(--mkt-brand-500);
}

.handle-input.is-problem input {
  caret-color: #f87171;
}

.handle-input input::placeholder {
  color: #444;
}

.handle-bolt {
  position: absolute;
  top: 50%;
  height: 3px;
  margin-top: -1.5px;
  border-radius: 2px;
  background: var(--mkt-brand-400);
  box-shadow: 0 0 14px 4px var(--mkt-brand-400);
  transform-origin: left center;
  pointer-events: none;
  animation: handle-bolt 260ms forwards;
}

/* The successful hit: longer, with a hot white head. */
.handle-bolt.is-final {
  height: 4px;
  margin-top: -2px;
  background: linear-gradient(90deg, transparent, var(--mkt-brand-300) 35%, #fff);
  box-shadow: 0 0 20px 6px var(--mkt-brand-400);
}

/* Grow at the caret, then shoot right. */
@keyframes handle-bolt {
  0% {
    opacity: 0;
    transform: scaleX(0.05);
    animation-timing-function: ease-out;
  }
  50% {
    opacity: 1;
    transform: scaleX(1);
    animation-timing-function: cubic-bezier(0.5, 0, 1, 1);
  }
  100% {
    opacity: 1;
    transform: translateX(var(--bolt-distance));
  }
}

.handle-claim {
  position: relative;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  height: 44px;
  padding: 0 20px;
  overflow: hidden;
  border: none;
  border-radius: 22px;
  background: #1a1a1a;
  color: #666;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.4;
  transition:
    background-color 300ms var(--easing-smooth),
    color 300ms var(--easing-smooth),
    box-shadow 300ms var(--easing-smooth),
    opacity 300ms var(--easing-smooth),
    width 320ms cubic-bezier(0.4, 0, 0.2, 1),
    padding 320ms cubic-bezier(0.4, 0, 0.2, 1);
}

.handle-input.is-typing .handle-claim,
.handle-input.is-checking .handle-claim {
  background: rgba(255, 255, 255, 0.21);
  color: #0d0d0d;
  opacity: 1;
}

/* Free: brand purple, with a small "pick me" wiggle every few seconds. */
.handle-input.is-available .handle-claim {
  background: var(--mkt-brand-500);
  color: #fff;
  box-shadow: 0 0 18px color-mix(in srgb, var(--mkt-brand-500) 70%, transparent);
  opacity: 1;
  cursor: pointer;
  animation: handle-wiggle 2.8s ease-in-out 0.6s infinite;
}

.handle-input .handle-claim.is-claiming {
  padding: 0;
  animation: none;
  cursor: default;
}

.handle-claim:focus-visible {
  outline: 2px solid var(--mkt-brand-400);
  outline-offset: 2px;
}

.handle-claim__flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
}

.handle-claim .handle-spinner {
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
}

@keyframes handle-wiggle {
  0%, 76%, 100% {
    transform: none;
  }
  80% {
    transform: translateX(2px) rotate(2deg);
  }
  84% {
    transform: translateX(-2px) rotate(-2deg);
  }
  88% {
    transform: translateX(1px) rotate(1deg);
  }
  92% {
    transform: translateX(-1px) rotate(-1deg);
  }
}

@keyframes handle-shake {
  0%, 100% {
    transform: none;
  }
  15% {
    transform: translateX(-8px);
  }
  30% {
    transform: translateX(8px);
  }
  45% {
    transform: translateX(-6px);
  }
  60% {
    transform: translateX(6px);
  }
  75% {
    transform: translateX(-3px);
  }
  90% {
    transform: translateX(3px);
  }
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

/* Line under the field: "• Already taken — try one below" or
   "✓ Available — it's yours to claim". Keeps its space while hidden so
   the modal doesn't jump as it comes and goes. */
.handle-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 16px;
  margin: 10px 0 0 22px;
  color: #6c6c6c;
  font-size: 13px;
  transition:
    opacity 200ms ease-out,
    translate 200ms ease-out;
}

.handle-status > :not(span) {
  flex-shrink: 0;
}

.handle-status.is-hidden {
  opacity: 0;
  translate: 0 -4px;
}

.handle-status.is-available .handle-status__head,
.handle-status__check {
  color: var(--mkt-brand-300);
}

.handle-status__head {
  font-weight: 500;
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

/* Success step */
.handle-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Cursor lean, -1..1 per axis; registered so changes ease. */
@property --orb-x {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

@property --orb-y {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

/* The Claim button, landed: a lit sphere with a little grain. The
   highlight follows the cursor and the shadow falls the other way. */
.handle-orb {
  position: relative;
  display: grid;
  place-items: center;
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  border-radius: 50%;
  background:
    radial-gradient(
      circle at calc(32% + var(--orb-x) * 22%) calc(26% + var(--orb-y) * 22%),
      rgba(255, 255, 255, 0.55),
      transparent 45%
    ),
    radial-gradient(
      circle at calc(68% - var(--orb-x) * 12%) calc(82% - var(--orb-y) * 12%),
      rgba(40, 16, 140, 0.45),
      transparent 60%
    ),
    var(--mkt-brand-300);
  box-shadow:
    calc(var(--orb-x) * -6px) calc(8px - var(--orb-y) * 6px) 16px
      color-mix(in srgb, var(--mkt-brand-500) 70%, transparent),
    inset 0 -4px 10px rgba(40, 16, 140, 0.35);
  translate: calc(var(--orb-x) * 6px) calc(var(--orb-y) * 6px);
  transition:
    --orb-x 300ms ease-out,
    --orb-y 300ms ease-out;
}

.handle-orb::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
  opacity: 0.35;
  pointer-events: none;
}

.handle-orb__check {
  position: relative;
  z-index: 1;
  translate: calc(var(--orb-x) * 5px) calc(var(--orb-y) * 5px);
  animation: handle-pop 600ms 300ms both;
}

/* Springy pop that settles, like the Figma spring. */
@keyframes handle-pop {
  0% {
    transform: scale(0);
  }
  45% {
    transform: scale(1.18);
  }
  65% {
    transform: scale(0.92);
  }
  82% {
    transform: scale(1.04);
  }
  100% {
    transform: scale(1);
  }
}

.handle-confetti {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--size);
  height: var(--size);
  margin: calc(var(--size) / -2) 0 0 calc(var(--size) / -2);
  border-radius: 50%;
  background: var(--color);
  opacity: 0;
  pointer-events: none;
  animation: handle-confetti 1100ms cubic-bezier(0.15, 0.8, 0.3, 1) both;
}

@keyframes handle-confetti {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.3);
  }
  12%, 70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--x), var(--y)) scale(1);
  }
}

.handle-success__title {
  margin: 0;
  font-family: var(--mkt-font-brand);
  font-size: clamp(20px, 5.5vw, 24px);
  font-weight: 500;
  line-height: 1.2;
  color: #fff;
  overflow-wrap: anywhere;
  animation: handle-rise 400ms ease-out 350ms both;
}

.handle-success__title:focus {
  outline: none;
}

/* Inline-block keeps the handle on one line (moving it below "grids.so/"
   when needed) instead of splitting it at a hyphen; it only wraps inside
   when it's wider than the card. */
.handle-success__title span {
  display: inline-block;
  color: var(--mkt-brand-300);
}

.handle-success__lead {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 400;
  animation: handle-rise 400ms ease-out 500ms both;
}

.handle-success__actions {
  margin-top: 24px;
  animation: handle-rise 400ms ease-out 650ms both;
}

.handle-success__primary {
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  background: var(--mkt-brand-500);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);
}

.handle-success__primary:hover {
  background: var(--mkt-brand-600);
}

.handle-success__primary:focus-visible {
  outline: 2px solid var(--mkt-brand-400);
  outline-offset: 2px;
}

@keyframes handle-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.handle-card__skip {
  align-self: center;
  margin-top: 24px;
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

  /* Leave the typed handle room to breathe on phones. */
  .handle-input {
    padding-left: 16px;
  }

  .handle-claim {
    padding: 0 16px;
  }

  .handle-claim__noun {
    display: none;
  }
}

/* Small phones: shrink the fixed "grids.so/" so the typed handle gets the
   room (about 11 characters at 320px). */
@media (max-width: 400px) {
  .handle-input__prefix {
    font-size: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .handle-spinner {
    animation-duration: 2s;
  }

  .handle-input,
  .handle-input .handle-claim,
  .handle-orb__check,
  .handle-success__title,
  .handle-success__lead,
  .handle-success__actions {
    animation: none;
  }

  .handle-confetti {
    display: none;
  }
}
</style>
