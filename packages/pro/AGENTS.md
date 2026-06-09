# @grids/pro

**Private** production code for `grids.so` — the closed-source backend implementations behind the `@grids/contracts` interfaces. This package must never be mirrored, cloned, or copied into a public repository. An open-source checkout ships without it, and `apps/web` falls back to its local stubs.

Everything here is the Firebase side of the boundary: the concrete Firestore/Auth/Storage/Functions implementations of the DAO and `AuthProvider` interfaces, plus the runtime that wires them together. `apps/web` depends on `@grids/contracts` types only — it reaches these implementations exclusively through the `ProRuntime` returned at the boundary (`apps/web/src/pro/loadProRuntime.ts`).

## Public entry point

A single export (`.` → `src/index.ts`, built to `dist/`):

- `ProRuntime` (class) + `ProRuntimeConfig` (its config shape)
- `FirebaseEnv` (`"prod" | "stage"`)
- `FIREBASE_EMULATOR_TARGETS` (const) + `FirebaseEmulatorTarget` (type)

Consumers should never deep-import a DAO or provider; they take what they need off a constructed `ProRuntime`.

## What lives here

- **`src/runtime/`** — the composition root.
  - `ProRuntime.ts` — constructs the Firebase services from a `ProRuntimeConfig`, then exposes `daoFactory` (`DaoFactory`), `dbUtils` (`DbUtils`), and `authProvider` (`AuthProvider`) — all typed as `@grids/contracts` interfaces. When no Firebase config is bundled (see below), `hasValidFirebaseConfig` is `false` and those three members are `null`.
  - `firebase.ts` — `createFirebaseServices(env, emulatorTargets)`: initializes the Firebase app, Auth, Firestore, Analytics, Functions, Storage, and connects emulators when requested; returns `null` when no Firebase config is present. Owns `FIREBASE_EMULATOR_TARGETS`.
  - `firebaseConfigs.ts` — per-environment Firebase project config, loaded from a **gitignored `firebaseConfigs.json`** sitting next to it via `import.meta.glob` (bundle-time optional import). The JSON is committed in the private (Vercel) repo and absent from the public/OSS one; when absent the glob yields nothing, `hasFirebaseConfig` is `false`, and the app falls back to the stubbed backend instead of crashing. The build copies the JSON into `dist/runtime/` so the glob resolves there (`apps/web` sets `optimizeDeps.exclude: ['@grids/pro']` so Vite — not esbuild — transforms the glob in dev). **Note:** the `stage` config is still `REPLACE_ME` placeholders; selecting `stage` won't connect until those are filled in from the Firebase console.
- **`src/dao/firestore/`** — one Firestore implementation per `@grids/contracts/dao` interface (`FirebaseGridDao`, `FirebaseUserDao`, `FirebaseSlugDao`, …), `FirebaseDbUtils`, shared helpers in `FirebaseUtils.ts`, and `factory/FirebaseDaoFactory.ts` (implements `DaoFactory`, constructing every DAO from injected `db`/`functions`/`storage`). DAOs map Firestore documents to/from the domain types in `@grids/contracts/types`.
- **`src/auth/firebase/`** — `FirebaseAuthProvider.ts`, the Firebase Auth implementation of `AuthProvider` (Google popup + passwordless email-link flows), translating Firebase's `User` to the contract's `AuthUser`.

## Configuration & environment

`ProRuntime` is host-agnostic: it reads **no** environment variables. The caller (`apps/web`'s `loadProRuntime.ts`) parses env and passes a `ProRuntimeConfig` — `firebaseEnv`, `emulatorTargets`, and `viewEndAnalyticsBeaconUrl`. Keep it that way: do env reads at the boundary, not in this package.

## Build, test & tooling

- `npm run build` — `tsc` emits `dist/` (declarations + JS + maps); this is what `apps/web` resolves via the `exports` map, so **build before depending on changes** (root `build:web-deps` / `dev` do this for you). Tests are excluded from the build (`tsconfig` `exclude`). The build first runs `scripts/checkFirebaseConfig.mjs`, a guard that is a no-op unless `REQUIRE_FIREBASE_CONFIG` is set (do this only in the Vercel deploy env): when set, it fails the build loudly if `firebaseConfigs.json` is missing/invalid, the target env's `apiKey` is still `REPLACE_ME`, or `VITE_USE_FIREBASE !== "true"` — preventing a silent stub-only production deploy.
- `npm run type-check` — `tsc --noEmit`.
- `npm run test` — Vitest (node env). Firebase SDKs are mocked globally in `test/setup.ts`, so tests never touch real Firestore/Auth/Functions/Storage. Tests live in `src/**/__tests__/`.
- `npm run lint` — ESLint, zero warnings allowed.
- ESM + `NodeNext`: relative imports carry the `.js` extension even though sources are `.ts`. Depends on `@grids/contracts` (workspace) and `firebase`.

## When writing code

- Implement against the `@grids/contracts` interfaces. Adding/changing a contract means updating the matching implementation here in lockstep — the `implements` clauses won't type-check otherwise — and keeping the OSS stubs in `apps/web/src/{dao,auth}/stubbed/` aligned.
- This is the only place Firebase/Firestore SDKs are used on the app side. Don't leak Firebase types across the boundary: DAO/provider method signatures must speak in `@grids/contracts` types, converting SDK shapes internally.
- New Firebase services are created in `runtime/firebase.ts` and injected into the factory via `ProRuntime` — don't initialize Firebase ad hoc inside individual DAOs.
- Naming: implementation classes are prefixed `Firebase*` to match their `Firebase*.ts` filenames (e.g. `FirebaseGridDao`, `FirebaseAuthProvider`, `FirebaseDaoFactory`). The bare `Firestore` type, `getFirestore`/`connectFirestoreEmulator`, and helpers like `mapFirestoreToGrid` are Firebase SDK / document-mapping references and keep the `Firestore` spelling.
