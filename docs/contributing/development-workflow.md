# Development Workflow

Keep changes focused and reviewable.

## Before You Start

- Check existing issues or discussions for duplicate work.
- For large features, open an issue or discussion before writing a large implementation.
- Read the relevant architecture docs when changing data flow, Firebase behavior, or public contracts.

## Branches

Use short, descriptive branch names:

```text
feat/document-preview
fix/grid-undo-color
docs/local-development
test/firebase-grid-dao
```

## During Development

- Keep public contributor workflows independent from production Firebase access.
- Update docs when setup, scripts, architecture, or contributor expectations change.
- Add tests with behavior changes.
- Prefer small PRs over broad refactors.

## Before Review

Run checks that match your change:

```bash
npm run lint
npm run test
npm run type-check
```

For broad changes, run:

```bash
npm run suite:full
```

Fill out the PR template and call out any intentionally skipped checks.
