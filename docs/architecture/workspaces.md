# Workspaces

The repository is managed with npm workspaces:

```text
apps/*
packages/*
```

## apps/web

The public Vue 3 application. It contains routes, pages, components, stores, composables, services, local DAO setup, stubbed implementations, tile registries, and app-specific utilities.

Most frontend contributions start here.

## apps/firebase-functions

Firebase Cloud Functions for backend workflows such as scraping, analytics, badges, notifications, storage, and account operations.

Use this workspace when behavior must run server-side or respond to Firebase triggers/callables.

## packages/contracts

Shared TypeScript interfaces and domain types. This package defines the stable boundary between the public app and runtime implementations.

Start here when adding or changing:

- Domain types
- DAO interfaces
- Auth provider interfaces
- Cross-package contracts

## packages/pro

Production-oriented Firebase runtime code. It implements contracts against Firebase when valid Firebase config is present, and contributors can use it with the local Firebase Emulator Suite.

Public checkouts should build and run without production Firebase config. When config is absent, the web app falls back to stubbed implementations.

## Root Scripts

Common root scripts orchestrate workspace-level work:

```bash
npm run dev
npm run dev:emulator
npm run build
npm run lint
npm run test
npm run type-check
npm run suite:full
```

Use package-specific workspace commands when you only need one workspace:

```bash
npm --workspace apps/web run test:run
npm --workspace @grids/firebase-functions run build
npm --workspace @grids/contracts run type-check
```
