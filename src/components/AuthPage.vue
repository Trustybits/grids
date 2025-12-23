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
}

.auth-container {
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: fit-content;
}

input {
  display: block;
  width: 100%;
  height: 40px;
  padding: 0.8rem;
  margin: 0.5rem 0;
  border: solid white 1px;
  border-radius: 8px;
  color: gray;
  background-color: #1E1E1E;
}

button {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  color: white;
  background-color: #4DB6AC;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 0.5rem;
}

button:hover {
  background-color: #69F1E4;
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1E1E1E;
  color: white;
  border: solid white 1px;
}

.google-btn i {
  margin-right: 0.5rem;
}

.loginTabs {
  overflow: hidden;
  display: flex;
  flex-direction: row;
  border: solid #ffffff41 1px;
  border-radius: 20px;
  justify-content: space-evenly;
  align-items: center;
  width: fit-content;
  height: 40px;
  margin-bottom: 40px;
}

.loginTabs button {
  width: 120px;
  background-color: inherit;
  border-radius: 20px;
  transition: 0.3s;
}

.tabButton {
  margin-top: 0;
}

.loginTabs .tabButton:hover {
  background-color: #ffffff28;
}

.loginTabs .tabButton.active {
  background-color: #ffffff41;
}

#signUpText {
  color: gray;
  margin-top: 1rem;
}

a {
  color: #007bff;
  cursor: pointer;
}

a:hover {
  text-decoration: underline;
}

#orBlock {
  width: 360px;
  padding: 4px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.solidDivider {
  border: solid white 1px;
  border-radius: 1px;
  width: 100%;
}
</style>
