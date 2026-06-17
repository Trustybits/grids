# Code Style

This page captures project conventions that are broader than formatter or linter rules.

## TypeScript

- Prefer explicit domain types over broad object shapes.
- Avoid `any` unless there is no practical alternative.
- Keep shared domain types in `packages/contracts` when they cross package boundaries.
- Keep implementation-specific types near their implementation.

## Vue

- Use `<script setup>` for new Vue components.
- Keep components focused on rendering and interaction.
- Move shared behavior into composables, stores, services, or utilities.
- Prefer user-visible behavior in component tests.

## Data Access

- Components should not directly call Firebase.
- Use services, stores, composables, and DAO interfaces.
- Put shared data contracts in `packages/contracts`.
- Put Firebase-backed browser runtime behavior in `packages/pro`.

## Utilities

- Keep pure helpers in `apps/web/src/utils`.
- Test pure helpers directly.
- Avoid mixing DOM, Firebase, or router dependencies into utility functions unless that is the point of the utility.

## Docs

- Update docs when scripts, setup steps, architecture, runtime boundaries, or contributor workflows change.
- Keep durable docs in `docs/`.
- Keep scratch or historical notes in `notes/`.
