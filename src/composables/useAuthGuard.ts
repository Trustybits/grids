import { onAuthStateChanged, getAuth } from "firebase/auth";
import { useRouter } from "vue-router";
import { ref } from "vue";

const isAuthChecked = ref(false);

export function useAuthGuard() {
  const router = useRouter();
  const auth = getAuth();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User is logged in:", user);
    } else {
      router.push("/login"); // Redirect if not authenticated
    }
    isAuthChecked.value = true; // Indicate auth state has been checked
  });

  return { isAuthChecked };
}
