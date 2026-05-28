import type { AuthProvider } from "@grids/contracts/auth";
import type { DaoFactory, DbUtils } from "@grids/contracts/dao";
import { FirebaseAuthProvider } from "../auth/firebase/FirebaseAuthProvider.js";
import { FirebaseDaoFactory } from "../dao/firestore/factory/FirebaseDaoFactory.js";
import { FirebaseDbUtils } from "../dao/firestore/FirebaseDbUtils.js";
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
  public readonly daoFactory: DaoFactory;
  public readonly dbUtils: DbUtils;
  public readonly authProvider: AuthProvider;

  public constructor(config: ProRuntimeConfig) {
    const services = createFirebaseServices(
      config.firebaseEnv,
      config.emulatorTargets,
    );
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
