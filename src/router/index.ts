import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/components/HomePage.vue';
import GridPage from '@/components/GridPage.vue';
import AuthPage from '@/components/AuthPage.vue';
import DashboardPage from '@/components/DashboardPage.vue';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import posthog from 'posthog-js';

// Define routes
const routes = [
  { path: '/', component: HomePage },
  { path: '/login', component: AuthPage },
  { path: '/signup', redirect: '/login' },
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

  const resolveNavigation = (user: unknown) => {
    // Firebase restores auth state asynchronously on page load. Use the first
    // onAuthStateChanged callback to make an accurate decision for the landing route.
    if (to.path === '/') {
      if (user) {
        next('/dashboard');
        return;
      }

      next();
      return;
    }

    // If already authenticated, keep /login as a transient entry point and redirect into the app.
    if (to.path === '/login' && user) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : null;
      next(redirect && redirect.length > 0 ? redirect : '/dashboard');
      return;
    }

    if (to.meta.requiresAuth && !user) {
      next({
        path: '/login',
        query: {
          redirect: to.fullPath,
        },
      }); // Redirect to login if not authenticated
      return;
    }

    next();
  };

  if (!isAuthChecked) {
    // Wait for Firebase Auth to initialize
    onAuthStateChanged(auth, (user) => {
      isAuthChecked = true;

      resolveNavigation(user);
    });
  } else {
    const user = auth.currentUser;

    resolveNavigation(user);
  }
});

// Track page views with PostHog
router.afterEach((to) => {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
    });
  }
});

export default router;
