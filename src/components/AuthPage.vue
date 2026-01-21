<template>
  <div class="auth-page">
    <div class="auth-background" aria-hidden="true"></div>

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
          autocomplete="email"
          placeholder="you@domain.com"
          :disabled="isBusy || isCompletingLink"
          @keydown.enter.prevent="handleEmailContinue"
        />
        <button
          class="primary-btn"
          @click="handleEmailContinue"
          :disabled="isBusy || isCompletingLink || !isEmailValid"
        >
          Continue
        </button>
      </div>

      <p v-if="statusText" class="status" :class="{ error: statusTone === 'error' }">
        {{ statusText }}
      </p>

      <p class="fineprint">
        By continuing, you agree to receive a sign-in link at your email.
      </p>

      <p class="legal-links">
        <router-link to="/terms">Terms</router-link>
        <span class="legal-links__separator">·</span>
        <router-link to="/privacy">Privacy</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { auth } from '../firebase';
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

const isBusy = ref(false);
const isCompletingLink = ref(false);
const statusText = ref<string | null>(null);
const statusTone = ref<'info' | 'error'>('info');

const AUTH_EMAIL_STORAGE_KEY = 'grids.auth.emailForSignIn';

const isEmailValid = computed(() => {
  // Keep validation light; Firebase will validate server-side.
  return /\S+@\S+\.[\S]+/.test(email.value.trim());
});

const getPostAuthRedirect = () => {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.length > 0
    ? redirect
    : '/dashboard';
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
    await router.replace(getPostAuthRedirect());
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
    await router.replace(getPostAuthRedirect());
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
  if (!trimmedEmail) return;

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
</script>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--color-content-background);
  position: relative;
  overflow: hidden;
}

.auth-background {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(800px circle at 20% 20%, rgba(86, 61, 255, 0.28), transparent 60%),
    radial-gradient(900px circle at 80% 30%, rgba(0, 209, 255, 0.22), transparent 55%),
    radial-gradient(900px circle at 60% 85%, rgba(255, 0, 128, 0.16), transparent 60%),
    radial-gradient(1100px circle at 40% 75%, rgba(0, 255, 149, 0.10), transparent 55%);
  filter: blur(10px);
  transform: scale(1.05);
  animation: floatBackground 14s ease-in-out infinite;
  pointer-events: none;
}

@keyframes floatBackground {
  0% {
    transform: scale(1.05) translate3d(0, 0, 0);
  }
  50% {
    transform: scale(1.1) translate3d(0, -10px, 0);
  }
  100% {
    transform: scale(1.05) translate3d(0, 0, 0);
  }
}

.auth-container {
  position: relative;
  z-index: 1;
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
  border: var(--tile-border-width) solid var(--color-tile-stroke);
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
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--spacing-sm);
  align-items: center;
}

.primary-btn {
  width: auto;
  min-width: 120px;
  height: 40px;
  margin: 0;
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

.solidDivider {
  border: 1px solid var(--color-tile-stroke);
  border-radius: 1px;
  width: 100%;
}
</style>
