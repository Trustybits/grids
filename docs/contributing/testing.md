# Testing

Grids uses Vitest across workspaces.

## Root Commands

```bash
npm run test
npm run lint
npm run type-check
npm run suite:full
```

## Workspace Commands

```bash
npm --workspace apps/web run test:run
npm --workspace apps/web run test
npm --workspace @grids/firebase-functions run test
npm --workspace @grids/pro run test
```

## What to Test

- Pure utilities: test exported behavior and edge cases.
- Services: test app rules and DAO interactions.
- Composables and stores: test state transitions and side effects.
- Components: test user-visible behavior rather than private implementation details.
- Bug fixes: add a regression test when practical.
- Public contracts: update tests when behavior depends on changed types or interfaces.

## Firebase and Stubs

Most frontend tests should not need production Firebase. Prefer stubs or mocks unless the behavior specifically needs emulator-backed Firebase behavior.

Cloud Function tests live in `apps/firebase-functions` and should stay close to the function or utility being tested.
