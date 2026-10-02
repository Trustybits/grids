<template>
  <div class="account-page">
    <div v-if="status !== 'modal'" class="account-card" :aria-busy="status === 'loading'">
      <div v-if="status === 'loading'" class="account-card__state">
        <SpinnerIcon :size="32" />
        <p>{{ loadingText }}</p>
      </div>

      <div v-else-if="status === 'sent'" class="account-card__state" role="status">
        <SuccessCircleIcon :size="40" />
        <h1>Check your new inbox</h1>
        <p>
          We sent a confirmation link to <strong>{{ sentTo }}</strong>. Your
          email changes once you open it.
        </p>
        <Button variant="primary" block to="/dashboard">Back to dashboard</Button>
      </div>

      <div v-else class="account-card__state" role="alert">
        <ErrorCircleIcon :size="40" />
        <h1>We couldn’t change your email</h1>
        <p>{{ errorText }}</p>
        <Button variant="primary" block @click="openModal">Try again</Button>
        <Button variant="ghost" block to="/dashboard">Back to dashboard</Button>
      </div>
    </div>

    <ChangeEmailModal
      :is-open="status === 'modal'"
      :current-email="currentEmail"
      :initial-new-email="initialNewEmail"
      @close="leave"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import { useToastStore } from '@/stores/toast';
import { usePageTitle } from '@/composables/usePageTitle';
import ChangeEmailModal from '@/components/modal/ChangeEmailModal.vue';
import Button from '@/components/ui-elements/Button.vue';
import SpinnerIcon from '@/components/icons/SpinnerIcon.vue';
import SuccessCircleIcon from '@/components/icons/SuccessCircleIcon.vue';
import ErrorCircleIcon from '@/components/icons/ErrorCircleIcon.vue';
import {
  CHANGE_EMAIL_PATH,
  describeEmailChangeError,
  emailChangeContinueUrl,
  readPendingNewEmail,
  writePendingNewEmail,
} from '@/utils/emailChange';

/**
 * Landing page for every email-change link:
 * - `?done=1`: back from Firebase's verification page — sync the new email.
 * - an email sign-in link: back from confirming identity via the current
 *   inbox — finish re-auth, then send the verification to the new address.
 * - otherwise: show the change-email form.
 */
type Status = 'loading' | 'modal' | 'sent' | 'error';

const route = useRoute();
const router = useRouter();
const authProvider = getAuthProvider();
const toastStore = useToastStore();

usePageTitle(ref('Change Email'));

const status = ref<Status>('loading');
const loadingText = ref('Just a moment…');
const errorText = ref('');
const sentTo = ref('');
const currentEmail = ref<string | null>(authProvider.getCurrentUser()?.email ?? null);
const initialNewEmail = ref('');

const leave = () => {
  void router.replace('/dashboard');
};

const openModal = () => {
  currentEmail.value = authProvider.getCurrentUser()?.email ?? null;
  status.value = 'modal';
};

const finishVerifiedChange = async () => {
  loadingText.value = 'Updating your account…';
  try {
    const user = await authProvider.reloadCurrentUser();
    if (!user) throw new Error('Signed out');
    if (user.email) {
      // Keep the profile copy in sync now rather than at the next sign-in.
      await getServiceFactory()
        .getUserService()
        .updateUserProfile(user.uid, { email: user.email })
        .catch(() => undefined);
    }
    toastStore.addToast(
      user.email ? `Email updated to ${user.email}` : 'Email updated',
      'success',
      5000,
    );
    await router.replace('/dashboard');
  } catch {
    // Changing the email can revoke existing sessions; sign in fresh.
    await authProvider.signOut().catch(() => undefined);
    await router.replace({ path: '/login', query: { emailChanged: '1' } });
  }
};

const finishEmailLinkReauth = async (link: string) => {
  loadingText.value = 'Confirming it’s you…';
  const pending = readPendingNewEmail();
  // Drop the one-time link from the address bar either way.
  void router.replace(CHANGE_EMAIL_PATH);
  try {
    await authProvider.reauthenticateWithEmailLink(link);
    if (!pending) {
      openModal();
      return;
    }
    await authProvider.requestEmailChange(pending, emailChangeContinueUrl());
    writePendingNewEmail(null);
    sentTo.value = pending;
    status.value = 'sent';
  } catch (error) {
    initialNewEmail.value = pending ?? '';
    errorText.value = describeEmailChangeError(error);
    status.value = 'error';
  }
};

onMounted(async () => {
  if (route.query.done === '1') {
    await finishVerifiedChange();
    return;
  }
  const href = window.location.href;
  if (authProvider.isEmailSignInLink(href)) {
    await finishEmailLinkReauth(href);
    return;
  }
  initialNewEmail.value = readPendingNewEmail() ?? '';
  openModal();
});
</script>

<style scoped>
.account-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  box-sizing: border-box;
  background-color: var(--color-background);
}

.account-card {
  width: min(420px, 100%);
  padding: var(--spacing-xl, 32px) var(--spacing-lg);
  border-radius: var(--radius-md, 12px);
  background-color: var(--color-content-background);
  border: var(--border-width) solid var(--color-stroke);
  box-sizing: border-box;
}

.account-card__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  text-align: center;
  color: var(--color-text-primary);
}

.account-card__state h1 {
  margin: 0;
  font-size: 20px;
}

.account-card__state p {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-content-default);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.account-card__state strong {
  color: var(--color-text-primary);
}
</style>
