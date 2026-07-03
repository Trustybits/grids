import { createRouter, createWebHistory } from 'vue-router';
import LandingPage from '@/pages/LandingPage.vue';
import PricingPage from '@/pages/PricingPage.vue';
import TemplatesPage from '@/pages/TemplatesPage.vue';
import BlogPage from '@/pages/BlogPage.vue';
import GridPage from '@/pages/GridPage.vue';
import AuthPage from '@/pages/AuthPage.vue';
import DashboardPage from '@/pages/DashboardPage.vue';
import PrivacyPage from '@/pages/PrivacyPage.vue';
import TermsPage from '@/pages/TermsPage.vue';
import NotionCallback from '@/pages/NotionCallback.vue';
import { getAuthProvider } from '@/auth/AuthProviderSingleton';
import { getServiceFactory } from '@/services/ServiceFactorySingleton';
import { MARKETING_PATHS } from '@/constants/marketing';
import posthog from 'posthog-js';

// Define routes
const routes = [
  { path: "/", component: LandingPage },
  { path: "/login", component: AuthPage },
  { path: "/signup", redirect: "/login" },
  {
    path: "/dashboard",
    component: DashboardPage,
    meta: { requiresAuth: true },
  },
  {
    path: "/grid/:id",
    component: GridPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/privacy",
    component: PrivacyPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/terms",
    component: TermsPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/pricing",
    component: PricingPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/showcase",
    redirect: { path: "/", hash: "#showcase" },
  },
  {
    path: "/templates",
    component: TemplatesPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/blog",
    component: BlogPage,
    meta: { requiresAuth: false },
  },
  {
    // Handles the Notion OAuth redirect — must be before /:slug to avoid being caught by it
    path: "/notion-callback",
    component: NotionCallback,
    meta: { requiresAuth: false },
  },
  {
    path: "/:slug",
    component: GridPage,
    meta: { requiresAuth: false },
  },
];

const marketingPathSet = new Set<string>(MARKETING_PATHS);

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    if (
      marketingPathSet.has(to.path) &&
      marketingPathSet.has(from.path) &&
      to.path !== from.path
    ) {
      return { top: 0, behavior: 'smooth' };
    }
    return { top: 0 };
  },
});

router.beforeEach(async (to, from, next) => {
  const authProvider = getAuthProvider();
  const user = await authProvider.waitForAuthReady();

  // Handle root path
  if (to.path === "/") {
    if (user) {
      next("/dashboard");
      return;
    }
    next();
    return;
  }

  // If already authenticated, redirect from login to app
  if (to.path === "/login" && user) {
    const redirect =
      typeof to.query.redirect === "string" ? to.query.redirect : null;
    next(redirect && redirect.length > 0 ? redirect : "/dashboard");
    return;
  }

  // Require auth for protected routes
  if (to.meta.requiresAuth && !user) {
    next({
      path: "/login",
      query: {
        redirect: to.fullPath,
      },
    });
    return;
  }

  // Check if authenticated user has claimed a slug (required for all users)
  // Allow them to access dashboard where they can claim it via settings
  if (
    user &&
    to.meta.requiresAuth &&
    to.path !== "/login" &&
    to.path !== "/dashboard"
  ) {
    try {
      const profile = await getServiceFactory().getUserService().getUserProfile(user.uid);
      
      // If user doesn't have a slug, redirect to dashboard where they can claim it
      if (!profile?.slug) {
        next("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error checking user slug:", error);
      // On error, allow navigation to continue
    }
  }

  next();
});

// Track page views with PostHog
router.afterEach((_to) => {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.capture("$pageview", {
      $current_url: window.location.href,
    });
  }
});

export default router;
