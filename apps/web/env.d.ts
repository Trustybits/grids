/// <reference types="vite/client" />
declare module 'vue3-grid-layout';

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_BRANDFETCH_CLIENT_ID?: string;
  readonly VITE_USE_FIREBASE?: "true" | "false";
  readonly VITE_FIREBASE_ENV?: "prod" | "stage";
  readonly VITE_FIREBASE_EMULATORS?: string;
  readonly VITE_VIEW_END_ANALYTICS_BEACON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
