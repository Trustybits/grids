<template>
  <nav class="navbar navbar-expand-lg bkg-neutral txt-primary">
    <div class="container-fluid container">
      <LayoutTitleEditor v-if="showTitleEditor" :isAuthenticated="!!user" />
      <h2 v-else>Grid</h2>

      <div class="nav-links">
        <router-link to="/" class="nav-link">🏠</router-link>
        <router-link v-if="user" to="/dashboard" class="nav-link">🍱</router-link>
        <button v-if="user" class="nav-link logout-btn" @click="logout">🚪</button>
        <div v-else class="user-icon" @click="redirectToLogin">
          <i class="fas fa-user"></i>
        </div>
      </div>

      <ThemeToggle />
    </div>
  </nav>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { auth } from "@/firebase";
import { signOut, onAuthStateChanged, type User } from "firebase/auth";
import { useThemeStore } from "@/stores/theme";
import { useLayoutStore } from "@/stores/layout";
import ThemeToggle from "./ThemeToggle.vue";
import LayoutTitleEditor from "./LayoutTitleEditor.vue";

export default defineComponent({
  name: "Navbar",
  components: {
    ThemeToggle,
    LayoutTitleEditor,
  },
  setup() {
    const themeStore = useThemeStore();
    const router = useRouter();
    const route = useRoute();
    const user = ref<User | null>(null);
    const layoutStore = useLayoutStore();

    const showTitleEditor = computed(() => {
      return (
        layoutStore.currentLayout &&
        route.path.startsWith("/grid")
      );
    });

    onMounted(() => {
      themeStore.initializeTheme();
      onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;
      });
    });

    const logout = async () => {
      await signOut(auth);
      router.push("/login");
    };

    const redirectToLogin = () => {
      router.push("/login");
    };

    return {
      themeStore,
      user,
      logout,
      redirectToLogin,
      layoutStore,
      showTitleEditor,
    };
  },
});
</script>

<style scoped>
h2 {
  color: var(--text-color);
}

.navbar {
  position: sticky;
  width: 100%;
  backdrop-filter: blur(20px);
  z-index: 2;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 15px;
}

.nav-link {
  text-decoration: none;
  color: var(--primary-color);
  font-weight: bold;
  cursor: pointer;
}

.nav-link:hover {
  text-decoration: underline;
}

.logout-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  font-weight: bold;
  cursor: pointer;
}

.logout-btn:hover {
  text-decoration: underline;
}

.user-icon {
  cursor: pointer;
  font-size: 1.5rem;
  color: var(--primary-color);
}
</style>
