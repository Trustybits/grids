import type { AuthProvider } from "@grids/contracts/auth";
import type { DaoFactory, DbUtils } from "@grids/contracts/dao";
import { FirestoreAuthProvider } from "../auth/firebase/FirebaseAuthProvider.js";
import { FirestoreDaoFactory } from "../dao/firestore/factory/FirebaseDaoFactory.js";
import { FirestoreDbUtils } from "../dao/firestore/FirebaseDbUtils.js";
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
    this.daoFactory = new FirestoreDaoFactory({
      db: services.db,
      functions: services.functions,
      storage: services.storage,
      viewEndAnalyticsBeaconUrl: config.viewEndAnalyticsBeaconUrl,
    });
    this.dbUtils = new FirestoreDbUtils();
    this.authProvider = new FirestoreAuthProvider(services.auth);
  }
}
