export type FirebaseEnv = "prod" | "stage";

export interface FirebaseProjectConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

type FirebaseConfigFile = Partial<Record<FirebaseEnv, FirebaseProjectConfig>>;

// `import.meta.glob` is provided by the bundler (Vite); typed locally so this
// tsc-built package stays self-contained. The cast erases at emit, leaving a
// bare `import.meta.glob(...)` call for Vite to statically detect and transform.
interface ImportMetaWithGlob {
  glob<T>(pattern: string, options: { eager: true }): Record<string, T>;
}

// Optionally load real per-environment Firebase config from a gitignored
// `firebaseConfigs.json` sitting next to this file. That file is committed in
// production/deploy environments and absent from ordinary local checkouts.
//
// `import.meta.glob` resolves at bundle time: it inlines the JSON when the file
// is present and yields an empty object when it is absent. So a checkout
// without the file still builds and runs — `getFirebaseConfig` returns `null`
// and the app falls back to its stubbed backend instead of crashing.
const loadedConfigs = (
  import.meta as unknown as ImportMetaWithGlob
).glob<{ default: FirebaseConfigFile }>("./firebaseConfigs.json", {
  eager: true,
});

const configFile: FirebaseConfigFile | null =
  Object.values(loadedConfigs)[0]?.default ?? null;

/** True when a real Firebase configuration file was bundled into this build. */
export const hasFirebaseConfig: boolean = configFile !== null;

/**
 * Returns the Firebase config for `env`, or `null` when no configuration file
 * is present (or it has no entry for that environment). A `null` result is the
 * signal to fall back to the stubbed backend.
 */
export function getFirebaseConfig(
  env: FirebaseEnv,
): FirebaseProjectConfig | null {
  return configFile?.[env] ?? null;
}
