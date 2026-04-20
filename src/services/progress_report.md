# Service/DAO Refactor Progress Report

**Date:** 2026-04-20
**Goal:** Remove all firebase/firestore imports from non-DAO code

---

## What's Done

### Services (3 complete)
- **LayoutService** — grid layout CRUD, with interface and mock
- **StorageService** — cloud storage operations, with interface and mock
- **UserService** — user entity operations, with interface, mock, and tests

### Infrastructure
- **ServiceFactory** + **ServiceFactorySingleton** — dependency injection wired up
- **IServiceFactory** interface for testability
- **FirestoreDaoFactory** — instantiates all DAOs

### DAOs (8 implemented)
- FirestoreUserDao, FirestoreLayoutDao, FirestoreChatDao, FirestoreUpvoteDao
- FirestoreCustomerDao, FirestoreUserGameDataDao, FirestoreSlugDao
- FirebaseStorageDao

---

## What Still Needs Refactoring

### Services with direct firebase imports (need to use DAOs instead)
- **GameDataService.ts** — uses `db` and firestore query functions directly
- **StripeService.ts** — uses `db` and firestore functions directly (subscriptions, customers, prices)

### Components calling firebase directly (need to go through services)
| File | What it imports |
|------|----------------|
| **ChatContent.vue** | `db`, firestore query/snapshot functions |
| **RoadmapFeedContent.vue** | `db`, `functions`, firestore queries + `httpsCallable` |
| **YouTubeContent.vue** | `functions`, `httpsCallable` |
| **MusicContent.vue** | `functions`, `httpsCallable` |
| **TileButtons.vue** | `functions`, `httpsCallable` |
| **GridTile.vue** | `functions`, `httpsCallable` |
| **NotionCallback.vue** | `functions`, `httpsCallable` |

### Composables
- **useDragAndPaste.ts** — uses `functions` + `httpsCallable`
- **useSubscription.ts** — uses `db` + firestore snapshot/query functions

### Stores
- **oldLayout.ts** — uses `db`, `auth`, and raw firestore operations (likely the old layout logic that LayoutService should replace entirely)

### Auth
- **FirestoreAuthProvider.ts** — uses `auth` from firebase directly (may be acceptable as a DAO-level concern, but worth reviewing)

---

## Patterns Observed in Remaining Work

1. **`httpsCallable` is the most common offender** — 6 components + 1 composable call cloud functions directly. A new **CloudFunctionsService** or similar wrapper would clean all of these up at once.

2. **Firestore real-time listeners** (`onSnapshot`) in ChatContent, RoadmapFeedContent, useSubscription, and oldLayout need to be moved behind DAOs/services that expose reactive subscriptions.

3. **oldLayout.ts** appears to be a legacy store that overlaps with LayoutService — may be a candidate for removal once LayoutService fully covers its responsibilities.

---

## Suggested Order of Attack

1. Create a service/DAO for `httpsCallable` cloud function calls (clears 7 files at once)
2. Refactor **StripeService** and **GameDataService** to use DAOs
3. Move **ChatContent** and **RoadmapFeedContent** firestore logic into services
4. Migrate **useSubscription** composable to use services
5. Retire **oldLayout.ts** in favor of LayoutService (or refactor it to use DAOs)
6. Decide on FirestoreAuthProvider — keep as-is or wrap behind an auth DAO
