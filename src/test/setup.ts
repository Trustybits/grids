/**
 * Global test setup — runs before every test file.
 *
 * Responsibilities:
 *  1. Mock Firebase so tests never hit real Firestore / Auth / Functions
 *  2. Provide a minimal Pinia instance so stores can be used in tests
 *  3. Silence noisy console output that isn't relevant to test results
 */

import { vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Firebase Auth mock ─────────────────────────────────────────────────────
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null)
    return vi.fn() // unsubscribe fn
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
}))

// ── Firebase Firestore mock ────────────────────────────────────────────────
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
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
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}))

// ── Firebase App mock ─────────────────────────────────────────────────────
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApp: vi.fn(() => ({})),
}))

// ── @/firebase module mock (re-exports Firebase instances) ─────────────────
vi.mock('@/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
  storage: {},
  app: {},
}))

// ── Vue Router mock ────────────────────────────────────────────────────────
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: { value: { path: '/', query: {}, params: {} } },
  })),
  useRoute: vi.fn(() => ({ path: '/', query: {}, params: {} })),
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}))

// ── PostHog mock ───────────────────────────────────────────────────────────
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    setPersonProperties: vi.fn(),
    init: vi.fn(),
  },
}))

// ── Pinia setup ────────────────────────────────────────────────────────────
// Fresh Pinia instance for every test — prevents state from leaking between tests
beforeEach(() => {
  setActivePinia(createPinia())
})

// ── Silence expected console noise ────────────────────────────────────────
const originalConsoleError = console.error
beforeEach(() => {
  console.error = (...args: any[]) => {
    // Suppress Vue warning noise in test output
    if (typeof args[0] === 'string' && args[0].includes('[Vue warn]')) return
    originalConsoleError(...args)
  }
})

afterEach(() => {
  console.error = originalConsoleError
  vi.clearAllMocks()
})
