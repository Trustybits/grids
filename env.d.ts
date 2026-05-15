/// <reference types="vite/client" />
declare module 'vue3-grid-layout';

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_USE_FIRESTORE?: "true" | "false";
  readonly VITE_VIEW_END_ANALYTICS_BEACON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}