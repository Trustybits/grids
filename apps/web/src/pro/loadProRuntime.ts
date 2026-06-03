import type {
  FirebaseEmulatorTarget,
  FirebaseEnv,
  ProRuntime,
} from "@grids/pro";

const VALID_EMULATOR_TARGETS = [
  "auth",
  "firestore",
  "functions",
  "storage",
] as const satisfies readonly FirebaseEmulatorTarget[];

const VALID_FIREBASE_ENVS = ["prod", "stage"] as const satisfies readonly FirebaseEnv[];

/**
 * Attempts to construct the pro runtime from the @grids/pro package.
 *
 * Returns `null` when the package is unavailable (e.g., an OSS checkout that
 * ships only a stub @grids/pro). Callers decide whether that's an error or a
 * cue to fall back to stubs.
 *
 * Env reads happen here — at the boundary — so @grids/pro stays host-agnostic.
 */
export async function loadProRuntime(): Promise<ProRuntime | null> {
  try {
    const mod = await import("@grids/pro");
    if (!mod.ProRuntime) return null;

    return new mod.ProRuntime({
      firebaseEnv: parseFirebaseEnv(import.meta.env.VITE_FIREBASE_ENV),
      emulatorTargets: parseEmulatorTargets(
        import.meta.env.VITE_FIREBASE_EMULATORS,
      ),
      viewEndAnalyticsBeaconUrl:
        import.meta.env.VITE_VIEW_END_ANALYTICS_BEACON_URL ?? null,
    });
  } catch (err) {
    console.warn("Failed to load @grids/pro runtime:", err);
    return null;
  }
}

function parseFirebaseEnv(value: string | undefined): FirebaseEnv {
  if (value && (VALID_FIREBASE_ENVS as readonly string[]).includes(value)) {
    return value as FirebaseEnv;
  }
  if (value) {
    console.warn(
      `Unknown VITE_FIREBASE_ENV value "${value}" — falling back to "prod".`,
    );
  }
  return "prod";
}

function parseEmulatorTargets(
  value: string | undefined,
): ReadonlySet<FirebaseEmulatorTarget> {
  const targets = new Set<FirebaseEmulatorTarget>();
  if (!value) return targets;

  for (const token of value.split(",")) {
    const target = token.trim().toLowerCase();
    if (!target) continue;
    if (target === "all") {
      VALID_EMULATOR_TARGETS.forEach((t) => targets.add(t));
      continue;
    }
    if ((VALID_EMULATOR_TARGETS as readonly string[]).includes(target)) {
      targets.add(target as FirebaseEmulatorTarget);
    } else {
      console.warn(`Ignoring unknown Firebase emulator target: ${target}`);
    }
  }

  return targets;
}
