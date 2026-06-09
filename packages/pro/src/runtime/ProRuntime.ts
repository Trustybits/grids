import type { AuthProvider } from "@grids/contracts/auth";
import type { DaoFactory, DbUtils } from "@grids/contracts/dao";
import { FirebaseAuthProvider } from "../auth/firebase/FirebaseAuthProvider.js";
import { FirebaseDaoFactory } from "../dao/firebase/factory/FirebaseDaoFactory.js";
import { FirebaseDbUtils } from "../dao/firebase/FirebaseDbUtils.js";
import {
  createFirebaseServices,
  type FirebaseEmulatorTarget,
} from "./firebase.js";
import type { FirebaseEnv } from "./firebaseConfigs.js";

export interface ProRuntimeConfig {
  firebaseEnv: FirebaseEnv;
  emulatorTargets: ReadonlySet<FirebaseEmulatorTarget>;
  viewEndAnalyticsBeaconUrl: string | null;
}

export class ProRuntime {
  /**
   * `true` when a valid Firebase configuration was present and the backend
   * services were constructed; `false` when no configuration was bundled, in
   * which case the members below are `null` and callers should fall back to the
   * stubbed backend.
   */
  public readonly hasValidFirebaseConfig: boolean;
  public readonly daoFactory: DaoFactory | null;
  public readonly dbUtils: DbUtils | null;
  public readonly authProvider: AuthProvider | null;

  public constructor(config: ProRuntimeConfig) {
    const services = createFirebaseServices(
      config.firebaseEnv,
      config.emulatorTargets,
    );

    if (!services) {
      this.hasValidFirebaseConfig = false;
      this.daoFactory = null;
      this.dbUtils = null;
      this.authProvider = null;
      return;
    }

    this.hasValidFirebaseConfig = true;
    this.daoFactory = new FirebaseDaoFactory({
      db: services.db,
      functions: services.functions,
      storage: services.storage,
      viewEndAnalyticsBeaconUrl: config.viewEndAnalyticsBeaconUrl,
    });
    this.dbUtils = new FirebaseDbUtils();
    this.authProvider = new FirebaseAuthProvider(services.auth);
  }
}
