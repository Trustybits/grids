<template>
  <div class="auth-page">
    <div class="auth-container bkg-secondary">
      
      <div class="loginTabs">
        <button
          class="tabButton"
          :class="{ active: isLogin }"
          @click="setAuthMode(true)"
        >
          Login
        </button>
        <button
          class="tabButton"
          :class="{ active: !isLogin }"
          @click="setAuthMode(false)"
        >
          Sign Up
        </button>
      </div>

      <button @click="handleGoogleAuth" class="google-btn">
        <i class="fab fa-google"></i> {{ isLogin ? 'Login' : 'Join' }} with Google
      </button>

      <div id="orBlock">
        <hr class="solidDivider" />
        <p>OR</p>
        <hr class="solidDivider" />
      </div>

      <input v-model="email" placeholder="Email" />
      <input v-model="password" type="password" placeholder="Password" />
      <button @click="handleAuth">{{ isLogin ? 'Login with Email' : 'Sign Up with Email' }}</button>

      <p id="signUpText">
        {{ isLogin ? "Don't have an account?" : "Already have an account?" }}
        <a href="#" @click.prevent="toggleMode">{{ isLogin ? 'Sign Up' : 'Login' }}</a>
      </p>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';

const email = ref('');
const password = ref('');
const router = useRouter();
const route = useRoute();

const isLogin = ref(true);

// Check route on mount
onMounted(() => {
  if (route.path.toLowerCase().includes('signup')) {
    isLogin.value = false;
  }
});

const setAuthMode = (mode) => {
  isLogin.value = mode;
};

const toggleMode = () => {
  isLogin.value = !isLogin.value;
};

const handleAuth = async () => {
  try {
    if (isLogin.value) {
      await signInWithEmailAndPassword(auth, email.value, password.value);
    } else {
      await createUserWithEmailAndPassword(auth, email.value, password.value);
    }
    router.push('/dashboard');
  } catch (error) {
    console.error('Auth error:', error.message);
  }
};

const handleGoogleAuth = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    router.push('/dashboard');
  } catch (error) {
    console.error('Google Auth error:', error.message);
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
}

.auth-container {
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: fit-content;
  background-color: var(--color-tile-background);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
}

input {
  display: block;
  width: 100%;
  height: 40px;
  padding: var(--spacing-sm);
  margin: var(--spacing-sm) 0;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  font-family: var(--font-family-base);
  transition: border-color var(--duration-fast) var(--easing-smooth);
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
  margin-top: var(--spacing-sm);
  border: none;
  transition: background-color var(--duration-fast) var(--easing-smooth);
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

.loginTabs {
  overflow: hidden;
  display: flex;
  flex-direction: row;
  border: var(--tile-border-width) solid var(--color-tile-stroke);
  border-radius: var(--radius-full);
  justify-content: space-evenly;
  align-items: center;
  width: fit-content;
  height: 40px;
  margin-bottom: var(--spacing-xl);
  background-color: var(--color-content-background);
}

.loginTabs button {
  width: 120px;
  background-color: transparent;
  border-radius: var(--radius-full);
  transition: background-color var(--duration-fast) var(--easing-smooth);
}

.tabButton {
  margin-top: 0;
}

.loginTabs .tabButton:hover {
  background-color: var(--color-content-low);
}

.loginTabs .tabButton.active {
  background-color: var(--color-content-default);
}

#signUpText {
  color: var(--color-content-default);
  margin-top: var(--spacing-md);
}

a {
  color: var(--primary-color);
  cursor: pointer;
}

a:hover {
  text-decoration: underline;
}

#orBlock {
  width: 360px;
  padding: var(--spacing-xs);
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md);
}

.solidDivider {
  border: 1px solid var(--color-tile-stroke);
  border-radius: 1px;
  width: 100%;
}
</style>
