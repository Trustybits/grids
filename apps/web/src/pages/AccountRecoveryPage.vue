<template>
  <div class="account-page">
    <main class="account-card">
      <h1>Lost access to your email?</h1>
      <p class="account-card__lede">
        If you can’t receive mail at the address on your Grids account, we can
        help you move it to a new one.
      </p>
      <EmailRecoveryPanel :signed-in="isSignedIn" @redeemed="handleRedeemed" />
      <router-link class="account-card__back" to="/login">Back to sign in</router-link>
    </main>

    <ChangeEmailModal
      :is-open="showChangeEmail"
      :current-email="recoveredEmail"
      @close="leave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { AuthUser } from '@grids/contracts/auth';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import { usePageTitle } from '@/composables/usePageTitle';
import EmailRecoveryPanel from '@/components/account/EmailRecoveryPanel.vue';
import ChangeEmailModal from '@/components/modal/ChangeEmailModal.vue';

const router = useRouter();
const authProvider = getAuthProvider();

usePageTitle(ref('Account Recovery'));

const isSignedIn = ref(!!authProvider.getCurrentUserId());
const showChangeEmail = ref(false);
const recoveredEmail = ref<string | null>(null);

/**
 * The code signed the user in, which satisfies the recent-login requirement,
 * so open the change-email form right here. (Navigating to a guarded route
 * straight after a fresh sign-in races the login bookkeeping write and can
 * bounce the user to the dashboard.)
 */
const handleRedeemed = (user: AuthUser) => {
  isSignedIn.value = true;
  recoveredEmail.value = user.email;
  showChangeEmail.value = true;
};

const leave = () => {
  showChangeEmail.value = false;
  void router.replace('/dashboard');
};
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
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-xl, 32px) var(--spacing-lg);
  border-radius: var(--radius-md, 12px);
  background-color: var(--color-content-background);
  border: var(--border-width) solid var(--color-stroke);
  box-sizing: border-box;
}

.account-card h1 {
  margin: 0;
  font-size: 22px;
  color: var(--color-text-primary);
}

.account-card__lede {
  margin: 0;
  color: var(--color-content-default);
  font-size: 14px;
  line-height: 1.5;
}

.account-card__back {
  align-self: center;
  font-size: 13px;
  color: var(--color-content-default);
}

@media (max-width: 600px) {
  .account-page {
    padding: var(--spacing-md);
  }

  .account-card {
    padding: var(--spacing-lg) var(--spacing-md);
  }
}
</style>
