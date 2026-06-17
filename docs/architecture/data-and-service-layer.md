# Data and Service Layer

The frontend data path is intentionally layered so UI code does not need to know whether data is backed by Firebase or by local stubs.

## Typical Flow

```text
component
  -> composable or store
  -> service
  -> DAO interface
  -> runtime DAO implementation
```

## Contracts

`packages/contracts` defines shared interfaces and domain types. These are the types both app code and runtime implementations agree on.

Use contracts for:

- DAO interfaces
- Auth provider interfaces
- Shared domain types

Avoid putting implementation details in contracts.

## Services

`apps/web/src/services` contains app-level services. Services consume DAO interfaces and expose behavior to stores, composables, and components.

Services are a good place for app or business rules that should not live in Vue components.

## DAOs

DAO interfaces live in `packages/contracts/src/dao`.

Runtime implementations can be:

- Stubbed in-memory implementations under `apps/web/src/dao/stubbed`
- Firebase-backed implementations in `packages/pro`

The active DAO factory is registered during app startup.

## Components

Components should stay close to rendering and interaction. A component should not write directly to a database, persistent or otherwise. Prefer a store, composable, or service when behavior needs data access or shared logic.

## Tests

Pure helpers and services should usually be easier to test than component-heavy behavior. When adding behavior, prefer a shape where core logic can be tested outside the DOM when practical.
