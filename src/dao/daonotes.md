# DAO Refactor Plan — Client-Side Only

## Suggested Folder Structure

```
src/
├── dao/
│   ├── interfaces/
│   │   ├── LayoutDao.ts
│   │   ├── UserDao.ts
│   │   ├── SlugDao.ts
│   │   ├── UserGameDataDao.ts
│   │   ├── ChatDao.ts
│   │   ├── UpvoteDao.ts
│   │   ├── CustomerDao.ts
│   │   └── DaoFactory.ts
│   └── firestore/
│       ├── FirestoreLayoutDao.ts
│       ├── FirestoreUserDao.ts
│       ├── FirestoreSlugDao.ts
│       ├── FirestoreUserGameDataDao.ts
│       ├── FirestoreChatDao.ts
│       ├── FirestoreUpvoteDao.ts
│       ├── FirestoreCustomerDao.ts
│       └── FirestoreDaoFactory.ts
├── services/
│   ├── LayoutService.ts          (interface — already exists)
│   ├── FirestoreLayoutService.ts  (refactored to use LayoutDao)
│   ├── GameDataService.ts         (refactored to use UserGameDataDao)
│   ├── UserProfileService.ts      (refactored to use UserDao + SlugDao)
│   ├── StripeService.ts           (refactored to use CustomerDao)
│   └── ...
├── stores/
│   ├── layout.ts                  (refactored to use services only, no direct db imports)
│   └── ...
└── ...
```

### Key concepts

- **`dao/interfaces/`** — Pure TypeScript interfaces. No Firestore imports. Each defines the
  contract for a single collection's data access.
- **`dao/interfaces/DaoFactory.ts`** — Abstract factory interface that exposes a getter for
  each DAO interface.
- **`dao/firestore/`** — Concrete Firestore implementations of each DAO interface, plus
  `FirestoreDaoFactory` implementing `DaoFactory`.
- **Services** consume DAOs (injected via the factory). They contain business logic but never
  import Firestore directly.
- **Stores** consume services. They manage Vue reactive state but delegate all persistence to
  services.

---

## DaoFactory Interface

```typescript
interface DaoFactory {
  getLayoutDao: LayoutDao;
  getUserDao: UserDao;
  getSlugDao: SlugDao;
  getUserGameDataDao: UserGameDataDao;
  getChatDao: ChatDao;
  getUpvoteDao: UpvoteDao;
  getCustomerDao: CustomerDao;
}
```

`FirestoreDaoFactory` implements this, instantiating each `Firestore*Dao` with the shared
Firestore `db` instance. Services receive the factory (or individual DAOs) at construction time.

---

## Client-Side DAO Interfaces

### 1. LayoutDao

Covers the `layouts` collection. Used by `FirestoreLayoutService` and the `layout.ts` store.

**Current call sites:**

- `FirestoreLayoutService.ts` — getDoc, setDoc, updateDoc, deleteDoc
- `layout.ts` store — query by userId (getDocs), generate new doc ID, updateDoc (lastOpenedAt)

```typescript
interface LayoutDao {
  /**
   * Fetch a single layout document by ID.
   * Currently: getDoc(doc(db, "layouts", id))
   * Used in: FirestoreLayoutService.fetchLayout()
   */
  getById(id: string): Promise<Layout | null>;

  /**
   * Query all layouts belonging to a specific user.
   * Currently: getDocs(query(collection(db, "layouts"), where("userId", "==", userId)))
   * Used in: layout.ts store → fetchLayouts()
   */
  findByUserId(userId: string): Promise<Layout[]>;

  /**
   * Generate a new unique document ID without writing to Firestore.
   * Currently: doc(collection(db, "layouts")).id
   * Used in: layout.ts store → createLayout(), duplicateLayout()
   */
  generateId(): string;

  /**
   * Create or fully overwrite a layout document.
   * Currently: setDoc(doc(db, "layouts", layout.id), payload, { merge: true })
   * Used in: FirestoreLayoutService.saveLayout()
   */
  save(id: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Partially update fields on an existing layout document.
   * Currently: updateDoc(doc(db, "layouts", layout.id), payload)
   * Used in: FirestoreLayoutService.updateLayout()
   */
  update(id: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Update only the lastOpenedAt field to a server timestamp.
   * Currently: updateDoc(ref, { lastOpenedAt: serverTimestamp() })
   * Used in: layout.ts store → loadLayout()
   */
  updateLastOpenedAt(id: string): Promise<void>;

  /**
   * Delete a layout document by ID.
   * Currently: deleteDoc(doc(db, "layouts", id))
   * Used in: FirestoreLayoutService.deleteLayout()
   */
  delete(id: string): Promise<void>;
}
```

---

### 2. UserDao

Covers the `users` collection. Used by `UserProfileService`, `App.vue`, `layout.ts` store,
`useStripeCheckout`, and `useSubscription`.

**Current call sites:**

- `UserProfileService.ts` — getDoc, setDoc (merge)
- `App.vue` — setDoc (merge) for lastLogin + email
- `layout.ts` store — getDoc / setDoc (merge) for recentLayoutIds
- `useStripeCheckout.ts` — updateDoc for hasSupporterBadge
- `useSubscription.ts` — onSnapshot for hasSupporterBadge

```typescript
interface UserDao {
  /**
   * Get a user document by user ID.
   * Currently: getDoc(doc(db, "users", userId))
   * Used in: UserProfileService.getUserProfile(), layout.ts → loadRecents()
   */
  getById(userId: string): Promise<Record<string, unknown> | null>;

  /**
   * Create or merge-update fields on a user document.
   * Currently: setDoc(doc(db, "users", userId), data, { merge: true })
   * Used in: UserProfileService.updateUserProfile(), App.vue (login),
   *          layout.ts → saveRecents()
   */
  save(userId: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Update specific fields on an existing user document (fails if doc doesn't exist).
   * Currently: updateDoc(doc(db, "users", userId), data)
   * Used in: useStripeCheckout → grantFreeSupporterBadge()
   */
  update(userId: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Subscribe to real-time changes on a user document.
   * Currently: onSnapshot(doc(db, "users", user.uid), callback)
   * Used in: useSubscription.ts → watches hasSupporterBadge
   * Returns an unsubscribe function.
   */
  subscribe(
    userId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void;
}
```

---

### 3. SlugDao

Covers the `slugs` collection. Client-side is **read-only** for direct Firestore access —
all writes go through Cloud Functions (`claimSlug`, `updateDefaultGrid`) which are called
via `httpsCallable` in `UserProfileService`.

**Current call sites:**

- `UserProfileService.ts` — getDoc for slug lookup
- `UserSlugPage.vue` — getDoc for slug lookup
- `UserProfileService.ts` — httpsCallable wrappers (checkSlugAvailability, claimSlug, setDefaultGrid)

```typescript
interface SlugDao {
  /**
   * Look up a slug document to get the associated userId and metadata.
   * Currently: getDoc(doc(db, "slugs", slug.toLowerCase()))
   * Used in: UserProfileService.getUserIdBySlug(), UserSlugPage.vue
   */
  getBySlug(slug: string): Promise<Record<string, unknown> | null>;

  /**
   * Check if a slug is available (calls Cloud Function).
   * Currently: httpsCallable(functions, "checkSlugAvailability")({ slug })
   * Used in: UserProfileService.checkSlugAvailability()
   */
  checkAvailability(
    slug: string,
  ): Promise<{ available: boolean; reason: string; message: string }>;

  /**
   * Claim a slug for the current user (calls Cloud Function).
   * Currently: httpsCallable(functions, "claimSlug")({ slug })
   * Used in: UserProfileService.claimSlug()
   */
  claim(slug: string): Promise<{ success: boolean; message: string }>;

  /**
   * Update the default grid for the current user's slug (calls Cloud Function).
   * Currently: httpsCallable(functions, "updateDefaultGrid")({ gridId })
   * Used in: UserProfileService.setDefaultGrid()
   */
  updateDefaultGrid(gridId: string | null): Promise<{ success: boolean }>;
}
```

---

### 4. UserGameDataDao

Covers the `userGameData` collection. All operations are client-side.

**Current call sites:**

- `GameDataService.ts` — all methods

```typescript
interface UserGameDataDao {
  /**
   * Get game data document for a user.
   * Currently: getDoc(doc(db, "userGameData", userId))
   * Used in: getOrCreateUserGameData(), checkDailyClickLimit(), claimPassiveClicks()
   */
  getById(userId: string): Promise<Record<string, unknown> | null>;

  /**
   * Create a new game data document for a user.
   * Currently: setDoc(doc(db, "userGameData", userId), data)
   * Used in: getOrCreateUserGameData() — when doc doesn't exist
   */
  create(userId: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Update specific fields on a game data document.
   * Currently: updateDoc(doc(db, "userGameData", userId), data)
   * Used in: updateDisplayName(), increasePassiveBoost(), addPassiveClicks(),
   *          claimPassiveClicks()
   */
  update(userId: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Atomically read-check-update clicks within a transaction.
   * Currently: runTransaction — reads doc, checks daily limit, updates clicks
   * Used in: incrementUserClicks()
   * Returns true if the increment was applied (under daily cap), false otherwise.
   */
  incrementClicksTransaction(userId: string, amount: number): Promise<boolean>;

  /**
   * Subscribe to a single user's game data document in real-time.
   * Currently: onSnapshot(doc(db, "userGameData", userId), callback)
   * Used in: subscribeToUserGameData()
   * Returns an unsubscribe function.
   */
  subscribe(
    userId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void;

  /**
   * Query the top N users by totalClicks (one-time fetch).
   * Currently: getDocs(query(collection, orderBy("totalClicks", "desc"), limit(topN)))
   * Used in: getLeaderboard()
   */
  getLeaderboard(topN: number): Promise<Array<Record<string, unknown>>>;

  /**
   * Subscribe to leaderboard in real-time.
   * Currently: onSnapshot on query(collection, orderBy("totalClicks", "desc"), limit(topN))
   * Used in: subscribeToLeaderboard()
   * Returns an unsubscribe function.
   */
  subscribeToLeaderboard(
    topN: number,
    callback: (entries: Array<Record<string, unknown>>) => void,
  ): () => void;
}
```

---

### 5. ChatDao

Covers the `layouts/{layoutId}/tiles/{tileId}/messages` subcollection.

**Current call sites:**

- `ChatContent.vue` — onSnapshot (subscribe), addDoc (send message)

```typescript
interface ChatDao {
  /**
   * Subscribe to real-time chat messages for a specific tile, ordered by createdAt asc.
   * Currently: onSnapshot(query(messagesCollection, orderBy("createdAt", "asc")), ...)
   * Used in: ChatContent.vue → subscribeToMessages()
   * Returns an unsubscribe function.
   */
  subscribeToMessages(
    layoutId: string,
    tileId: string,
    callback: (messages: Array<Record<string, unknown>>) => void,
    onError?: (error: Error) => void,
  ): () => void;

  /**
   * Add a new chat message to the tile's messages subcollection.
   * Currently: addDoc(messagesCollection, { text, createdAt, authorId })
   * Used in: ChatContent.vue → sendMessage()
   */
  addMessage(
    layoutId: string,
    tileId: string,
    message: { text: string; createdAt: number; authorId: string },
  ): Promise<void>;
}
```

---

### 6. UpvoteDao

Covers the `layouts/{layoutId}/tiles/{tileId}/upvotes` subcollection. Client-side is
**read-only** (subscribe). The toggle write is handled server-side by the `upvoteRoadmapItem`
Cloud Function, called via `httpsCallable` in `RoadmapFeedContent.vue`.

**Current call sites:**

- `RoadmapFeedContent.vue` — onSnapshot with where("userId", "==", uid)
- `RoadmapFeedContent.vue` — httpsCallable("upvoteRoadmapItem")

```typescript
interface UpvoteDao {
  /**
   * Subscribe to the current user's upvotes for a tile in real-time.
   * Currently: onSnapshot(query(upvotesRef, where("userId", "==", uid)), ...)
   * Used in: RoadmapFeedContent.vue → subscribeToMyUpvote()
   * Returns an unsubscribe function.
   */
  subscribeToUserUpvotes(
    layoutId: string,
    tileId: string,
    userId: string,
    callback: (votedPageIds: Set<string>) => void,
    onError?: (error: Error) => void,
  ): () => void;

  /**
   * Toggle an upvote on a roadmap item (calls Cloud Function).
   * Currently: httpsCallable(functions, "upvoteRoadmapItem")({ layoutId, tileId, notionPageId })
   * Used in: RoadmapFeedContent.vue → toggleUpvote()
   */
  toggleUpvote(
    layoutId: string,
    tileId: string,
    notionPageId: string,
  ): Promise<{ isNowUpvoted: boolean }>;
}
```

---

### 7. CustomerDao

Covers the `customers/{uid}/checkout_sessions` and `customers/{uid}/subscriptions`
subcollections. These are managed by the Stripe Firebase Extension.

**Current call sites:**

- `StripeService.ts` — addDoc (create checkout session), onSnapshot (watch for redirect URL)
- `useSubscription.ts` — onSnapshot on subscriptions query
- `StripeService.ts` — collection refs for subscriptions and payments

```typescript
interface CustomerDao {
  /**
   * Create a new checkout session document and return its document ID.
   * Currently: addDoc(collection(db, "customers", uid, "checkout_sessions"), config)
   * Used in: StripeService.ts → createCheckoutSession()
   */
  createCheckoutSession(
    userId: string,
    config: Record<string, unknown>,
  ): Promise<string>;

  /**
   * Subscribe to a specific checkout session document for URL/error updates.
   * Currently: onSnapshot(sessionDoc, callback)
   * Used in: StripeService.ts → createCheckoutSession() (waits for Stripe URL)
   * Returns an unsubscribe function.
   */
  subscribeToCheckoutSession(
    userId: string,
    sessionId: string,
    callback: (data: Record<string, unknown> | null) => void,
  ): () => void;

  /**
   * Subscribe to a user's active/trialing subscriptions in real-time.
   * Currently: onSnapshot(query(collection(..., "subscriptions"), where("status", "in", [...]), limit(1)))
   * Used in: useSubscription.ts → initSubscription()
   * Returns an unsubscribe function.
   */
  subscribeToActiveSubscriptions(
    userId: string,
    callback: (subscriptions: Array<Record<string, unknown>>) => void,
  ): () => void;
}
```

---

## Notes

- **`notification_tracking`** and **`publicProfiles`** are excluded — they are only accessed
  server-side (Cloud Functions / migration scripts). No client-side DAO needed.
- All DAO methods use `Record<string, unknown>` for data payloads at the interface level.
  The concrete Firestore implementations will handle serialization (serverTimestamp, increment,
  FieldValue, etc.). Services are responsible for mapping to/from typed domain objects.
- `httpsCallable` wrappers (slug claim/check, upvote toggle) are included in their respective
  DAO interfaces because from the service's perspective, these are still "data access" — the
  service shouldn't care whether the DAO talks to Firestore directly or via a Cloud Function.
- The existing `LayoutService` interface in `src/services/LayoutService.ts` is a **service-level**
  interface (business logic). It will consume `LayoutDao` internally. These are separate layers.
