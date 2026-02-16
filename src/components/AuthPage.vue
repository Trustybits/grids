<template>
  <div class="auth-landing">
    <div class="auth-landing__background" aria-hidden="true">
      <GriddleAnimation />
    </div>

    <main class="auth-landing__content">
      <div class="auth-container">
        <div class="auth-header">
          <h1 class="auth-title">Welcome to Grids</h1>
          <p class="auth-subtitle">Sign in with Google or continue with your email.</p>
        </div>

        <button @click="handleGoogleAuth" class="google-btn" :disabled="isBusy">
          <i class="fab fa-google"></i>
          Continue with Google
        </button>

        <div class="or-block">
          <hr class="solidDivider" />
          <p>OR</p>
          <hr class="solidDivider" />
        </div>

        <div class="email-row">
          <input
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
            :disabled="isBusy || isCompletingLink"
            @keydown.enter.prevent="isEmailValid && handleEmailContinue()"
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
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M13.5 5.5a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 1 1-1.4-1.4l4.3-4.3H4a1 1 0 1 1 0-2h13.8l-4.3-4.3a1 1 0 0 1 0-1.4Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <p v-if="statusText" class="status" :class="{ error: statusTone === 'error' }">
          {{ statusText }}
        </p>
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
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { auth } from '../firebase';
import GriddleAnimation from '@/components/GriddleAnimation.vue';
import SlugClaimModal from '@/components/SlugClaimModal.vue';
import { usePageTitle } from '@/composables/usePageTitle';
import { useLayoutStore } from '@/stores/layout';
import { getUserProfile } from '@/services/UserProfileService';
import {
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';

const email = ref('');
const router = useRouter();
const route = useRoute();
const layoutStore = useLayoutStore();

// Set page title
const pageTitle = ref('Sign In');
usePageTitle(pageTitle);

const isBusy = ref(false);
const isCompletingLink = ref(false);
const statusText = ref<string | null>(null);
const statusTone = ref<'info' | 'error'>('info');
const showSlugModal = ref(false);
const pendingRedirect = ref<string | null>(null);

const AUTH_EMAIL_STORAGE_KEY = 'grids.auth.emailForSignIn';

const isEmailValid = computed(() => {
  // Keep validation light; Firebase will validate server-side.
  return /\S+@\S+\.[\S]+/.test(email.value.trim());
});

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
    const userId = auth.currentUser?.uid;
    if (!userId) return '/dashboard';

    // Check if user has a slug
    const profile = await getUserProfile(userId);
    const hasSlug = !!profile?.slug;

    // Fetch user's existing grids to determine if they're a new user
    await layoutStore.fetchLayouts();
    const isNewUser = layoutStore.layouts.length === 0;
    
    // If new user without slug, show slug modal first
    if (isNewUser && !hasSlug) {
      // Create default grid for them
      const newGridId = await layoutStore.createLayout('My First Grid');
      const targetPath = newGridId ? `/grid/${newGridId}` : '/dashboard';
      
      // Store the redirect path and show slug modal
      pendingRedirect.value = targetPath;
      showSlugModal.value = true;
      return null; // Don't redirect yet
    }
    
    // If user has no grids but has a slug (edge case), create a grid
    if (isNewUser) {
      const newGridId = await layoutStore.createLayout('My First Grid');
      if (newGridId) {
        return `/grid/${newGridId}`;
      }
    }
    
    // Existing user with grids - send to dashboard
    return '/dashboard';
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
  // 2) When the user clicks that link, Firebase redirects back to /login with an email link
  // 3) We complete sign-in here and redirect into the app
  void maybeCompleteEmailLinkSignIn();
});

const maybeCompleteEmailLinkSignIn = async () => {
  try {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

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

    await signInWithEmailLink(auth, resolvedEmail, window.location.href);
    window.localStorage.removeItem(AUTH_EMAIL_STORAGE_KEY);
    const redirectPath = await getPostAuthRedirect();
    if (redirectPath) {
      await router.replace(redirectPath);
    }
  } catch (error: any) {
    console.error('Email link sign-in error:', error?.message);
    statusTone.value = 'error';
    statusText.value = error?.message ?? 'Could not complete sign-in.';
  } finally {
    isCompletingLink.value = false;
  }
};

const handleGoogleAuth = async () => {
  const provider = new GoogleAuthProvider();
  try {
    isBusy.value = true;
    statusText.value = null;
    await signInWithPopup(auth, provider);
    const redirectPath = await getPostAuthRedirect();
    if (redirectPath) {
      await router.replace(redirectPath);
    }
  } catch (error: any) {
    console.error('Google Auth error:', error?.message);
    statusTone.value = 'error';
    statusText.value = error?.message ?? 'Google sign-in failed.';
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

    const actionCodeSettings = {
      // Must be an allowed auth domain + whitelisted redirect URL in Firebase Auth settings.
      url: `${window.location.origin}/login`,
      handleCodeInApp: true,
    };

    await sendSignInLinkToEmail(auth, trimmedEmail, actionCodeSettings);
    statusText.value = `Check ${trimmedEmail} for your sign-in link.`;
  } catch (error: any) {
    console.error('Send email link error:', error?.message);
    statusTone.value = 'error';
    statusText.value = error?.message ?? 'Could not send sign-in link.';
  } finally {
    isBusy.value = false;
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
  place-items: center;
  padding: clamp(var(--spacing-xl), 6vw, 90px) var(--spacing-lg);
}

.auth-container {
  position: relative;
  padding: clamp(20px, 4vw, var(--spacing-xl));
  border-radius: var(--radius-lg);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: min(520px, calc(100vw - 32px));
  background-color: color-mix(in srgb, var(--color-tile-background) 86%, transparent);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  backdrop-filter: blur(20px);
}

.auth-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-title {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  color: var(--color-text-primary);
}

.auth-subtitle {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
}

input {
  display: block;
  width: 100%;
  height: 40px;
  padding: var(--spacing-sm);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  font-family: var(--font-family-base);
}

input:focus {
  outline: none;
  border-color: var(--color-content-high);
}

button {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  font-family: var(--font-family-base);
  cursor: pointer;
  border: none;
  transition: background-color var(--duration-fast) var(--easing-smooth);
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

button:hover {
  background-color: var(--color-content-high);
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-content-background);
  color: var(--color-text-primary);
}

.google-btn i {
  margin-right: var(--spacing-sm);
}

.or-block {
  width: 100%;
  padding: var(--spacing-xs) 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-content-default);
}

.email-row {
  display: flex;
  grid-template-columns: 1fr auto;
  gap: var(--spacing-xs);
  align-items: center;

  .input {
    flex: 1;
    width: 100%;
  }
}

.email-continue-btn {
  width: 0px;
  height: 40px;
  padding: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-sizing: border-box;
  line-height: 0;
  opacity: 0;
  transform: translateX(-6px) scale(0.96);
  pointer-events: none;
  transition:
    transform var(--duration-fast) var(--easing-smooth),
    background-color var(--duration-fast) var(--easing-smooth),
    border-color var(--duration-fast) var(--easing-smooth),
    opacity 160ms var(--easing-smooth);
}

.email-continue-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}

.email-continue-btn--visible {
  display: inline-flex;
  width: 40px;
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}

.email-continue-btn:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-tile-background) 35%, transparent);
  border-color: var(--color-content-high);
}

.email-continue-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin: 0;
  font-size: 14px;
  color: var(--color-content-high);
}

.status.error {
  color: var(--destructive-color, #ff4d4d);
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

.solidDivider {
  border: 1px solid var(--color-tile-stroke);
  border-radius: 1px;
  width: 100%;
}

.auth-landing__footer {
  position: relative;
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

.auth-landing__footer-link:hover {
  color: var(--color-content-high);
}

.auth-landing__footer-sep {
  color: var(--color-content-low);
}
</style>
