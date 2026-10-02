<template>
  <div class="auth-landing">
    <div class="auth-landing__background" aria-hidden="true">
      <GriddleAnimation />
    </div>

    <main class="auth-landing__content">
      <div class="auth-container" :class="{ 'auth-container--entry': !linkSentTo }">
        <Transition name="auth-step" mode="out-in" @after-enter="handleStepEntered">
          <div v-if="!linkSentTo" key="entry" class="auth-step auth-entry">
            <div class="auth-intro">
              <GridsMark class="auth-intro__icon" />
              <h1 class="auth-heading">Welcome to Grids</h1>
              <p class="auth-lead">Sign in or create your page of links, work, and media.</p>
            </div>

            <p v-if="emailChanged" class="status status--notice" role="status">
              Your email was updated. Sign in with your new address.
            </p>

            <Button
              class="auth-google"
              variant="secondary"
              block
              :disabled="isBusy || isCompletingLink"
              @click="handleGoogleAuth"
            >
              <template #icon-left>
                <img :src="googleColorIcon" width="20" height="20" alt="" />
              </template>
              Continue with Google
            </Button>

            <div class="or-block" aria-hidden="true">
              <span class="or-block__line"></span>
              <span>OR</span>
              <span class="or-block__line"></span>
            </div>

            <div class="email-row">
              <input
                ref="emailInputRef"
                v-model="email"
                inputmode="email"
                autocomplete="off"
                name="grids-email"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                placeholder="Email address"
                aria-label="Email address"
                :class="{ 'email-input--invalid': emailError }"
                :aria-invalid="emailError ? 'true' : 'false'"
                :aria-describedby="emailError ? 'auth-email-error' : undefined"
                :disabled="isBusy || isCompletingLink"
                @blur="revealEmailError"
                @keydown.enter.prevent="handleEmailEnter"
              />
              <button
                class="email-continue-btn"
                :class="{ 'email-continue-btn--visible': isEmailValid }"
                type="button"
                aria-label="Continue"
                :aria-hidden="!isEmailValid"
                :tabindex="isEmailValid ? 0 : -1"
                @click="handleEmailContinue"
                :disabled="isBusy || isCompletingLink"
              >
                <ArrowRightIcon aria-hidden="true" />
              </button>
            </div>

            <div class="email-error-region" aria-live="polite">
              <Transition name="email-error">
                <p v-if="emailError" id="auth-email-error" class="status error email-error">
                  {{ emailError }}
                </p>
              </Transition>
            </div>

            <p v-if="statusText" class="status" :class="{ error: statusTone === 'error' }">
              {{ statusText }}
            </p>

            <router-link
              v-if="canRecoverEmail"
              class="auth-recover-link"
              :to="ACCOUNT_RECOVERY_PATH"
            >
              Can't access your email?
            </router-link>
          </div>

          <div v-else key="sent" class="auth-step auth-sent">
            <div class="auth-intro">
              <img class="auth-intro__icon" :src="mailboxIcon" width="40" height="40" alt="" />
              <h1 ref="sentHeadingRef" class="auth-heading" tabindex="-1">Check Your Inbox</h1>
              <p class="auth-lead">We have sent a sign-in link to</p>
            </div>

            <!-- <wbr> lets a long address wrap after the "@" or a dot rather than
                 mid-word. -->
            <p class="auth-sent__email">
              <template v-if="sentEmailParts">
                <template v-for="(segment, index) in sentEmailParts.local" :key="index">{{ segment }}<wbr /></template>@<wbr />{{ sentEmailParts.domain }}
              </template>
              <template v-else>{{ linkSentTo }}</template>
            </p>

            <div class="auth-sent__main">
              <Button
                v-if="mailProviderLink"
                class="auth-sent__cta"
                variant="brand"
                block
                :href="mailProviderLink.url"
              >
                <template #icon-left>
                  <img
                    v-if="mailProviderLink.id === 'gmail'"
                    :src="googleMonoIcon"
                    width="20"
                    height="20"
                    alt=""
                  />
                  <i v-else :class="mailProviderLink.iconClass"></i>
                </template>
                {{ mailProviderLink.label }}
              </Button>

              <p class="auth-sent__hint">Not seeing it? Check your spam or junk folder.</p>

              <p v-if="resendStatus" class="status" role="status" :class="{ error: resendTone === 'error' }">
                {{ resendStatus }}
              </p>
            </div>

            <div class="auth-sent__actions">
              <button
                type="button"
                class="resend-btn"
                :class="{
                  'resend-btn--waiting': resendSecondsLeft > 0,
                  'resend-btn--sending': isResending,
                }"
                :disabled="isResending || resendSecondsLeft > 0"
                @click="handleResend"
              >
                <svg
                  v-if="resendSecondsLeft > 0"
                  class="resend-btn__ring"
                  viewBox="0 0 20 20"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <circle class="resend-btn__ring-track" cx="10" cy="10" r="8" />
                  <circle
                    class="resend-btn__ring-progress"
                    cx="10"
                    cy="10"
                    r="8"
                    :style="{ strokeDashoffset: resendRingOffset }"
                  />
                </svg>
                <svg
                  v-else
                  class="resend-btn__icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
                <span v-if="isResending">Sending…</span>
                <span v-else-if="resendSecondsLeft > 0">Resend in {{ resendSecondsLeft }}s</span>
                <span v-else>Resend link</span>
              </button>
              <button type="button" class="link-btn" @click="handleChangeEmail">
                Wrong email? <span class="link-btn__accent">Change it</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </main>

    <footer class="auth-landing__footer">
      <router-link class="auth-landing__footer-link" to="/privacy">Privacy</router-link>
      <span class="auth-landing__footer-sep">·</span>
      <router-link class="auth-landing__footer-link" to="/terms">Terms</router-link>
    </footer>

    <SlugClaimModal
      :is-open="showSlugModal"
      @close="handleSlugModalClose"
      @success="handleSlugClaimed"
      @skip="handleSlugSkipped"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import GriddleAnimation from '@/components/marketing/GriddleAnimation.vue';
import SlugClaimModal from '@/components/modal/SlugClaimModal.vue';
import Button from '@/components/ui-elements/Button.vue';
import { usePageTitle } from '@/composables/usePageTitle';
import { useGridCollectionStore } from '@/stores/grid/gridCollection';
import { useGridController } from '@/controllers/useGridController';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import ArrowRightIcon from '@/components/icons/ArrowRightIcon.vue';
import { useFeatureFlags } from '@/composables/useFeatureFlags';
import { ACCOUNT_RECOVERY_PATH } from '@/utils/emailChange';
import GridsMark from '@/components/icons/GridsMark.vue';
import { getMailProviderLink } from '@/utils/mailProviderLinks';
import { getEmailProblem, isValidEmail } from '@/utils/emailValidation';
import mailboxIcon from '@/assets/images/mailbox.svg';
import googleMonoIcon from '@/assets/images/google-mono.svg';
import googleColorIcon from '@/assets/images/google-g.svg';

const authProvider = getAuthProvider();
const userService = getServiceFactory().getUserService();

const email = ref('');
const router = useRouter();
const route = useRoute();
const collectionStore = useGridCollectionStore();
const controller = useGridController();

// Set page title
const pageTitle = ref('Sign In');
usePageTitle(pageTitle);

const isBusy = ref(false);
const isCompletingLink = ref(false);
const statusText = ref<string | null>(null);
const statusTone = ref<'info' | 'error'>('info');
const showSlugModal = ref(false);
const pendingRedirect = ref<string | null>(null);

const { isEnabled, FEATURE_FLAGS } = useFeatureFlags();
const canRecoverEmail = computed(() => isEnabled(FEATURE_FLAGS.ACCOUNT_EMAIL_CHANGE));
// Set by /account/change-email when a verified change ended the old session.
const emailChanged = computed(() => route.query.emailChanged === '1');

const AUTH_EMAIL_STORAGE_KEY = 'grids.auth.emailForSignIn';
const RESEND_COOLDOWN_SECONDS = 30;

// "Check your inbox" state: set once a link has been sent to this address.
const linkSentTo = ref<string | null>(null);
const isResending = ref(false);
const resendSecondsLeft = ref(0);
const resendStatus = ref<string | null>(null);
const resendTone = ref<'info' | 'error'>('info');
const emailInputRef = ref<HTMLInputElement | null>(null);
const sentHeadingRef = ref<HTMLElement | null>(null);
let resendTimer: ReturnType<typeof setInterval> | null = null;

const mailProviderLink = computed(() =>
  linkSentTo.value ? getMailProviderLink(linkSentTo.value) : null,
);

const sentEmailParts = computed(() => {
  const at = linkSentTo.value?.lastIndexOf('@') ?? -1;
  if (!linkSentTo.value || at <= 0) return null;
  return {
    // Split after separators so each piece ends at a natural break point.
    local: linkSentTo.value.slice(0, at).split(/(?<=[._+-])/),
    domain: linkSentTo.value.slice(at + 1),
  };
});

// Countdown ring around the resend button: full at the start of the cooldown,
// drains to empty as it runs out. 2πr for r = 8 in a 20×20 viewBox.
const RESEND_RING_CIRCUMFERENCE = 2 * Math.PI * 8;
const resendRingOffset = computed(
  () => RESEND_RING_CIRCUMFERENCE * (1 - resendSecondsLeft.value / RESEND_COOLDOWN_SECONDS),
);

const stopResendCooldown = () => {
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = null;
  resendSecondsLeft.value = 0;
};

const startResendCooldown = () => {
  stopResendCooldown();
  resendSecondsLeft.value = RESEND_COOLDOWN_SECONDS;
  resendTimer = setInterval(() => {
    resendSecondsLeft.value -= 1;
    if (resendSecondsLeft.value <= 0) stopResendCooldown();
  }, 1000);
};

onBeforeUnmount(stopResendCooldown);

const describeSendError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (/too-many-requests|quota-exceeded/i.test(message)) {
    return 'Too many sign-in emails were requested. Wait a few minutes and try again.';
  }
  return message || 'Could not send sign-in link.';
};

// Live email validation. Kept light; the auth provider validates for real.
// The hint waits until the user pauses typing, leaves the field or presses
// Enter, so it doesn't nag mid-word; once shown it tracks every keystroke and
// clears the moment the address becomes valid.
const EMAIL_ERROR_DELAY_MS = 800;
const isEmailValid = computed(() => isValidEmail(email.value));
const emailProblem = computed(() => getEmailProblem(email.value));
const isEmailErrorRevealed = ref(false);
const emailError = computed(() => (isEmailErrorRevealed.value ? emailProblem.value : null));
let emailErrorTimer: ReturnType<typeof setTimeout> | null = null;

const clearEmailErrorTimer = () => {
  if (emailErrorTimer) clearTimeout(emailErrorTimer);
  emailErrorTimer = null;
};

const revealEmailError = () => {
  clearEmailErrorTimer();
  if (emailProblem.value) isEmailErrorRevealed.value = true;
};

watch(email, () => {
  clearEmailErrorTimer();
  if (!emailProblem.value) {
    isEmailErrorRevealed.value = false;
  } else if (!isEmailErrorRevealed.value) {
    emailErrorTimer = setTimeout(revealEmailError, EMAIL_ERROR_DELAY_MS);
  }
});

onBeforeUnmount(clearEmailErrorTimer);

const handleEmailEnter = () => {
  if (isEmailValid.value) {
    void handleEmailContinue();
  } else {
    revealEmailError();
  }
};

/**
 * Check if user is new and needs to claim a slug
 * Returns the redirect path or null if slug modal should be shown
 */
const getPostAuthRedirect = async (): Promise<string | null> => {
  const redirect = route.query.redirect;
  
  // If there's an explicit redirect query param, honor it
  if (typeof redirect === 'string' && redirect.length > 0) {
    return redirect;
  }
  
  try {
    const userId = authProvider.getCurrentUserId();
    if (!userId) return '/dashboard';

    // Read the profile first. getUserProfile throws on a read failure, which
    // the catch below turns into a safe /dashboard redirect (never a grid
    // creation), so reaching this point means the profile actually loaded.
    const profile = await userService.getUserProfile(userId);
    const hasSlug = !!profile?.slug;
    // defaultGridId is the authoritative "this is an established account"
    // signal — it lives on the same user doc as slug and is set for every
    // returning user, so we trust it over a (fragile) grid-list count.
    const hasDefaultGrid = !!profile?.defaultGridId;

    // Fetch existing grids. The boolean tells us whether the read actually
    // succeeded — a swallowed failure must NOT be read as "zero grids".
    const gridsLoaded = await controller.fetchGrids();
    const gridCount = collectionStore.grids.length;

    // Established account — has a default grid or existing grids. Never
    // auto-create a grid or relocate the user; just go to the dashboard.
    if (hasDefaultGrid || (gridsLoaded && gridCount > 0)) {
      return '/dashboard';
    }

    // Couldn't confirm the account is empty (grid read failed). Bail safely
    // rather than risk creating a duplicate grid or a spurious slug prompt.
    if (!gridsLoaded) {
      return '/dashboard';
    }

    // Genuinely new account: no default grid and a successful read returned
    // zero grids. Create their first grid, and prompt for a slug if unset.
    const newGridId = await controller.createGrid('My First Grid');
    const targetPath = newGridId ? `/grid/${newGridId}` : '/dashboard';

    if (!hasSlug) {
      pendingRedirect.value = targetPath;
      showSlugModal.value = true;
      return null; // Don't redirect yet — slug modal handles it.
    }

    return targetPath;
  } catch (error) {
    console.error('Error checking user grids:', error);
    return '/dashboard';
  }
};

onMounted(() => {
  // Helpful for email-link completion (especially in the same browser where the link was requested).
  if (!email.value) {
    const storedEmail = window.localStorage.getItem(AUTH_EMAIL_STORAGE_KEY);
    if (storedEmail) email.value = storedEmail;
  }

  // Passwordless flow:
  // 1) We send a magic link to the user's email
  // 2) When the user clicks that link, the auth provider redirects back to /login with an email link
  // 3) We complete sign-in here and redirect into the app
  void maybeCompleteEmailLinkSignIn();
});

const maybeCompleteEmailLinkSignIn = async () => {
  try {
    if (!authProvider.isEmailSignInLink(window.location.href)) return;

    isCompletingLink.value = true;
    statusTone.value = 'info';
    statusText.value = 'Finishing sign-in…';

    const storedEmail = window.localStorage.getItem(AUTH_EMAIL_STORAGE_KEY);
    const resolvedEmail = storedEmail ?? email.value.trim();

    if (!resolvedEmail) {
      statusTone.value = 'error';
      statusText.value = 'Enter your email to finish signing in.';
      return;
    }

    await authProvider.completeEmailSignIn(resolvedEmail, window.location.href);
    window.localStorage.removeItem(AUTH_EMAIL_STORAGE_KEY);
    const redirectPath = await getPostAuthRedirect();
    if (redirectPath) {
      await router.replace(redirectPath);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Email link sign-in error:', errorMessage);
    statusTone.value = 'error';
    statusText.value = errorMessage ?? 'Could not complete sign-in.';
  } finally {
    isCompletingLink.value = false;
  }
};

const handleGoogleAuth = async () => {
  try {
    isBusy.value = true;
    statusText.value = null;
    await authProvider.signInWithGoogle();
    const redirectPath = await getPostAuthRedirect();
    if (redirectPath) {
      await router.replace(redirectPath);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Google Auth error:', errorMessage);
    statusTone.value = 'error';
    statusText.value = errorMessage ?? 'Google sign-in failed.';
  } finally {
    isBusy.value = false;
  }
};

const handleEmailContinue = async () => {
  const trimmedEmail = email.value.trim();
  if (!trimmedEmail || !isEmailValid.value) return;

  try {
    isBusy.value = true;
    statusTone.value = 'info';
    statusText.value = null;

    // Store email locally so we can complete sign-in after the user clicks the link.
    window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, trimmedEmail);

    await authProvider.sendEmailSignInLink(trimmedEmail, `${window.location.origin}/login`);
    resendStatus.value = null;
    linkSentTo.value = trimmedEmail;
    startResendCooldown();
  } catch (error) {
    console.error('Send email link error:', error);
    statusTone.value = 'error';
    statusText.value = describeSendError(error);
  } finally {
    isBusy.value = false;
  }
};

const handleResend = async () => {
  const sentTo = linkSentTo.value;
  if (!sentTo || isResending.value || resendSecondsLeft.value > 0) return;

  try {
    isResending.value = true;
    resendStatus.value = null;
    window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, sentTo);
    await authProvider.sendEmailSignInLink(sentTo, `${window.location.origin}/login`);
    resendTone.value = 'info';
    resendStatus.value = 'Sent a new link. It can take a minute to arrive.';
    startResendCooldown();
  } catch (error) {
    console.error('Resend email link error:', error);
    resendTone.value = 'error';
    resendStatus.value = describeSendError(error);
  } finally {
    isResending.value = false;
  }
};

const handleChangeEmail = () => {
  stopResendCooldown();
  resendStatus.value = null;
  statusText.value = null;
  linkSentTo.value = null;
};

// Move focus with the step swap so keyboard and screen-reader users land on
// the new content instead of a removed element.
const handleStepEntered = () => {
  if (linkSentTo.value) {
    sentHeadingRef.value?.focus();
  } else {
    emailInputRef.value?.focus();
    emailInputRef.value?.select();
  }
};

/**
 * Handle slug modal close - should not happen for new users since it's required
 */
const handleSlugModalClose = () => {
  showSlugModal.value = false;
  // Don't redirect on close - only on success
};

/**
 * Handle successful slug claim - redirect to pending destination
 */
const handleSlugClaimed = () => {
  showSlugModal.value = false;
  if (pendingRedirect.value) {
    router.replace(pendingRedirect.value);
    pendingRedirect.value = null;
  }
};

const handleSlugSkipped = () => {
  showSlugModal.value = false;
  const dest = pendingRedirect.value || '/dashboard';
  pendingRedirect.value = null;
  router.replace(dest);
};
</script>

<style scoped>
.auth-landing {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: var(--color-content-background);
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
}

.auth-landing__background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.auth-landing__background::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse at 50% 50%,
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 0.96) 89%,
      rgba(0, 0, 0, 0.55) 100%
    );
}

.auth-landing__content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: grid;
  /* minmax(0, …) stops the column growing to the card's min-content width
     (e.g. the email input + continue button), which pushed the card off the
     right edge on narrow phones. */
  grid-template-columns: minmax(0, 1fr);
  place-items: center;
  /* Symmetric block padding, at least the footer's height, so the card sits in
     the true centre of the viewport and never slides under the footer. */
  padding: max(80px, clamp(var(--spacing-xl), 6vw, 90px)) var(--spacing-lg);
}

/* Sign-in card, styled after Figma grids.so node 2074:5789. */
.auth-container {
  position: relative;
  width: 100%;
  max-width: 520px;
  padding: 36px 32px 24px;
  border-radius: 24px;
  background-color: var(--color-content-background);
}

.auth-step {
  display: flex;
  flex-direction: column;
  font-family: var(--mkt-font-sans);
  font-weight: 500;
  line-height: normal;
  color: #6c6c6c;
}

.auth-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.auth-intro__icon {
  display: block;
  width: 40px;
  height: 40px;
  margin-bottom: 4px;
  color: #fff;
}

.auth-heading {
  margin: 0;
  font-family: var(--mkt-font-brand);
  font-size: clamp(24px, 6vw, 28px);
  font-weight: 600;
  line-height: normal;
  color: #fff;
  white-space: nowrap;
}

.auth-heading:focus {
  outline: none;
}

.auth-lead {
  margin: 0;
  font-size: 15px;
}

.auth-step-enter-active,
.auth-step-leave-active {
  transition:
    opacity 160ms var(--easing-smooth),
    transform 160ms var(--easing-smooth);
}

.auth-step-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.auth-step-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .auth-step-enter-active,
  .auth-step-leave-active {
    transition: opacity 120ms linear;
  }

  .auth-step-enter-from,
  .auth-step-leave-to {
    transform: none;
  }
}

/* "Check your inbox" state */
.auth-sent {
  align-items: center;
  text-align: center;
}

.auth-sent__email {
  margin: 16px 0 0;
  max-width: 100%;
  padding: 6px 16px;
  border: 1px solid #fff;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  overflow-wrap: anywhere;
}

.auth-sent__main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 28px;
}

/* Two-class selector so these win over Button's own variant/size rules. */
.auth-sent .auth-sent__cta {
  --btn-icon-size: 20px;
  height: 52px;
  gap: 12px;
  border-radius: 12px;
  background: var(--mkt-brand-500);
  font-family: var(--mkt-font-sans);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: normal;
}

.auth-sent__hint {
  margin: 0;
  font-size: 14px;
}

.auth-sent__actions {
  align-self: stretch;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px 16px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 0.5px solid #6c6c6c;
  font-size: 14px;
}

/* Too narrow for both actions on one line (iPhone SE and smaller): stack them
   centred to match the rest of the card instead of wrapping flush-left. */
@media (max-width: 429px) {
  .auth-sent__actions {
    flex-direction: column;
    justify-content: center;
  }
}

/* Pill-style resend action. */
.resend-btn {
  width: auto;
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 0 10px;
  border: 1px solid color-mix(in srgb, #6c6c6c 60%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--easing-smooth),
    background-color var(--duration-fast) var(--easing-smooth),
    color var(--duration-fast) var(--easing-smooth);
}

.resend-btn:hover:not(:disabled) {
  border-color: var(--mkt-brand-500);
  background: color-mix(in srgb, var(--mkt-brand-500) 14%, transparent);
  color: #fff;
}

.resend-btn:hover:not(:disabled) .resend-btn__icon {
  transform: rotate(90deg);
}

.resend-btn:disabled {
  opacity: 1;
  background: transparent;
  cursor: default;
}

.resend-btn--waiting {
  border-color: color-mix(in srgb, #6c6c6c 30%, transparent);
  color: #6c6c6c;
  font-variant-numeric: tabular-nums;
}

.resend-btn__icon {
  flex-shrink: 0;
  transition: transform 240ms var(--easing-smooth);
}

.resend-btn--sending .resend-btn__icon {
  animation: resend-spin 800ms linear infinite;
}

@keyframes resend-spin {
  to {
    transform: rotate(360deg);
  }
}

.resend-btn__ring {
  flex-shrink: 0;
  transform: rotate(-90deg);
}

.resend-btn__ring-track,
.resend-btn__ring-progress {
  fill: none;
  stroke-width: 2.5;
}

.resend-btn__ring-track {
  stroke: color-mix(in srgb, #6c6c6c 35%, transparent);
}

.resend-btn__ring-progress {
  stroke: var(--mkt-brand-500);
  stroke-linecap: round;
  stroke-dasharray: 50.27;
  transition: stroke-dashoffset 1s linear;
}

.resend-btn:focus-visible {
  outline: 2px solid var(--mkt-brand-400);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .resend-btn__icon,
  .resend-btn__ring-progress {
    transition: none;
  }

  .resend-btn--sending .resend-btn__icon {
    animation: none;
  }
}

/* Text-style actions. */
.link-btn {
  /* Text-sized, but with a touch-friendly hit area. */
  min-height: 32px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: #6c6c6c;
  font: inherit;
}

.link-btn:hover:not(:disabled) {
  background: none;
  color: var(--color-text-primary);
}

.link-btn__accent {
  color: var(--mkt-brand-500);
  font-weight: 600;
}

.link-btn:hover .link-btn__accent {
  color: var(--mkt-brand-400);
}

.link-btn:disabled {
  opacity: 1;
  color: #6c6c6c;
  font-variant-numeric: tabular-nums;
}

.link-btn:focus-visible {
  outline: 2px solid var(--mkt-brand-400);
  outline-offset: 3px;
  border-radius: 2px;
}

/* Entry state */
.auth-entry .auth-intro {
  margin-bottom: 28px;
}

/* Google's light "Sign in with Google" button colours (per their branding
   guidelines). Two-class selector so these win over Button's own rules. */
.auth-entry .auth-google {
  --btn-icon-size: 20px;
  height: 52px;
  gap: 12px;
  border-radius: 12px;
  outline: none;
  border: 1px solid #747775;
  background: #fff;
  color: #1f1f1f;
  font-family: var(--mkt-font-sans);
  font-size: 16px;
  font-weight: 600;
}

.auth-entry .auth-google:hover:not(.ui-btn--disabled) {
  background: #f2f2f2;
  box-shadow:
    0 1px 2px rgba(60, 64, 67, 0.3),
    0 1px 3px 1px rgba(60, 64, 67, 0.15);
}

.auth-entry .auth-google:active:not(.ui-btn--disabled) {
  background: #e8e8e8;
}

.auth-entry .auth-google:focus-visible {
  outline: 2px solid var(--mkt-brand-400);
  outline-offset: 2px;
}

.or-block {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 20px 0;
  font-size: 13px;
  letter-spacing: 0.08em;
}

.or-block__line {
  flex: 1;
  border-top: 0.5px solid #6c6c6c;
}

.email-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.email-row input {
  flex: 1;
  min-width: 0;
  height: 52px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, #6c6c6c 60%, transparent);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
  font-family: var(--mkt-font-sans);
  font-size: 16px;
  font-weight: 500;
  transition:
    border-color var(--duration-fast) var(--easing-smooth),
    box-shadow var(--duration-fast) var(--easing-smooth);
}

.email-row input::placeholder {
  color: #6c6c6c;
}

.email-row input:focus {
  outline: none;
  border-color: var(--mkt-brand-500);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mkt-brand-500) 25%, transparent);
}

.email-row input:disabled {
  opacity: 0.6;
}

.email-row input.email-input--invalid,
.email-row input.email-input--invalid:focus {
  border-color: var(--destructive-color, #ff4d4d);
}

.email-row input.email-input--invalid:focus {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--destructive-color, #ff4d4d) 25%, transparent);
}

.auth-entry .email-error {
  margin-top: 8px;
  padding-left: 4px;
}

.email-error-enter-active,
.email-error-leave-active {
  transition:
    opacity 140ms var(--easing-smooth),
    transform 140ms var(--easing-smooth);
}

.email-error-enter-from,
.email-error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .email-error-enter-active,
  .email-error-leave-active {
    transition: opacity 120ms linear;
  }

  .email-error-enter-from,
  .email-error-leave-to {
    transform: none;
  }
}

.email-continue-btn {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  padding: 0;
  display: none;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 12px;
  background-color: var(--mkt-brand-500);
  color: #fff;
  cursor: pointer;
  line-height: 0;
  opacity: 0;
  transform: translateX(-6px) scale(0.96);
  pointer-events: none;
  transition:
    transform var(--duration-fast) var(--easing-smooth),
    background-color var(--duration-fast) var(--easing-smooth),
    opacity 160ms var(--easing-smooth);
}

.email-continue-btn svg {
  width: 20px;
  height: 20px;
  display: block;
}

.email-continue-btn--visible {
  display: inline-flex;
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}

.email-continue-btn:hover:not(:disabled) {
  background-color: var(--mkt-brand-400);
}

.email-continue-btn:focus-visible {
  outline: 2px solid var(--mkt-brand-400);
  outline-offset: 2px;
}

.email-continue-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* The send-error line, not the inline email hint (also a .status). */
.auth-entry > .status {
  margin: 12px 0 24px;
}

/* The error region below holds one line of space even when empty, so the hint
   appearing doesn't grow (and re-centre) the card. It stands in for the card's
   bottom padding in this step. */
.auth-container.auth-container--entry {
  padding-bottom: 0;
}

.email-error-region {
  min-height: 26px;
}

.status {
  margin: 0;
  font-size: 14px;
  color: var(--color-content-high);
}

.status.error {
  color: var(--destructive-color, #ff4d4d);
}

.status--notice {
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  background-color: var(--color-content-background);
  text-align: center;
}

.auth-recover-link {
  align-self: center;
  font-size: 13px;
  color: var(--color-content-default);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.auth-recover-link:hover {
  color: var(--color-text-primary);
}

.fineprint {
  margin: 0;
  font-size: 12px;
  color: var(--color-content-default);
}

.legal-links {
  margin: 0;
  font-size: 12px;
  color: var(--color-content-default);
}

.legal-links a {
  color: inherit;
  text-decoration: none;
}

.legal-links a:hover {
  color: var(--color-content-high);
  text-decoration: underline;
}

.legal-links__separator {
  margin: 0 8px;
  opacity: 0.7;
}

/* Overlaid rather than in flow, so it doesn't push the centred card upward. */
.auth-landing__footer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  color: var(--color-content-low);
}

.auth-landing__footer-link {
  color: var(--color-content-low);
  text-decoration: none;
  transition: color var(--duration-fast) var(--easing-smooth);
}

/* Short screens (e.g. 320×568 iPhone SE): the card nearly fills the height, so
   slim the footer and shrink the reserved block padding to match it. The card
   stays centred and still clears the footer. */
@media (max-height: 640px) {
  /* The bottom padding stays taller than the ~54px footer, so a card taller
     than the screen (landscape phones) scrolls clear of it. */
  .auth-landing__content {
    padding-block: 40px 64px;
  }

  .auth-landing__footer {
    padding: 12px var(--spacing-lg);
  }
}

/* Very narrow phones: give the card's content more of the width. */
@media (max-width: 359px) {
  .auth-container {
    padding: 28px 20px 20px;
  }

  .auth-sent__main,
  .auth-sent__actions {
    margin-top: 20px;
  }

  .auth-sent__email {
    font-size: 14px;
  }
}

.auth-landing__footer-link:hover {
  color: var(--color-content-high);
}

.auth-landing__footer-sep {
  color: var(--color-content-low);
}
</style>
