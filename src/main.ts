import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import { app as firebaseApp } from "./firebase";
import router from "./router";
import posthog from "posthog-js";
import { registerDaoFactory } from "@/dao/DaoFactorySingleton";

import "@fortawesome/fontawesome-free/css/all.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "mapbox-gl/dist/mapbox-gl.css";

import "./styles/tokens.scss";
import "./styles/themes.scss";
import "./styles/custom.scss";

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
  if (import.meta.env.VITE_USE_FIRESTORE === "true") {
    const { FirestoreDaoFactory } =
      await import("@/dao/firestore/factory/FirestoreDaoFactory");
    registerDaoFactory(new FirestoreDaoFactory());
  } else {
    const { StubbedDaoFactory } =
      await import("@/dao/stubbed/factory/StubbedDaoFactory");
    registerDaoFactory(new StubbedDaoFactory());
  }

  const app = createApp(App);
  const pinia = createPinia();

  app.use(router);

  app.use(pinia);

  useThemeStore(pinia).initializeTheme();

  app.mount("#app");
})();
