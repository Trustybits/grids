import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/components/HomePage.vue';
import GridPage from '@/components/GridPage.vue';
import AuthPage from '@/components/AuthPage.vue';
import DashboardPage from '@/components/DashboardPage.vue';
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Define routes
const routes = [
  { path: '/', component: HomePage },
  { path: '/login', component: AuthPage },
  { path: '/signup', component: AuthPage },
  {
    path: '/dashboard',
    component: DashboardPage,
    meta: { requiresAuth: true } // Protect this route
  },
  { 
    path: '/grid/:id', 
    component: GridPage, 
    meta: { requiresAuth: false } 
  },
];

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation Guard for Auth Protection
let isAuthChecked = false;

router.beforeEach((to, from, next) => {
  const auth = getAuth();

  if (!isAuthChecked) {
    // Wait for Firebase Auth to initialize
    onAuthStateChanged(auth, (user) => {
      isAuthChecked = true;

      if (to.meta.requiresAuth && !user) {
        next('/login'); // Redirect to login if not authenticated
      } else {
        next(); // Allow navigation
      }
    });
  } else {
    const user = auth.currentUser;

    if (to.meta.requiresAuth && !user) {
      next('/login');
    } else {
      next();
    }
  }
});

export default router;
