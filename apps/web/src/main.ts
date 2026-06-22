import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import posthog from "posthog-js";
// Register all tile definitions before any service that may call createTileContent
// at module scope (e.g. MockGridService). This import self-registers on evaluation.
import "@/registries/tiles";

import { registerDaoFactory } from "@/dao/DaoFactorySingleton";
import { registerDbUtils } from "@/dao/DbUtilsSingleton";
import { registerAuthProvider } from "@/auth/AuthProviderSingleton";
import { registerServiceFactory } from "@/services/ServiceFactorySingleton";
import { ServiceFactory } from "@/services/factory/ServiceFactory";
import { loadProRuntime } from "@/pro/loadProRuntime";

import "@fortawesome/fontawesome-free/css/all.css";
import "mapbox-gl/dist/mapbox-gl.css";

import './styles/tokens.scss';
import './styles/claude-tokens.scss';
import './styles/themes.scss';
import './styles/custom.scss';
import "./styles/_tooltips.scss";

import { useThemeStore } from "@/stores/theme";

// Initialize PostHog
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // We'll capture manually with router
    capture_pageleave: true,
  });
}

(async () => {
  const wantFirebase = import.meta.env.VITE_USE_FIREBASE === "true";
  const proRuntime = wantFirebase ? await loadProRuntime() : null;
  let isStubbedMode = true;

  if (proRuntime?.daoFactory && proRuntime.dbUtils && proRuntime.authProvider) {
    registerDaoFactory(proRuntime.daoFactory);
    registerDbUtils(proRuntime.dbUtils);
    registerAuthProvider(proRuntime.authProvider);
    isStubbedMode = false;
  } else {
    if (wantFirebase && !proRuntime) {
      console.warn(
        "VITE_USE_FIREBASE=true but @grids/pro runtime is unavailable — falling back to stubbed implementations.",
      );
    }
    await initializeStubs();
  }

  // Services depend on DAO factory + DbUtils being registered first,
  // so the service factory is registered after either init branch completes.
  registerServiceFactory(new ServiceFactory());

  const app = createApp(App, { isStubbedMode });
  const pinia = createPinia();

  app.use(router);

  app.use(pinia);

  useThemeStore(pinia).initializeTheme();

  app.mount("#app");
})();

async function initializeStubs() {
  const { StubbedDaoFactory } =
    await import("@/dao/stubbed/factory/StubbedDaoFactory");
  registerDaoFactory(new StubbedDaoFactory());
  const { StubbedDbUtils } = await import("@/dao/stubbed/StubbedDbUtils");
  registerDbUtils(new StubbedDbUtils());
  const { StubbedAuthProvider } =
    await import("@/auth/stubbed/StubbedAuthProvider");
  registerAuthProvider(new StubbedAuthProvider());
}
