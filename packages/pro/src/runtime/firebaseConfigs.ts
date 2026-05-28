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

const CONFIGS: Record<FirebaseEnv, FirebaseProjectConfig> = {
  prod: {
    apiKey: "AIzaSyD1SapZGG49zaIfBv3QqZWxobQmws263zQ",
    authDomain: "grids-one.firebaseapp.com",
    projectId: "grids-one",
    storageBucket: "grids-one.firebasestorage.app",
    messagingSenderId: "598562210148",
    appId: "1:598562210148:web:6bfd6ef229fcd9fd5b3a71",
    measurementId: "G-8Q904761XS",
  },
  // TODO: populate with real grids-stage Firebase config from the Firebase
  // console (Project settings → Your apps). Selecting "stage" before these
  // values are filled in will fail to connect.
  stage: {
    apiKey: "REPLACE_ME",
    authDomain: "REPLACE_ME",
    projectId: "grids-stage",
    storageBucket: "REPLACE_ME",
    messagingSenderId: "REPLACE_ME",
    appId: "REPLACE_ME",
  },
};

export function getFirebaseConfig(env: FirebaseEnv): FirebaseProjectConfig {
  return CONFIGS[env];
}
