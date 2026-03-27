import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/components/HomePage.vue';
import GridPage from '@/components/GridPage.vue';
import AuthPage from '@/components/AuthPage.vue';
import DashboardPage from '@/components/DashboardPage.vue';
import PrivacyPage from '@/components/PrivacyPage.vue';
import TermsPage from '@/components/TermsPage.vue';
import PricingPage from '@/components/PricingPage.vue';
import UserSlugPage from '@/components/UserSlugPage.vue';
import NotionCallback from '@/components/NotionCallback.vue';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getUserProfile } from '@/services/UserProfileService';
import posthog from 'posthog-js';

// Define routes
const routes = [
  { path: '/', component: HomePage },
  { path: '/login', component: AuthPage },
  { path: '/signup', redirect: '/login' },
  {
    path: '/dashboard',
    component: DashboardPage,
    meta: { requiresAuth: true }
  },
  { 
    path: '/grid/:id', 
    component: GridPage, 
    meta: { requiresAuth: false } 
  },
  {
    path: '/privacy',
    component: PrivacyPage,
    meta: { requiresAuth: false },
  },
  {
    path: '/terms',
    component: TermsPage,
    meta: { requiresAuth: false },
  },
  {
    path: '/pricing',
    component: PricingPage,
    meta: { requiresAuth: false },
  },
  {
    // Handles the Notion OAuth redirect — must be before /:slug to avoid being caught by it
    path: '/notion-callback',
    component: NotionCallback,
    meta: { requiresAuth: false },
  },
  {
    path: '/:slug',
    component: UserSlugPage,
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
let authCheckPromise: Promise<any> | null = null;

router.beforeEach(async (to, from, next) => {
  const auth = getAuth();

  // Wait for initial auth check to complete
  if (!isAuthChecked) {
    if (!authCheckPromise) {
      authCheckPromise = new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
          isAuthChecked = true;
          resolve(user);
        });
      });
    }
    await authCheckPromise;
  }

  const user = auth.currentUser;

  // Handle root path
  if (to.path === '/') {
    if (user) {
      next('/dashboard');
      return;
    }
    next();
    return;
  }

  // If already authenticated, redirect from login to app
  if (to.path === '/login' && user) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : null;
    next(redirect && redirect.length > 0 ? redirect : '/dashboard');
    return;
  }

  // Require auth for protected routes
  if (to.meta.requiresAuth && !user) {
    next({
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    });
    return;
  }

  // Check if authenticated user has claimed a slug (required for all users)
  // Allow them to access dashboard where they can claim it via settings
  if (user && to.meta.requiresAuth && to.path !== '/login' && to.path !== '/dashboard') {
    try {
      const userId = (user as any).uid;
      const profile = await getUserProfile(userId);
      
      // If user doesn't have a slug, redirect to dashboard where they can claim it
      if (!profile?.slug) {
        next('/dashboard');
        return;
      }
    } catch (error) {
      console.error('Error checking user slug:', error);
      // On error, allow navigation to continue
    }
  }

  next();
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
