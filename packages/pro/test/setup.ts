/**
 * Global test setup for @grids/pro — runs before every test file.
 *
 * Responsibility: mock Firebase SDKs so tests never hit real Firestore,
 * Auth, Functions, or Storage. The DAO and AuthProvider sources under test
 * import directly from `firebase/*` and from `../infrastructure/firebase`
 * (which itself imports `firebase/*`), so mocking the SDK modules here
 * intercepts both paths.
 */

import { vi, afterEach } from 'vitest'

// ── Firebase Auth mock ─────────────────────────────────────────────────────
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null)
    return vi.fn()
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailLink: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
}))

// ── Firebase Firestore mock ────────────────────────────────────────────────
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  onSnapshot: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  addDoc: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  })),
}))

// ── Firebase Functions mock ────────────────────────────────────────────────
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(() => vi.fn()),
  connectFunctionsEmulator: vi.fn(),
}))

// ── Firebase Storage mock ──────────────────────────────────────────────────
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  connectStorageEmulator: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}))

// ── Firebase App mock ──────────────────────────────────────────────────────
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApp: vi.fn(() => ({})),
}))

// ── Firebase Analytics mock ────────────────────────────────────────────────
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
}))

afterEach(() => {
  vi.clearAllMocks()
})
