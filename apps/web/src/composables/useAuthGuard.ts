import { useRouter } from "vue-router";
import { ref } from "vue";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";

const isAuthChecked = ref(false);

export function useAuthGuard() {
  const router = useRouter();

  getAuthProvider().onAuthStateChanged((user) => {
    if (user) {
      // user is already logged in
    } else {
      router.push("/login"); // Redirect if not authenticated
    }
    isAuthChecked.value = true; // Indicate auth state has been checked
  });

  return { isAuthChecked };
}
